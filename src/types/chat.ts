export interface Message {
  id: number;
  text?: string;      // для моков/групп
  content?: string;   // для бэкенда
  senderId?: number;  // для моков/групп
  userId?: number;    // для бэкенда
  chatId: number;
  timestamp?: Date;
  createdAt?: Date | string;
  status?: 'sent' | 'delivered' | 'read';
  isEdited?: boolean;
  isDeleted?: boolean;
}

export interface Chat {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
}