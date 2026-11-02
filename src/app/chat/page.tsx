'use client';

import MainLayout from '@/components/layout/MainLayout';
import ChatList from '@/components/chat/ChatList';
import EmptyState from '@/components/ui/EmptyState';

export default function ChatListPage() {
  return (
    <MainLayout>
      <div className="flex w-full h-full overflow-hidden">
        {/* Список чатов */}
        <div className="w-full md:w-80 lg:w-96 h-full shrink-0">
          <ChatList />
        </div>

        {/* Пустое состояние справа на Desktop */}
        <div className="hidden md:flex flex-1 h-full items-center justify-center bg-gray-50/50 dark:bg-[#0b1026]">
          <EmptyState />
        </div>
      </div>
    </MainLayout>
  );
}
