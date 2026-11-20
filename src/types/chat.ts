export type TranslateStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export type MessageType = 'text' | 'voice';

export type TranscriptStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export type SummaryStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'not_needed';

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'error'
  | 'cancelled';

/** Персональный перевод сообщения на язык конкретного получателя */
export interface MessageTranslation {
  text: string;
  status: 'completed' | 'failed';
}

/** Строительный термин из AI /construction-terms (start/end — UTF-16 смещения JS-строки) */
export interface ConstructionTerm {
  term: string;
  start: number;
  end: number;
  definition: string;
  country_code: string;
  source_title: string;
  source_url: string;
  source_language: string;
}

export type ConstructionTermsStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'error';

export interface VoiceMetadata {
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
}

export interface Message {
  // --- Базовые ---
  id: number;
  content: string;
  senderId: number;
  chatId: number;
  timestamp: Date;
  createdAt?: Date | string;
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
  /** Персональные переводы на язык каждого получателя: { en: {text, status}, ... } */
  translations?: Record<string, MessageTranslation> | null;

  // --- Локальный статус отправки (только на фронте) ---
  localStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';

  // --- Voice ---
  type?: MessageType;
  voiceFileId?: string | null;
  audioUrl?: string | null;
  localAudioUrl?: string | null;
  transcript?: string | null;
  transcriptStatus?: TranscriptStatus;
  summary?: string | null;
  summaryStatus?: SummaryStatus;
  voiceMetadata?: VoiceMetadata | null;
  uploadStatus?: UploadStatus;
}

export interface Chat {
  id: number;
  title: string | null;
  isGroup: boolean;
  isChannel?: boolean;
  createdAt: Date;
}

/** WebSocket: transcript готов / ошибка */
export type MessageTranscribedPayload = {
  messageId: number;
  chatId: number;
  transcript: string;
  transcriptStatus: 'completed' | 'failed';
};

/** WebSocket: voice summary готов / ошибка / не нужен */
export type MessageVoiceSummaryPayload = {
  messageId: number;
  chatId: number;
  summary: string;
  summaryStatus: 'completed' | 'failed' | 'not_needed';
};