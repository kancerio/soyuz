'use client';

import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Avatar from '@/components/ui/Avatar';
import Link from 'next/link';

type SettingsCategory =
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'storage'
  | 'appearance'
  | 'language'
  | 'help';

export default function SettingsForm() {
  const { user, logout, updateUser } = useUser();
  const { language, setLanguage } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account');

  // Локальные состояния приватности
  const [showLastSeen, setShowLastSeen] = useState(user?.privacySettings?.showLastSeen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(user?.privacySettings?.showReadReceipts ?? true);
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);

  const toggleLastSeen = () => {
    if (!user) return;
    const nextVal = !showLastSeen;
    setShowLastSeen(nextVal);
    updateUser({
      ...user,
      privacySettings: { ...user.privacySettings, showLastSeen: nextVal },
    });
  };

  const toggleReadReceipts = () => {
    if (!user) return;
    const nextVal = !showReadReceipts;
    setShowReadReceipts(nextVal);
    updateUser({
      ...user,
      privacySettings: { ...user.privacySettings, showReadReceipts: nextVal },
    });
  };

  if (!user) return null;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full select-none overflow-hidden">
      {/* ========================================================= */}
      {/* Левая колонка категорий настроек                          */}
      {/* ========================================================= */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[#dde4f0] dark:border-[#1e2955] bg-white/70 dark:bg-[#111640]/80 p-4 space-y-2 shrink-0 overflow-y-auto">
        <h1 className="text-xl font-bold tracking-tight text-[#1a2038] dark:text-white px-3 py-2">
          Настройки
        </h1>

        <nav className="space-y-1">
          {/* Аккаунт */}
          <button
            type="button"
            onClick={() => setActiveCategory('account')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'account'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-sm font-semibold">Аккаунт</p>
                <p className={`text-[11px] ${activeCategory === 'account' ? 'text-blue-100' : 'text-gray-400'}`}>
                  Управление профилем
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Конфиденциальность */}
          <button
            type="button"
            onClick={() => setActiveCategory('privacy')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'privacy'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🛡</span>
              <div>
                <p className="text-sm font-semibold">Конфиденциальность</p>
                <p className={`text-[11px] ${activeCategory === 'privacy' ? 'text-blue-100' : 'text-gray-400'}`}>
                  Кто может видеть…
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Уведомления */}
          <button
            type="button"
            onClick={() => setActiveCategory('notifications')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'notifications'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔔</span>
              <div>
                <p className="text-sm font-semibold">Уведомления</p>
                <p className={`text-[11px] ${activeCategory === 'notifications' ? 'text-blue-100' : 'text-gray-400'}`}>
                  Звуки, оповещения
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Данные и хранилище */}
          <button
            type="button"
            onClick={() => setActiveCategory('storage')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'storage'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💾</span>
              <div>
                <p className="text-sm font-semibold">Данные и хранилище</p>
                <p className={`text-[11px] ${activeCategory === 'storage' ? 'text-blue-100' : 'text-gray-400'}`}>
                  Использование памяти
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Внешний вид */}
          <button
            type="button"
            onClick={() => setActiveCategory('appearance')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'appearance'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🎨</span>
              <div>
                <p className="text-sm font-semibold">Внешний вид</p>
                <p className={`text-[11px] ${activeCategory === 'appearance' ? 'text-blue-100' : 'text-gray-400'}`}>
                  Тема, космический фон
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Язык */}
          <button
            type="button"
            onClick={() => setActiveCategory('language')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'language'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🌐</span>
              <div>
                <p className="text-sm font-semibold">Язык</p>
                <p className={`text-[11px] ${activeCategory === 'language' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {language === 'ru' ? 'Русский' : 'English'}
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Помощь */}
          <button
            type="button"
            onClick={() => setActiveCategory('help')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
              activeCategory === 'help'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#1a2248] text-[#1a2038] dark:text-[#e8ecf4]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">❓</span>
              <div>
                <p className="text-sm font-semibold">Помощь</p>
                <p className={`text-[11px] ${activeCategory === 'help' ? 'text-blue-100' : 'text-gray-400'}`}>
                  FAQ и поддержка Союза
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>
        </nav>
      </div>

      {/* ========================================================= */}
      {/* Правая колонка: Детали раздела (по макету Союз)          */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#f0f4ff] dark:bg-[#0b1026]">
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Верхняя карточка выбранного аккаунта */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={user.name || user.email} src={user.avatar} size="xl" />
              <div>
                <h2 className="text-lg font-bold text-[#1a2038] dark:text-white">
                  {user.name || 'Пользователь'}
                </h2>
                <p className="text-xs text-[#6070a0] dark:text-[#7b8db5] mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <Link
              href="/profile"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Редактировать</span>
            </Link>
          </div>

          {/* Карточка детальных параметров */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] shadow-sm space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-[#1a2038] dark:text-white">
                Номер телефона
              </span>
              <span className="text-sm text-gray-400">+7 900 123-45-67 ›</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-[#1a2038] dark:text-white">
                Страна
              </span>
              <span className="text-sm text-gray-400">{user.country || 'Не указана'} ›</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-[#1a2038] dark:text-white">
                Язык перевода
              </span>
              <span className="text-sm text-blue-500 font-semibold uppercase">
                {user.language || 'RU'} ›
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-[#1a2038] dark:text-white">
                Тема оформления
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-[#1a2038] dark:text-white">
                  Показывать последнее посещение
                </p>
                <p className="text-xs text-[#6070a0] dark:text-[#7b8db5]">
                  Другие пользователи будут видеть, когда вы были в сети
                </p>
              </div>
              <button
                type="button"
                onClick={toggleLastSeen}
                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                  showLastSeen ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                    showLastSeen ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[#1a2038] dark:text-white">
                  Уведомлять о прочтении сообщений
                </p>
                <p className="text-xs text-[#6070a0] dark:text-[#7b8db5]">
                  Показывать, когда вы прочитали входящее сообщение
                </p>
              </div>
              <button
                type="button"
                onClick={toggleReadReceipts}
                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                  showReadReceipts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                    showReadReceipts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Карточка Выхода из аккаунта */}
          <div
            onClick={logout}
            className="p-5 rounded-3xl bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] shadow-sm flex items-center justify-between cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 group-hover:underline">
                  Выйти из аккаунта
                </p>
                <p className="text-xs text-[#6070a0] dark:text-[#7b8db5]">
                  Вы будете разлогинены со всех устройств
                </p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
