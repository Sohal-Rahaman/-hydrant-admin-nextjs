'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, getUserData, signInWithGoogle, signInWithEmail, logOut } from '@/lib/firebase';
import { onAuthStateChanged, User, UserCredential } from 'firebase/auth';

interface UserData {
  id: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  isAdmin?: boolean;
  customerId?: string;
  walletBalance?: number;
  occupiedJars?: number;
  coins?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<UserCredential>;
  signInWithEmailPassword: (email: string, password: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  checkAdminPrivileges: (user: User | null) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Sign in with Google
  const signIn = async () => {
    try {
      const result = await signInWithGoogle();
      return result;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign in with email and password
  const signInWithEmailPassword = async (email: string, password: string) => {
    try {
      const result = await signInWithEmail(email, password);
      return result;
    } catch (error) {
      console.error('Email sign in error:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Check admin privileges
  const checkAdminPrivileges = async (user: User | null): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false);
      return false;
    }

    try {
      const data = await getUserData(user.uid) as UserData | null;
      if (data && data.isAdmin === true) {
        setIsAdmin(true);
        setUserData(data);
        return true;
      } else {
        setIsAdmin(false);
        setUserData(data);
        return false;
      }
    } catch (error) {
      console.error('Error checking admin privileges:', error);
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        await checkAdminPrivileges(user);
      } else {
        setUserData(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    isAdmin,
    loading,
    signIn,
    signInWithEmailPassword,
    signOut,
    checkAdminPrivileges
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};