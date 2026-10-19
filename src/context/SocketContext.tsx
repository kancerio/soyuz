'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initSocket } from '@/lib/socket';
import { useUser } from './UserContext';

interface SocketContextType {
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Инициализируем сокет (если уже создан – вернёт существующий)
    const socket = initSocket(user.id);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketStatus = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketStatus must be used within SocketProvider');
  return ctx;
};