import { User } from '@/types/user';

export const currentUser: User = {
  id: 'user1',
  email: 'user@example.com',
  name: 'Алексей',
  avatar: '',
  country: 'ru',
  language: 'ru',
  status: 'Доступен',
  privacySettings: {
    showLastSeen: true,
    showReadReceipts: true,
  },
};