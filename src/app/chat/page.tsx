'use client';

import MainLayout from '@/components/layout/MainLayout';
import ChatList from '@/components/chat/ChatList';
import { useLanguage } from '@/context/LanguageContext';

export default function ChatListPage() {
  const { t } = useLanguage();
  return (
    <MainLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">{t('chats')}</h1>
        <ChatList />
      </div>
    </MainLayout>
  );
}