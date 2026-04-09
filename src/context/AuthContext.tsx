'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, logOut, SUPERADMIN_PHONES, getAdminDataByPhone, StaffMember } from '@/lib/firebase';
import { onAuthStateChanged, User, ConfirmationResult } from 'firebase/auth';

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
  loginWithWhatsApp: (phoneNumber: string) => void;
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

  const loginWithWhatsApp = (phoneNumber: string) => {
    // Mock a Firebase user object for the UI
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
    
    // Persist in session storage so refresh doesn't log them out immediately
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hydrant_manual_auth', JSON.stringify({ phoneNumber, timestamp: Date.now() }));
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
      return true;
    }

    // 2. Fallback for Superadmins if Firestore is empty or for local dev
    // Once you've added yourself via the UI, we can remove this fallback
    const isHardcodedSuperAdmin = SUPERADMIN_PHONES.some(p => p.replace(/[^\d+]/g, '') === normalizedRaw);
    if (isHardcodedSuperAdmin) {
      setIsAdmin(true);
      setRole('superadmin');
      setPermissions(['all']); // Grant all permissions to hardcoded superadmins
      return true;
    }

    setIsAdmin(false);
    setRole(null);
    setPermissions([]);
    setStaffData(null);
    return false;
  };

  useEffect(() => {
    // Check for existing manual session first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hydrant_manual_auth');
      if (saved) {
        const { phoneNumber, timestamp } = JSON.parse(saved);
        // Expire manual session after 2 hours
        if (Date.now() - timestamp < 2 * 60 * 60 * 1000) {
          loginWithWhatsApp(phoneNumber);
          setLoading(false);
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