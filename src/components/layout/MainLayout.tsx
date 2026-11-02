'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SoyuzLogo from '@/components/ui/SoyuzLogo';
import Avatar from '@/components/ui/Avatar';
import LoadingState from '@/components/ui/LoadingState';
import CreateChatModal from '@/components/chat/CreateChatModal';
import CreateGroupModal from '@/components/chat/CreateGroupModal';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAuthPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, isLoading, isAuthPage, router]);

  // Слушатель событий открытия создания чатов из других компонентов
  useEffect(() => {
    const handleOpenCreateChat = () => setIsCreateChatOpen(true);
    const handleOpenCreateGroup = () => setIsCreateGroupOpen(true);

    window.addEventListener('open-create-chat', handleOpenCreateChat);
    window.addEventListener('open-create-group', handleOpenCreateGroup);

    return () => {
      window.removeEventListener('open-create-chat', handleOpenCreateChat);
      window.removeEventListener('open-create-group', handleOpenCreateGroup);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f4ff] dark:bg-[#0b1026]">
        <LoadingState text="Запуск Союза…" size="lg" />
      </div>
    );
  }

  if (isAuthPage) return <>{children}</>;
  if (!user) return null;

  const refreshChats = () => setRefreshKey((prev) => prev + 1);

  const isChatActive = pathname.startsWith('/chat');
  const isProfileActive = pathname === '/profile';
  const isSettingsActive = pathname === '/settings';

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#f0f4ff] dark:bg-[#0b1026]">
      {/* ========================================================= */}
      {/* Desktop левая узкая навигационная панель (макет Союз)   */}
      {/* ========================================================= */}
      <aside className="hidden md:flex w-20 flex-col items-center justify-between py-6 bg-white dark:bg-[#0d1230] border-r border-[#dde4f0] dark:border-[#1e2955] z-30 shrink-0 select-none shadow-sm">
        {/* Логотип приложения вверху */}
        <div className="flex flex-col items-center gap-6">
          <Link href="/chat" title="Главная" className="transition-transform hover:scale-105">
            <SoyuzLogo size="md" />
          </Link>

          {/* Вертикальные вкладки навигации */}
          <nav className="flex flex-col items-center gap-4 mt-2">
            {/* Вкладка Чаты */}
            <Link
              href="/chat"
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 group ${
                isChatActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-[#6070a0] dark:text-[#7b8db5] hover:bg-gray-100 dark:hover:bg-[#1a2248] hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title="Чаты"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Чаты</span>

              {/* Бейдж непрочитанных сообщений */}
              <span className="absolute top-1 right-1 w-4 h-4 bg-sky-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </Link>

            {/* Вкладка Профиль */}
            <Link
              href="/profile"
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 ${
                isProfileActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-[#6070a0] dark:text-[#7b8db5] hover:bg-gray-100 dark:hover:bg-[#1a2248] hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title="Профиль"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Профиль</span>
            </Link>

            {/* Вкладка Настройки */}
            <Link
              href="/settings"
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 ${
                isSettingsActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-[#6070a0] dark:text-[#7b8db5] hover:bg-gray-100 dark:hover:bg-[#1a2248] hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title="Настройки"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Настройки</span>
            </Link>
          </nav>
        </div>

        {/* Нижний блок: Переключатель темы + Аватар */}
        <div className="flex flex-col items-center gap-4">
          <ThemeToggle />
          <Link href="/profile" title={user.name || user.email}>
            <Avatar name={user.name || user.email} src={user.avatar} size="sm" isOnline />
          </Link>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* Основная рабочая область контента                         */}
      {/* ========================================================= */}
      <main className="flex-1 flex overflow-hidden relative" key={refreshKey}>
        {children}
      </main>

      {/* ========================================================= */}
      {/* Mobile Нижняя панель навигации (Bottom Bar)               */}
      {/* ========================================================= */}
      <nav className="md:hidden flex items-center justify-around py-2 bg-white dark:bg-[#0d1230] border-t border-[#dde4f0] dark:border-[#1e2955] z-30 shrink-0">
        <Link
          href="/chat"
          className={`flex flex-col items-center py-1 px-3 rounded-xl ${
            isChatActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-[10px] mt-0.5">Чаты</span>
        </Link>

        <Link
          href="/profile"
          className={`flex flex-col items-center py-1 px-3 rounded-xl ${
            isProfileActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] mt-0.5">Профиль</span>
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center py-1 px-3 rounded-xl ${
            isSettingsActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] mt-0.5">Настройки</span>
        </Link>

        <div className="py-1 px-3">
          <ThemeToggle />
        </div>
      </nav>

      {/* Модальные окна */}
      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        onChatCreated={refreshChats}
      />
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={refreshChats}
      />
    </div>
  );
}
