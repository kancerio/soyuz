'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, setTokens, clearTokens } from '@/lib/apiClient';
import { disconnectSocket } from '@/lib/socket';
import { User } from '@/types/user';

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, preferred_language?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  changeLanguage: (lang: 'ru' | 'en') => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Битая сессия — сбрасываем, остаёмся неавторизованными
        sessionStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.login({ email, password });
    setTokens(res.accessToken, res.refreshToken);
    const userData: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.username,
      language: res.user.language || 'ru',
      country: '',
      status: '',
      privacySettings: { showLastSeen: true, showReadReceipts: true },
    };
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    router.push('/chat');
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    preferred_language: string = 'ru'
  ) => {
    const res = await apiClient.register({
      email,
      username,
      password,
      preferred_language,
    });
    setTokens(res.accessToken, res.refreshToken);
    const userData: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.username,
      language: res.user.language || preferred_language,
      country: '',
      status: '',
      privacySettings: { showLastSeen: true, showReadReceipts: true },
    };
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    router.push('/chat');
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {}
    clearTokens();
    disconnectSocket();
    setUser(null);
    sessionStorage.removeItem('user');
    router.push('/login');
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...data };
      setUser(newUser);
      sessionStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  const changeLanguage = async (newLang: 'ru' | 'en') => {
    try {
      await apiClient.updateLanguage(newLang);
    } catch (e) {
      console.warn('Backend updateLanguage skipped:', e);
    }
    if (user) {
      const updated = { ...user, language: newLang };
      setUser(updated);
      sessionStorage.setItem('user', JSON.stringify(updated));
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        changeLanguage,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
