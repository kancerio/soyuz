import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUserId: number | null = null;
let authErrorHandler: (() => void) | null = null;
let lastAuthErrorAt = 0;

export function initSocket(userId: number, token?: string): Socket {
  if (!socket) {
    currentUserId = userId;
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
      emitAuth();
    });

    socket.on('auth_error', (err) => {
      console.error('[Socket] auth error:', err);
      // Токен мог протухнуть (access token живёт 15 мин): просим обновить
      // пару токенов и переподписаться. Защита от частых повторов.
      const now = Date.now();
      if (now - lastAuthErrorAt > 10_000) {
        lastAuthErrorAt = now;
        authErrorHandler?.();
      }
    });
    socket.on('connect_error', (err) => console.error('[Socket] error:', err));
    socket.on('disconnect', () => console.log('[Socket] disconnected'));
  }
  return socket;
}

function emitAuth() {
  if (!socket) return;
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
  socket.emit('auth', { userId: currentUserId, token });
}

/** Повторная авторизация с актуальным токеном — вызывать после refresh. */
export function reauthSocket() {
  if (socket && socket.connected) emitAuth();
}

/** Обработчик ошибок авторизации: обычно запуск refresh токенов. */
export function setSocketAuthErrorHandler(handler: (() => void) | null) {
  authErrorHandler = handler;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
}
