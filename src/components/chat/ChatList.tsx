'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { Chat } from '@/types/chat';
import Avatar from '@/components/ui/Avatar';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';

interface ChatListProps {
  onSelectChat?: (id: number) => void;
  className?: string;
}

export default function ChatList({ onSelectChat, className = '' }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'channel'>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab');
      if (tabParam === 'direct' || tabParam === 'group' || tabParam === 'channel' || tabParam === 'all') {
        setActiveTab(tabParam);
      }
    }
  }, []);
  const pathname = usePathname();

  const fetchChats = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.getChats();
      setChats(data ?? []);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      setLoadError('Не удалось загрузить чаты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const isChannel = (chat: Chat) =>
    chat.id === 8 ||
    (chat.title?.toLowerCase().includes('новост') ?? false) ||
    (chat.title?.toLowerCase().includes('канал') ?? false);

  const openCreateChat = () => {
    window.dispatchEvent(new CustomEvent('open-create-chat'));
  };

  const openCreateGroup = () => {
    window.dispatchEvent(new CustomEvent('open-create-group'));
  };

  // Фильтрация чатов по вкладкам и поиску
  const filteredChats = chats.filter((chat) => {
    const title = chat.title || `Чат ${chat.id}`;
    const matchesSearch = title.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'direct') return !chat.isGroup;
    if (activeTab === 'group') return chat.isGroup && !isChannel(chat);
    if (activeTab === 'channel') return isChannel(chat);
    return true;
  });

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-[#111640] border-r border-[#dde4f0] dark:border-[#1e2955] select-none ${className}`}
    >
      {/* ========================================================= */}
      {/* Шапка: Поиск и кнопка создания                           */}
      {/* ========================================================= */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center gap-2">
          {/* Поле поиска с Ctrl+K */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Поиск по чатам…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-14 py-2 text-xs rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-gray-400 bg-gray-200/60 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-300/60 dark:border-gray-700">
              Ctrl + K
            </span>
          </div>

          {/* Кнопки создания */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openCreateChat}
              title="Новый личный чат"
              className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openCreateGroup}
              title="Создать группу"
              className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Табы категорий (Все, Личные, Группы, Каналы)              */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between border-b border-[#dde4f0] dark:border-[#1e2955] text-xs font-medium text-[#6070a0] dark:text-[#7b8db5]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'all'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Все
              {activeTab === 'all' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'direct'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Личные
              {activeTab === 'direct' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('group')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'group'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Группы
              {activeTab === 'group' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('channel')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'channel'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Каналы
              {activeTab === 'channel' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          </div>

          <button
            type="button"
            className="pb-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Фильтры"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Список карточек чатов                                     */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingState text="Загрузка чатов…" />
          </div>
        ) : loadError ? (
          <div className="py-12 px-4">
            <ErrorState message={loadError} onRetry={fetchChats} />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6070a0] dark:text-[#7b8db5] px-4">
            {search
              ? 'Ничего не найдено по вашему запросу'
              : activeTab === 'channel'
              ? 'Каналов в этой категории пока нет.'
              : activeTab === 'group'
              ? 'Групповых чатов пока нет.'
              : activeTab === 'direct'
              ? 'Личных диалогов пока нет.'
              : 'Чатов пока нет. Нажмите + выше, чтобы создать диалог.'}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = pathname === `/chat/${chat.id}`;
            const isChan = isChannel(chat);
            const title = chat.title || (isChan ? `Канал #${chat.id}` : chat.isGroup ? `Группа #${chat.id}` : `Личный чат #${chat.id}`);
            const subtitle = isChan ? 'Официальный канал' : chat.isGroup ? 'Групповой диалог' : 'Личная переписка';

            return (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                onClick={() => onSelectChat && onSelectChat(chat.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-150 relative group ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
                }`}
              >
                {/* Аватар чата */}
                <Avatar name={title} size="md" isOnline={!chat.isGroup && !isChan} />

                {/* Основная инфа */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3
                      className={`text-sm font-semibold truncate ${
                        isSelected ? 'text-white' : 'text-[#1a2038] dark:text-white'
                      }`}
                    >
                      {title}
                    </h3>
                    <span
                      className={`text-[11px] shrink-0 font-medium ${
                        isSelected ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      14:32
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        isSelected ? 'text-blue-100' : 'text-[#6070a0] dark:text-[#7b8db5]'
                      }`}
                    >
                      {subtitle}
                    </p>

                    {/* Пример индикатора / бейджа */}
                    {chat.id % 2 === 0 ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shrink-0 ${
                          isSelected
                            ? 'bg-white text-blue-600'
                            : 'bg-blue-600 text-white dark:bg-blue-500'
                        }`}
                      >
                        {chat.id}
                      </span>
                    ) : (
                      <span className={`text-xs ${isSelected ? 'text-white' : 'text-blue-500'}`}>
                        ✓✓
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
