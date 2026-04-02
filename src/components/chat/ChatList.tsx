'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Chat } from '@/types/chat';
import { mockChats } from '@/lib/mockData';

export default function ChatList() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {mockChats.map((chat) => (
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