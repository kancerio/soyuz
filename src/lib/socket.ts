import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUserId: number | null = null;
let authErrorHandler: (() => void) | null = null;
let lastAuthErrorAt = 0;
let authed = false;
let authWaiters: Array<() => void> = [];

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
      authed = false;
      emitAuth();
    });

    socket.on('auth_success', () => {
      authed = true;
      const waiters = authWaiters;
      authWaiters = [];
      waiters.forEach((fn) => fn());
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
    socket.on('disconnect', () => {
      authed = false;
      console.log('[Socket] disconnected');
    });
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

/**
 * Резолвится, когда сокет авторизован (auth_success).
 * Нужен, чтобы события вроде join_chat не уходили на сервер раньше auth
 * и не получали отказ «Not authenticated».
 */
export function whenSocketAuthed(timeoutMs = 5000): Promise<boolean> {
  if (!socket || !socket.connected) return Promise.resolve(false);
  if (authed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      authWaiters = authWaiters.filter((f) => f !== done);
      resolve(true);
    };
    const timer = setTimeout(() => {
      authWaiters = authWaiters.filter((f) => f !== done);
      resolve(false);
    }, timeoutMs);
    authWaiters.push(done);
  });
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
