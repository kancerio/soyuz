import { Chat, Message, TranslateStatus, TranscriptStatus, SummaryStatus } from '@/types/chat';
import { User } from '@/types/user';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let accessToken: string | null = null;
let refreshToken: string | null = null;

if (typeof window !== 'undefined') {
  accessToken = sessionStorage.getItem('accessToken');
  refreshToken = sessionStorage.getItem('refreshToken');
}

export interface AssistResponse {
  originalText: string;
  resultText: string;
  action: 'shorten' | 'formal' | 'friendly';
  status: 'completed' | 'failed';
  mock: boolean;
}

export interface SummaryResponse {
  summary: string;
  decisions: string[];
  participants: string[];
  language: string;
  provider: string;
  status: 'completed' | 'failed';
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
  const isMultipart =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  // FormData: браузер сам выставит boundary — JSON Content-Type НЕ ставить
  if (options.body && !isMultipart && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

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
      errorMsg = Array.isArray(body.message)
        ? body.message.join(', ')
        : (body.message || errorMsg);
    } catch {}
    throw new Error(errorMsg);
  }
  return response.json();
}

function mapSttStatus(stt?: string): TranscriptStatus {
  if (stt === 'pending') return 'processing';
  if (stt === 'none' || !stt) return 'skipped';
  if (stt === 'completed' || stt === 'failed') return stt;
  return 'skipped';
}

function mapSummaryStatus(s?: string): SummaryStatus {
  if (s === 'pending') return 'processing';
  if (s === 'none' || !s) return 'not_needed';
  if (s === 'completed' || s === 'failed') return s;
  return 'not_needed';
}

/** Единый маппинг backend → Message (история + realtime) */
export function mapBackendMessage(m: any): Message {
  const voiceFileId = m.voiceFileId ?? null;
  const isVoice = Boolean(voiceFileId);

  return {
    id: m.id,
    content: m.content ?? '',
    senderId: m.userId ?? m.senderId ?? 0,
    chatId: m.chatId,
    timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
    isEdited: m.isEdited ?? false,
    isDeleted: m.isDeleted ?? false,
    isDelivered: m.isDelivered ?? false,
    isRead: m.isRead ?? false,
    readAt: m.readAt ?? null,

    originalText: m.originalText ?? m.content ?? null,
    sourceLang: m.sourceLang ?? null,
    translatedText: m.translatedText ?? null,
    targetLang: m.targetLang ?? null,
    translateStatus: (m.translateStatus as TranslateStatus) ?? 'pending',

    type: isVoice ? 'voice' : (m.type ?? 'text'),
    voiceFileId,
    audioUrl: voiceFileId ? apiClient.voiceFileUrl(voiceFileId) : (m.audioUrl ?? null),
    localAudioUrl: m.localAudioUrl ?? null,
    transcript: m.transcript ?? null,
    transcriptStatus: m.transcriptStatus
      ? (m.transcriptStatus as TranscriptStatus)
      : mapSttStatus(m.sttStatus),
    summary: m.voiceSummary ?? m.summary ?? null,
    summaryStatus: m.summaryStatus
      ? mapSummaryStatus(m.summaryStatus)
      : 'not_needed',
    voiceMetadata: isVoice
      ? {
          durationMs: Number(m.voiceDuration ?? 0) * 1000 || Number(m.voiceMetadata?.durationMs ?? 0),
          mimeType: m.voiceMimeType ?? m.voiceMetadata?.mimeType ?? 'audio/webm',
          sizeBytes: Number(m.voiceSize ?? m.voiceMetadata?.sizeBytes ?? 0),
        }
      : null,
    uploadStatus: isVoice ? 'uploaded' : undefined,
  };
}

