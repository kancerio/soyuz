export type TranslateStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface Message {
  // --- Базовые ---
  id: number;
  content: string;
  senderId: number;      // маппится из userId
  chatId: number;
  timestamp: Date;       // маппится из createdAt
  isEdited?: boolean;
  isDeleted?: boolean;

  // --- Доставка / прочтение ---
  isDelivered?: boolean;
  isRead?: boolean;
  readAt?: string | null;

  // --- AI перевод ---
  originalText?: string | null;
  sourceLang?: string | null;
  translatedText?: string | null;
  targetLang?: string | null;
  translateStatus?: TranslateStatus;

  // --- Локальный статус отправки (только на фронте) ---
  localStatus?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface Chat {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
}