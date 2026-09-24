import { Chat, Message } from '@/types/chat';
import { User } from '@/types/user';
import { mockGroupStore } from './mockGroupStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

if (typeof window !== 'undefined') {
  accessToken = sessionStorage.getItem('accessToken');
  refreshToken = sessionStorage.getItem('refreshToken');
}

export interface TextOperationResponse {
  input_text: string;
  result: string;
  action: 'translate' | 'shorten' | 'formal' | 'friendly';
  source_lang: string | null;
  target_lang: string | null;
  correlation_id: string;
  mock: boolean;
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

  // Users
  getUsers: () => request<User[]>('/users'),

  // Chats (объединяем реальные чаты и группы из хранилища)
  getChats: async () => {
    const realChats = await request<Chat[]>('/chats');

    const allGroups = mockGroupStore.getGroups();
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

    const userGroups = allGroups.filter(group =>
      group.members.some(member => member.userId === currentUser.id)
    );

    const groupChats: Chat[] = userGroups.map(group => ({
      id: group.id,
      title: group.title,
      isGroup: true,
      createdAt: new Date(),
    }));

    return [...realChats, ...groupChats];
  },
  getChat: async (id: number) => {
    const group = mockGroupStore.getGroup(id);
    if (group) {
      return { id: group.id, title: group.title, isGroup: true, createdAt: new Date() } as Chat;
    }
    return request<Chat>(`/chats/${id}`);
  },
  createPrivateChat: (userId: number) =>
    request<Chat>(`/chats/private/${userId}`, { method: 'POST' }),
  addParticipant: (chatId: number, userId: number) =>
    request<Chat>(`/chats/${chatId}/add/${userId}`, { method: 'POST' }),

  // Группы (заглушки)
  createGroupChat: async (title: string, participantIds: number[]) => {
    const allUsers = await apiClient.getUsers();
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const newGroup = mockGroupStore.createGroup(title, currentUser.id, participantIds, allUsers);
    return { id: newGroup.id, title: newGroup.title, isGroup: true, createdAt: new Date() } as Chat;
  },
  getChatMembers: async (chatId: number) => {
    return mockGroupStore.getMembers(chatId);
  },
  updateMemberRole: async (chatId: number, userId: number, role: string) => {
    mockGroupStore.updateMemberRole(chatId, userId, role as any);
  },
  leaveGroup: async (chatId: number) => {
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    mockGroupStore.removeMember(chatId, currentUser.id);
    return { success: true };
  },
  removeMember: async (chatId: number, userId: number) => {
    mockGroupStore.removeMember(chatId, userId);
    return { success: true };
  },

  // Messages (разделяем личные и групповые)
  getMessages: async (chatId: number, limit = 50, offset = 0) => {
    const group = mockGroupStore.getGroup(chatId);
    if (group) {
      const msgs = mockGroupStore.getMessages(chatId);
      const mapped: Message[] = msgs.map(msg => ({
        id: msg.id,
        content: msg.text,
        userId: msg.senderId,
        chatId: msg.chatId,
        createdAt: msg.timestamp,
        isEdited: false,
        isDeleted: false,
      }));
      return mapped.slice(offset, offset + limit);
    }
    return request<Message[]>(`/messages/chat/${chatId}?limit=${limit}&offset=${offset}`);
  },

  sendMessage: async (chatId: number, content: string) => {
    const group = mockGroupStore.getGroup(chatId);
    if (group) {
      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      const newMessage = {
        id: Date.now(),
        text: content,
        senderId: currentUser.id,
        chatId,
        timestamp: new Date(),
      };
      mockGroupStore.addMessage(chatId, newMessage);
      return {
        id: newMessage.id,
        content: newMessage.text,
        userId: newMessage.senderId,
        chatId: newMessage.chatId,
        createdAt: newMessage.timestamp,
        isEdited: false,
        isDeleted: false,
      } as Message;
    }
    return request<Message>(`/messages/chat/${chatId}`, { method: 'POST', body: JSON.stringify({ content }) });
  },

  editMessage: (messageId: number, content: string) =>
    request<Message>(`/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (messageId: number) =>
    request<{ deleted: boolean }>(`/messages/${messageId}`, { method: 'DELETE' }),

  // --- AI: перевод (заглушка до появления backend-прокси) ---
  translateMessage: async (
    text: string,
    sourceLang: string,
    targetLang: string,
    correlationId?: string
  ): Promise<TextOperationResponse> => {
    // TODO: заменить на вызов через NestJS: POST /ai/translate
    // Сейчас — эмуляция AI-сервиса v0.2 (mock)
    await new Promise(r => setTimeout(r, 800));

    // Эмуляция ошибки 503 для теста: если текст содержит "fail"
    if (text.toLowerCase().includes('fail')) {
      const err: any = new Error('AI provider unavailable');
      err.code = 'ai_provider_unavailable';
      err.status = 503;
      throw err;
    }

    return {
      input_text: text,
      result: `[${sourceLang}->${targetLang}] ${text}`,
      action: 'translate',
      source_lang: sourceLang,
      target_lang: targetLang,
      correlation_id: correlationId || `msg-${Date.now()}`,
      mock: true,
    };
  },
};