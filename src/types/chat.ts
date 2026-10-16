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

  // --- Voice ---
  type?: MessageType; // default 'text'
  audioUrl?: string | null;
  localAudioUrl?: string | null; // blob: для optimistic UI
  transcript?: string | null;
  transcriptStatus?: TranscriptStatus;
  summary?: string | null;
  summaryStatus?: SummaryStatus;
  voiceMetadata?: VoiceMetadata | null;
  uploadStatus?: UploadStatus;
}