export const apiClient = {
  voiceFileUrl: (voiceFileId: string) =>
    `${API_BASE}/messages/voice/${encodeURIComponent(voiceFileId)}`,

  getVoiceAudio: async (voiceFileId: string): Promise<Blob> => {
    const headers = new Headers();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await fetch(apiClient.voiceFileUrl(voiceFileId), { headers });
    if (!response.ok) throw new Error(`Не удалось загрузить аудио: ${response.status}`);
    return response.blob();
  },

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

  getUsers: () => request<User[]>('/users'),

  // Chats — только backend, без mockGroupStore
  getChats: () => request<Chat[]>('/chats'),

  getChat: (id: number) => request<Chat>(`/chats/${id}`),

  createPrivateChat: (userId: number) =>
    request<Chat>(`/chats/private/${userId}`, { method: 'POST' }),

  createGroupChat: (title: string, participantIds: number[]) =>
    request<Chat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify({ title, participantIds }),
    }),

  getChatMembers: (chatId: number) =>
    request<Array<{ userId: number; role: string }>>(`/chats/${chatId}/members`),

  updateMemberRole: (chatId: number, userId: number, role: string) =>
    request<{ userId: number; chatId: number; role: string }>(
      `/chats/${chatId}/members/${userId}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) }
    ),

  leaveGroup: (chatId: number) =>
    request<{ message: string }>(`/chats/${chatId}/members/me`, {
      method: 'DELETE',
    }),

  removeMember: (chatId: number, userId: number) =>
    request<unknown>(`/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
    }),

  addParticipant: (chatId: number, userId: number) =>
    request<unknown>(`/chats/${chatId}/members/${userId}`, {
      method: 'POST',
    }),

  getMessages: async (chatId: number, limit = 50, offset = 0) => {
    const data = await request<any[]>(
      `/messages/chat/${chatId}?limit=${limit}&offset=${offset}`
    );
    return data.map(mapBackendMessage);
  },

  sendMessage: async (
    chatId: number,
    content: string,
    sourceLang = 'auto',
    targetLang?: string
  ) => {
    const body: any = { content, sourceLang };
    if (targetLang) body.targetLang = targetLang;
    const data = await request<any>(`/messages/chat/${chatId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapBackendMessage(data);
  },

  editMessage: (messageId: number, content: string) =>
    request<Message>(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId: number) =>
    request<{ deleted: boolean }>(`/messages/${messageId}`, { method: 'DELETE' }),

  assistText: async (
    text: string,
    action: 'shorten' | 'formal' | 'friendly'
  ): Promise<AssistResponse> => {
    return request<AssistResponse>('/messages/assist', {
      method: 'POST',
      body: JSON.stringify({ text, action }),
    });
  },

  translateText: (text: string, sourceLang: string, targetLang: string) =>
    request<{
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      status: 'completed' | 'failed';
      mock: boolean;
    }>('/messages/translate', {
      method: 'POST',
      body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
    }),

  summarizeMessages: (
    language: string,
    messages: Array<{ sender_id: string; text: string; timestamp?: string }>
  ) =>
    request<SummaryResponse>('/messages/summary', {
      method: 'POST',
      body: JSON.stringify({ language, messages }),
    }),

  transcribeAudio: async (file: Blob, language: string) => {
    const formData = new FormData();
    const extension = file.type.includes('wav')
      ? 'wav'
      : file.type.includes('ogg')
        ? 'ogg'
        : file.type.includes('mpeg') || file.type.includes('mp3')
          ? 'mp3'
          : file.type.includes('mp4') || file.type.includes('m4a')
            ? 'm4a'
            : 'webm';
    formData.append('file', file, `audio.${extension}`);
    formData.append('language', language);
    return request<{
      transcript: string;
      summary?: string;
      language: string;
      status: 'completed' | 'failed';
    }>('/messages/transcribe', { method: 'POST', body: formData });
  },

  sendVoiceMessage: async (
    chatId: number,
    file: Blob,
    meta: { durationMs: number; mimeType: string },
    signal?: AbortSignal
  ) => {
    const formData = new FormData();
    const extension = meta.mimeType.includes('webm')
      ? 'webm'
      : meta.mimeType.includes('ogg')
        ? 'ogg'
        : meta.mimeType.includes('wav')
          ? 'wav'
          : meta.mimeType.includes('mpeg') || meta.mimeType.includes('mp3')
            ? 'mp3'
            : 'm4a';
    formData.append('file', file, `voice.${extension}`);
    formData.append('duration', String(Math.round(meta.durationMs / 1000)));

    const message = await request<any>(`/messages/chat/${chatId}/voice`, {
      method: 'POST',
      body: formData,
      signal,
    });

    const voiceFileId = message.voiceFileId;
    if (!voiceFileId) throw new Error('Backend did not return a voice file id');

    return {
      id: message.id,
      chatId: message.chatId,
      userId: message.userId,
      voiceFileId,
      audioUrl: apiClient.voiceFileUrl(voiceFileId),
      durationMs: Number(message.voiceDuration ?? 0) * 1000 || meta.durationMs,
      mimeType: message.voiceMimeType ?? meta.mimeType,
      sttStatus: message.sttStatus ?? 'pending',
      summaryStatus: message.summaryStatus ?? 'pending',
    };
  },
};