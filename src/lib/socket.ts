import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initSocket(userId: number, token?: string): Socket {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const authToken =
      token ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null);

    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: authToken },
    });

    socket.connect();

    socket.on('connect', () => {
      console.log('[Socket] connected, authenticating...');
      const currentToken =
        token || (typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null);
      socket?.emit('auth', { userId, token: currentToken });
    });
    socket.on('auth_error', (err) => console.error('[Socket] auth error:', err));
    socket.on('connect_error', (err) => console.error('[Socket] error:', err));
    socket.on('disconnect', () => console.log('[Socket] disconnected'));
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
