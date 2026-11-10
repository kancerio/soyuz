'use client';

import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { Avatar, Card, Toggle, ThemeToggle, LanguageToggle, Button } from '@/components/ui';
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
  const { user, logout, updateUser, changeLanguage } = useUser();
  const { language, setLanguage, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account');

  // Локальные состояния приватности
  const [showLastSeen, setShowLastSeen] = useState(user?.privacySettings?.showLastSeen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(user?.privacySettings?.showReadReceipts ?? true);

  const toggleLastSeen = (checked: boolean) => {
    if (!user) return;
    setShowLastSeen(checked);
    updateUser({
      ...user,
      privacySettings: { ...user.privacySettings, showLastSeen: checked },
    });
  };

  const toggleReadReceipts = (checked: boolean) => {
    if (!user) return;
    setShowReadReceipts(checked);
    updateUser({
      ...user,
      privacySettings: { ...user.privacySettings, showReadReceipts: checked },
    });
  };

  const handleSelectLanguage = async (newLang: 'ru' | 'en') => {
    setLanguage(newLang);
    await changeLanguage(newLang);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full select-none overflow-hidden">
      {/* ========================================================= */}
      {/* Левая колонка категорий настроек                          */}
      {/* ========================================================= */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[#dde4f0] dark:border-[#1e2955] bg-white/70 dark:bg-[#111640]/80 p-4 space-y-2 shrink-0 overflow-y-auto">
        <h1 className="text-xl font-bold tracking-tight text-[#1a2038] dark:text-[#e8ecf4] px-3 py-2">
          {t('settings_title')}
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
                <p className="text-sm font-semibold">{t('settings_account')}</p>
                <p className={`text-[11px] ${activeCategory === 'account' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {t('settings_account_desc')}
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
                <p className="text-sm font-semibold">{t('settings_privacy')}</p>
                <p className={`text-[11px] ${activeCategory === 'privacy' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {t('settings_privacy_desc')}
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
                <p className="text-sm font-semibold">{t('settings_language')}</p>
                <p className={`text-[11px] ${activeCategory === 'language' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {language === 'ru' ? 'Русский (RU)' : 'English (EN)'}
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>

          {/* Оформление */}
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
                <p className="text-sm font-semibold">{t('settings_appearance')}</p>
                <p className={`text-[11px] ${activeCategory === 'appearance' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {t('settings_appearance_desc')}
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
                <p className="text-sm font-semibold">{t('settings_help')}</p>
                <p className={`text-[11px] ${activeCategory === 'help' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {t('settings_help_desc')}
                </p>
              </div>
            </div>
            <span className="text-sm opacity-60">›</span>
          </button>
        </nav>
      </div>

      {/* ========================================================= */}
      {/* Правая колонка: Детали раздела                            */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-8 bg-[#f0f4ff] dark:bg-[#0b1026]">
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Верхняя карточка выбранного аккаунта */}
          <Card variant="default" padding="md" className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={user.name || user.email} src={user.avatar} size="xl" isOnline={true} />
              <div>
                <h2 className="text-lg font-bold text-[#1a2038] dark:text-[#e8ecf4]">
                  {user.name || user.username || 'Пользователь'}
                </h2>
                <p className="text-xs text-[#6070a0] dark:text-[#7b8db5] mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <Link
              href="/profile?edit=1"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>{t('profile_edit')}</span>
            </Link>
          </Card>

          {/* Специфический контент раздела: Язык */}
          {activeCategory === 'language' ? (
            <Card variant="default" padding="lg" className="space-y-5 animate-fade-in">
              <div>
                <h3 className="text-base font-bold text-[#1a2038] dark:text-[#e8ecf4]">
                  {t('settings_language')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Выберите предпочитаемый язык для интерфейса мессенджера
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('ru')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    language === 'ru'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 shadow-sm'
                      : 'border-[#dde4f0] dark:border-[#1e2955] hover:bg-gray-50 dark:hover:bg-[#1a2248]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇷🇺</span>
                    <div>
                      <p className="text-sm font-bold text-[#1a2038] dark:text-[#e8ecf4]">Русский</p>
                      <p className="text-xs text-gray-400">Russian (RU)</p>
                    </div>
                  </div>
                  {language === 'ru' && (
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                      ✓
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    language === 'en'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 shadow-sm'
                      : 'border-[#dde4f0] dark:border-[#1e2955] hover:bg-gray-50 dark:hover:bg-[#1a2248]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇬🇧</span>
                    <div>
                      <p className="text-sm font-bold text-[#1a2038] dark:text-[#e8ecf4]">English</p>
                      <p className="text-xs text-gray-400">English (EN)</p>
                    </div>
                  </div>
                  {language === 'en' && (
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                      ✓
                    </span>
                  )}
                </button>
              </div>
            </Card>
          ) : (
            /* Карточка детальных параметров по умолчанию (Аккаунт / Основные) */
            <Card variant="default" padding="lg" className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-medium text-[#1a2038] dark:text-[#e8ecf4]">
                  {t('settings_phone')}
                </span>
                <span className="text-sm text-gray-400">+7 900 123-45-67 ›</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-medium text-[#1a2038] dark:text-[#e8ecf4]">
                  {t('settings_country')}
                </span>
                <span className="text-sm text-gray-400">
                  {user.country || (language === 'en' ? 'Russia' : 'Россия')} ›
                </span>
              </div>

              {/* Язык интерфейса с рабочим переключателем */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <span className="text-sm font-medium text-[#1a2038] dark:text-[#e8ecf4] block">
                    {t('settings_app_lang')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {language === 'ru' ? 'Русский язык' : 'English interface'}
                  </span>
                </div>
                <LanguageToggle variant="pill" />
              </div>

              {/* Тема оформления */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-medium text-[#1a2038] dark:text-[#e8ecf4]">
                  {t('settings_theme_label')}
                </span>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                </div>
              </div>

              <div className="py-2 border-b border-gray-100 dark:border-gray-800">
                <Toggle
                  label={t('privacy_show_last_seen')}
                  description={t('privacy_show_last_seen_desc')}
                  checked={showLastSeen}
                  onChange={toggleLastSeen}
                />
              </div>

              <div className="py-2">
                <Toggle
                  label={t('privacy_show_read_receipts')}
                  description={t('privacy_show_read_receipts_desc')}
                  checked={showReadReceipts}
                  onChange={toggleReadReceipts}
                />
              </div>
            </Card>
          )}

          {/* Карточка Выхода из аккаунта */}
          <div
            onClick={logout}
            className="p-5 rounded-3xl bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] shadow-sm flex items-center justify-between cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center text-lg">
                🚪
              </span>
              <div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                  {t('settings_logout')}
                </p>
                <p className="text-xs text-gray-400">
                  {t('settings_logout_desc')}
                </p>
              </div>
            </div>
            <span className="text-sm text-red-400 opacity-60 group-hover:translate-x-1 transition-transform">
              ›
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
