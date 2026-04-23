// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initSocket(userId: number): Socket {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    socket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: false });
    socket.connect();
    socket.on('connect', () => {
      console.log('Socket connected');
      socket?.emit('auth', { userId });
    });
    socket.on('connect_error', (err) => console.error('Socket error:', err));
  }
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}