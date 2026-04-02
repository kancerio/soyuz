import { Chat, Message } from '@/types/chat';

export const mockChats: Chat[] = [
  {
    id: '1',
    name: 'Анна',
    type: 'personal',
    lastMessage: 'Привет! Как дела?',
    lastMessageTime: new Date('2025-04-01T10:30:00'),
    unreadCount: 2,
    participants: ['user1', 'user2'],
  },
  {
    id: '2',
    name: 'Работа',
    type: 'group',
    lastMessage: 'Встреча завтра в 11:00',
    lastMessageTime: new Date('2025-04-01T09:15:00'),
    unreadCount: 0,
    participants: ['user1', 'user3', 'user4'],
  },
  {
    id: '3',
    name: 'Друзья',
    type: 'group',
    lastMessage: 'Кто идет в кино?',
    lastMessageTime: new Date('2025-03-31T20:45:00'),
    unreadCount: 5,
    participants: ['user1', 'user5', 'user6'],
  },
];

export const mockMessages: Record<string, Message[]> = {
  '1': [
    { id: 'm1', chatId: '1', text: 'Привет!', senderId: 'user2', timestamp: new Date('2025-04-01T10:00:00'), status: 'read' },
    { id: 'm2', chatId: '1', text: 'Как дела?', senderId: 'user2', timestamp: new Date('2025-04-01T10:05:00'), status: 'read' },
    { id: 'm3', chatId: '1', text: 'Нормально, работаю', senderId: 'user1', timestamp: new Date('2025-04-01T10:30:00'), status: 'read' },
  ],
  '2': [
    { id: 'm4', chatId: '2', text: 'Коллеги, напоминаю про дедлайн', senderId: 'user3', timestamp: new Date('2025-04-01T09:00:00'), status: 'read' },
    { id: 'm5', chatId: '2', text: 'Встреча завтра в 11:00', senderId: 'user4', timestamp: new Date('2025-04-01T09:15:00'), status: 'read' },
  ],
  '3': [
    { id: 'm6', chatId: '3', text: 'Предлагаю сходить на новый фильм', senderId: 'user5', timestamp: new Date('2025-03-31T20:00:00'), status: 'read' },
    { id: 'm7', chatId: '3', text: 'Кто идет в кино?', senderId: 'user6', timestamp: new Date('2025-03-31T20:45:00'), status: 'read' },
  ],
};