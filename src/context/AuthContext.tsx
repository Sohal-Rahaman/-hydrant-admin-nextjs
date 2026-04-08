'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, logOut, SUPERADMIN_PHONES } from '@/lib/firebase';
import { onAuthStateChanged, User, ConfirmationResult } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  role: 'superadmin' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkAdminPrivileges: (user: User | null) => Promise<boolean>;
  // Phone OTP state (managed here so AdminRoute stays clean)
  confirmationResult: ConfirmationResult | null;
  setConfirmationResult: (r: ConfirmationResult | null) => void;
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
  const [role, setRole]               = useState<'superadmin' | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const signOut = async () => { await logOut(); };

  const checkAdminPrivileges = async (user: User | null): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false);
      setRole(null);
      return false;
    }

    // Normalize: strip all non-digits except +, then compare
    const raw = user.phoneNumber || '';
    const normalizedRaw = raw.replace(/[^\d+]/g, '');
    const isSuperAdmin = SUPERADMIN_PHONES.some(p => p.replace(/[^\d+]/g, '') === normalizedRaw);

    if (isSuperAdmin) {
      setIsAdmin(true);
      setRole('superadmin');
      return true;
    }

    setIsAdmin(false);
    setRole(null);
    return false;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
  }, []);

  const value: AuthContextType = {
    currentUser,
    isAdmin,
    role,
    loading,
    signOut,
    checkAdminPrivileges,
    confirmationResult,
    setConfirmationResult,
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