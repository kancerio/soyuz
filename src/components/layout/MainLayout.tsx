'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import CreateChatModal from '@/components/chat/CreateChatModal';
import CreateGroupModal from '@/components/chat/CreateGroupModal';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // редирект, если нет пользователя
  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, isLoading, isAuthPage, router]);

  if (isLoading) return <div className="flex items-center justify-center h-screen">Загрузка...</div>;
  if (isAuthPage) return <>{children}</>;
  if (!user) return null;

  const refreshChats = () => setRefreshKey(prev => prev + 1);


  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold">{t('app_name')}</h1>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setIsCreateChatOpen(true)}
              className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              title="Новый личный чат"
            >
              + Личный
            </button>
            <button
              onClick={() => setIsCreateGroupOpen(true)}
              className="text-sm bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
              title="Создать группу"
            >
              + Группа
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/chat" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('chats')}
          </Link>
          <Link href="/profile" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('profile')}
          </Link>
          <Link href="/settings" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('settings')}
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto" key={refreshKey}>
        {children}
      </main>
      <CreateChatModal isOpen={isCreateChatOpen} onClose={() => setIsCreateChatOpen(false)} onChatCreated={refreshChats} />
      <CreateGroupModal isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} onGroupCreated={refreshChats} />
    </div>
  );
}