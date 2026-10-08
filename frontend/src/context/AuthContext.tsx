import React, { createContext, useContext, useEffect, useState } from 'react';
import { StaffUser } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: StaffUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    api.auth
      .me()
      .then((curr) => {
        if (isMounted) setUser(curr);
      })
      .catch((err) => {
        console.error('Failed to load current staff user', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password = ''): Promise<StaffUser> => {
    setLoading(true);
    try {
      const loggedIn = await api.auth.login(email, password);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshMe = async () => {
    const updated = await api.auth.me();
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
