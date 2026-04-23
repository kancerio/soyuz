import { Chat, Message } from '@/types/chat';
import { User } from '@/types/user';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// Загрузка токенов из sessionStorage при старте
if (typeof window !== 'undefined') {
  accessToken = sessionStorage.getItem('accessToken');
  refreshToken = sessionStorage.getItem('refreshToken');
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  sessionStorage.setItem('accessToken', access);
  sessionStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
}

// Универсальный запрос с автоматическим обновлением токена
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && retry && refreshToken) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTokens(data.accessToken, data.refreshToken);
        // Повторяем исходный запрос
        return request<T>(endpoint, options, false);
      } else {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } catch (e) {
      clearTokens();
      throw e;
    }
  }
  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return response.json();
}

// API методы
export const apiClient = {
  // Auth
  register: (data: { email: string; username: string; password: string }) =>
    request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; email: string; username: string; language: string };
    }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; email: string; username: string; language: string };
    }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  refresh: (refresh: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    }),

  //Users
  getUsers: () => request<User[]>('/users'),
  // Chats
  getChats: () => request<Chat[]>('/chats'),
  getChat: (id: number) => request<Chat>(`/chats/${id}`),
  createPrivateChat: (userId: number) =>
    request<Chat>(`/chats/private/${userId}`, { method: 'POST' }),
  createGroupChat: (title: string, participantIds: number[]) =>
    request<Chat>('/chats/group', { method: 'POST', body: JSON.stringify({ title, participantIds }) }),
  addParticipant: (chatId: number, userId: number) =>
    request<Chat>(`/chats/${chatId}/add/${userId}`, { method: 'POST' }),

  // Messages
  getMessages: (chatId: number, limit = 50, offset = 0) =>
    request<Message[]>(`/messages/chat/${chatId}?limit=${limit}&offset=${offset}`),
  sendMessage: (chatId: number, content: string) =>
    request<Message>(`/messages/chat/${chatId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  editMessage: (messageId: number, content: string) =>
    request<Message>(`/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (messageId: number) =>
    request<{ deleted: boolean }>(`/messages/${messageId}`, { method: 'DELETE' }),
};