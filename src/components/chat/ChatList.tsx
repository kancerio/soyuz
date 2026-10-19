'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Chat } from '@/types/chat';
import { useLanguage } from '@/context/LanguageContext';

export default function ChatList() {
  const { t } = useLanguage();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const data = await apiClient.getChats();
        setChats(data);
      } catch (error) {
        console.error('Failed to fetch chats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  if (loading) return <div className="p-4 text-center">Загрузка...</div>;
  if (chats.length === 0)
    return <div className="p-4 text-center text-gray-500">Нет чатов</div>;

  return (
    <div className="flex flex-col h-full">
      {chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/chat/${chat.id}`}
          className={`p-4 border-b hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
            pathname === `/chat/${chat.id}` ? 'bg-gray-100 dark:bg-gray-700' : ''
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold">{chat.title || `Чат ${chat.id}`}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {chat.isGroup ? t('group_chat') : t('private_chat')}
              </p>
            </div>
            {/* lastMessage, unreadCount – нет в API, можно позже добавить */}
          </div>
        </Link>
      ))}
    </div>
  );
}