export interface Message {
  id: number;
  text: string;
  senderId: number;
  chatId: number;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
}

export interface Chat {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
  // дополнительные поля по мере появления
}