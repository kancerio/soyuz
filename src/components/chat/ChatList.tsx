'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Chat } from '@/types/chat';

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
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
              <h3 className="font-semibold">{chat.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {chat.lastMessage}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">
                {chat.lastMessageTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {chat.unreadCount > 0 && (
                <div className="mt-1 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {chat.unreadCount}
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}