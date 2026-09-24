export type TranslationStatus = 'idle' | 'translating' | 'done' | 'error';

export interface Message {
  // --- Базовые поля (совместимы с backend) ---
  id: number;
  text: string;
  senderId: number;
  chatId: number;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  isEdited?: boolean;
  isDeleted?: boolean;

  // --- AI: перевод (новые поля) ---
  translatedText?: string | null;
  translationStatus?: TranslationStatus;
  translationError?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
}

export interface Chat {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
}