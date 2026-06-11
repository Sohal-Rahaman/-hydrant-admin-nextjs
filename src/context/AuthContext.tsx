'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, logOut, SUPERADMIN_PHONES, getAdminDataByPhone, StaffMember, db } from '@/lib/firebase';
import { onAuthStateChanged, User, ConfirmationResult, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  userData: any | null; // Compatibility layer for legacy components
  isAdmin: boolean;
  role: 'superadmin' | 'admin' | 'developer' | 'marketing' | 'analytics' | 'manager' | 'user' | null;
  permissions: string[];
  staffData: StaffMember | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkAdminPrivileges: (user: User | null) => Promise<boolean>;
  // Phone OTP state (managed here so AdminRoute stays clean)
  confirmationResult: ConfirmationResult | null;
  setConfirmationResult: (r: ConfirmationResult | null) => void;
  // WhatsApp Fallback
  loginWithWhatsApp: (phoneNumber: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [role, setRole]               = useState<'superadmin' | 'admin' | 'developer' | 'marketing' | 'analytics' | 'manager' | 'user' | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [staffData, setStaffData]     = useState<StaffMember | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isManualAuth, setIsManualAuth] = useState(false);

  const signOut = async () => { 
    await logOut(); 
    setIsManualAuth(false);
  };

  // ONE-TIME GLOBAL FORCE LOGOUT
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isForcedOut = localStorage.getItem('global_force_logout_v2'); // updated to v2 to ensure it fires
      if (!isForcedOut) {
        localStorage.setItem('global_force_logout_v2', 'true');
        logOut().then(() => {
          setIsManualAuth(false);
          sessionStorage.removeItem('hydrant_manual_auth');
          localStorage.removeItem('hydrant_admin_session_id');
          window.location.href = '/';
        }).catch(() => {});
      }
    }
  }, []);

  const loginWithWhatsApp = async (phoneNumber: string) => {
    try {
      // STRICT APPROVAL CHECK: Before granting access, verify they are approved!
      const normalizedRaw = phoneNumber.replace(/[^\d+]/g, '');
      const isHardcodedSuperAdmin = SUPERADMIN_PHONES.some(p => p.replace(/[^\d+]/g, '') === normalizedRaw);
      const adminRecord = await getAdminDataByPhone(normalizedRaw);

      if (!isHardcodedSuperAdmin && !adminRecord) {
        console.warn(`Blocked unauthorized WhatsApp login attempt for ${phoneNumber}`);
        alert('Access Denied: Number not approved for Admin access. Please contact the Super Admin to be added.');
        return;
      }

      console.log('🔄 Initiating WhatsApp mock sign-in anonymous token exchange...');
      const userCredential = await signInAnonymously(auth);
      const anonUser = userCredential.user;
      console.log('✅ Signed in anonymously with UID:', anonUser.uid);

      // Write admin privileges in Firestore for this anonymous session
      const userRef = doc(db, 'users', anonUser.uid);
      await setDoc(userRef, {
        isAdmin: true,
        userType: 'admin',
        phone: phoneNumber,
        full_name: 'Super Admin (WhatsApp)',
        createdAt: new Date()
      }, { merge: true });
      console.log('🔑 Auto-synced anonymous session Firestore rules access');

      const mockUser = {
        ...anonUser,
        phoneNumber,
        displayName: 'Super Admin (WhatsApp)',
      } as User;
      
      setCurrentUser(mockUser);
      setIsAdmin(true);
      setRole('superadmin');
      setPermissions(['all']);
      setIsManualAuth(true);
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('hydrant_manual_auth', JSON.stringify({ phoneNumber, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('❌ Error in WhatsApp anonymous auth exchange:', error);
      
      // Fallback to client-only mock if network or emulator fails
      const mockUser = {
        phoneNumber,
        uid: `manual-${phoneNumber.replace(/\D/g, '')}`,
        displayName: 'Super Admin (WhatsApp)',
      } as User;
      
      setCurrentUser(mockUser);
      setIsAdmin(true);
      setRole('superadmin');
      setPermissions(['all']);
      setIsManualAuth(true);
    }
  };

  const checkAdminPrivileges = async (user: User | null): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false);
      setRole(null);
      setPermissions([]);
      setStaffData(null);
      return false;
    }

    // Normalize phone
    const raw = user.phoneNumber || '';
    const normalizedRaw = raw.replace(/[^\d+]/g, '');

    // 1. Check Firestore 'admins' collection
    const adminRecord = await getAdminDataByPhone(normalizedRaw);
    
    if (adminRecord) {
      setIsAdmin(true);
      setRole(adminRecord.role);
      // Grant all permissions to any active admin to satisfy "100% access" requirement
      setPermissions(['all']); 
      setStaffData(adminRecord);

      // ─── AUTO-HEAL PERMISSIONS ──────────────────────────────────────────
      // If Firestore Rules are failing, it's usually because the flag is missing in 'users'
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists() && (userDoc.data().isAdmin !== true || userDoc.data().userType !== 'admin')) {
          await updateDoc(userRef, { 
            isAdmin: true,
            userType: 'admin' 
          });
          console.log(`🔑 Auto-synced Firestore Admin flags (isAdmin & userType) for ${normalizedRaw}`);
        }
      } catch (err) {
        console.warn('⚠️ Auto-heal permissions failed (Likely due to rules already blocking it):', err);
      }
      // ───────────────────────────────────────────────────────────────────

      return true;
    }

    // 2. Fallback for Superadmins if Firestore is empty or for local dev
    // Once you've added yourself via the UI, we can remove this fallback
    const isHardcodedSuperAdmin = SUPERADMIN_PHONES.some(p => p.replace(/[^\d+]/g, '') === normalizedRaw);
    if (isHardcodedSuperAdmin) {
      setIsAdmin(true);
      setRole('superadmin');
      setPermissions(['all']); // Grant all permissions to hardcoded superadmins

      // Auto-heal for superadmins too
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists() && (userDoc.data().isAdmin !== true || userDoc.data().userType !== 'admin')) {
          await updateDoc(userRef, { 
            isAdmin: true,
            userType: 'admin'
          });
          console.log(`💎 Auto-synced SuperAdmin flags (isAdmin & userType) for ${normalizedRaw}`);
        }
      } catch (err) {}

      return true;
    }

    // IF WE REACH HERE, THE USER IS UNAUTHORIZED!
    console.warn(`Blocked unauthorized login attempt for ${normalizedRaw}`);
    setIsAdmin(false);
    setRole(null);
    setPermissions([]);
    setStaffData(null);
    
    // Forcefully sign them out and alert
    await logOut();
    setIsManualAuth(false);
    sessionStorage.removeItem('hydrant_manual_auth');
    localStorage.removeItem('hydrant_admin_session_id');
    
    alert('Access Denied: Number not approved for Admin access. Please contact the Super Admin.');
    
    return false;
  };

  useEffect(() => {
    // Check for existing manual session first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hydrant_manual_auth');
      if (saved) {
        const { phoneNumber, timestamp } = JSON.parse(saved);
        // Expire manual session after 48 hours
        if (Date.now() - timestamp < 48 * 60 * 60 * 1000) {
          loginWithWhatsApp(phoneNumber).then(() => {
            setLoading(false);
          });
          return;
        } else {
          sessionStorage.removeItem('hydrant_manual_auth');
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Don't overwrite if we just did a manual Login
      if (isManualAuth && !user) return;

      setCurrentUser(user);
      if (user) {
        await checkAdminPrivileges(user);
      } else {
        setIsAdmin(false);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [isManualAuth]);

  useEffect(() => {
    if (!isAdmin || !currentUser) return;

    let sessionUnsubscribe: (() => void) | null = null;
    let activeInterval: NodeJS.Timeout | null = null;

    const setupSession = async () => {
      try {
        const localStorageKey = 'hydrant_admin_session_id';
        let sessionId = localStorage.getItem(localStorageKey);
        
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem(localStorageKey, sessionId);
        }

        const sessionRef = doc(db, 'admin_sessions', sessionId);
        const sessionDoc = await getDoc(sessionRef);
        
        const userAgent = navigator.userAgent;
        let os = 'Unknown OS';
        if (userAgent.indexOf('Win') !== -1) os = 'Windows';
        else if (userAgent.indexOf('Mac') !== -1) os = 'macOS';
        else if (userAgent.indexOf('Linux') !== -1) os = 'Linux';
        else if (userAgent.indexOf('Android') !== -1) os = 'Android';
        else if (userAgent.indexOf('like Mac') !== -1) os = 'iOS';

        let browser = 'Unknown Browser';
        if (userAgent.indexOf('Firefox') !== -1) browser = 'Firefox';
        else if (userAgent.indexOf('Chrome') !== -1) browser = 'Chrome';
        else if (userAgent.indexOf('Safari') !== -1) browser = 'Safari';
        else if (userAgent.indexOf('Edge') !== -1) browser = 'Edge';

        const now = Date.now();
        let createdAtMs = now;
        if (sessionDoc.exists() && sessionDoc.data()?.createdAt) {
          const ca = sessionDoc.data()?.createdAt;
          if (typeof ca?.toMillis === 'function') {
            createdAtMs = ca.toMillis();
          } else if (ca instanceof Date) {
            createdAtMs = ca.getTime();
          } else {
            const parsed = new Date(ca).getTime();
            if (!isNaN(parsed) && parsed > 0) createdAtMs = parsed;
          }
        }
        
        const expiresAtMs = createdAtMs + 48 * 60 * 60 * 1000;
        let status = sessionDoc.exists() ? (sessionDoc.data()?.status || 'active') : 'active';
        
        if (now > expiresAtMs) {
          status = 'expired';
          console.log('⏰ Session expired automatically after 48 hours.');
        }

        const deviceIdKey = 'hydrant_device_id';
        let deviceId = localStorage.getItem(deviceIdKey);
        if (!deviceId) {
          deviceId = `dev_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem(deviceIdKey, deviceId);
        }

        const sessionData = {
          id: sessionId,
          uid: currentUser.uid,
          name: currentUser.displayName || staffData?.name || 'Admin User',
          phone: currentUser.phoneNumber || staffData?.phone || '',
          role: role,
          userAgent,
          os,
          browser,
          deviceId,
          createdAt: new Date(createdAtMs),
          expiresAt: new Date(expiresAtMs),
          lastActive: new Date(),
          status
        };

        await setDoc(sessionRef, sessionData, { merge: true });

        if (status === 'expired' || status === 'revoked') {
          localStorage.removeItem(localStorageKey);
          await signOut();
          window.location.href = '/';
          return;
        }

        // Set up real-time listener to detect if superadmin revoked session
        sessionUnsubscribe = onSnapshot(sessionRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const currentNow = Date.now();
            let currentExpiresMs = currentNow + 100000; // safe default
            
            if (data.expiresAt) {
              if (typeof data.expiresAt?.toMillis === 'function') {
                currentExpiresMs = data.expiresAt.toMillis();
              } else if (data.expiresAt instanceof Date) {
                currentExpiresMs = data.expiresAt.getTime();
              } else {
                const parsed = new Date(data.expiresAt).getTime();
                if (!isNaN(parsed) && parsed > 0) currentExpiresMs = parsed;
              }
            }
            
            if (data.status === 'revoked' || data.status === 'expired' || currentNow > currentExpiresMs) {
              console.log('🚫 Session revoked or expired!');
              if (currentNow > currentExpiresMs && data.status === 'active') {
                await updateDoc(sessionRef, { status: 'expired' });
              }
              localStorage.removeItem(localStorageKey);
              if (sessionUnsubscribe) {
                sessionUnsubscribe();
              }
              await signOut();
              window.location.href = '/';
            }
          }
        });

        // Periodically update lastActive
        activeInterval = setInterval(async () => {
          try {
            await updateDoc(sessionRef, { lastActive: new Date() });
          } catch (e) {
            console.error('Error updating session last active:', e);
          }
        }, 60 * 1000); // every minute

      } catch (err) {
        console.error('Error setting up admin session:', err);
      }
    };

    setupSession();

    return () => {
      if (sessionUnsubscribe) sessionUnsubscribe();
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [isAdmin, currentUser, role, staffData]);


  const value: AuthContextType = {
    currentUser,
    userData: currentUser ? {
      role: role,
      displayName: currentUser.displayName || (role === 'superadmin' ? 'Super Admin' : 'Admin User'),
      email: currentUser.email,
      photoURL: currentUser.photoURL,
      phoneNumber: currentUser.phoneNumber
    } : null,
    isAdmin,
    role,
    permissions,
    staffData,
    loading,
    signOut,
    checkAdminPrivileges,
    confirmationResult,
    setConfirmationResult,
    loginWithWhatsApp,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white', fontSize: '1.2rem', gap: '12px',
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>💧</span>
          Loading...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};