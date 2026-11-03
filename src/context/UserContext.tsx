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
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Восстановление пользователя из sessionStorage
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
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
      language: res.user.language,
      country: '',
      status: '',
      privacySettings: { showLastSeen: true, showReadReceipts: true },
    };
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    router.push('/chat');
  };

  const register = async (email: string, username: string, password: string) => {
    const res = await apiClient.register({ email, username, password });
    setTokens(res.accessToken, res.refreshToken);
    const userData: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.username,
      language: res.user.language,
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

  return (
    <UserContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};