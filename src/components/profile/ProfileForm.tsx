'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import Avatar from '@/components/ui/Avatar';

export default function ProfileForm() {
  const { user, updateUser } = useUser();
  const { t, setLanguage } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setFormData(user);
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('edit') === '1') setIsEditing(true);
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (formData) {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const toggleLastSeen = () => {
    if (!formData) return;
    const current = formData.privacySettings?.showLastSeen ?? true;
    const updated = {
      ...formData,
      privacySettings: {
        ...formData.privacySettings,
        showLastSeen: !current,
      },
    };
    setFormData(updated);
    updateUser(updated);
  };

  const toggleReadReceipts = () => {
    if (!formData) return;
    const current = formData.privacySettings?.showReadReceipts ?? true;
    const updated = {
      ...formData,
      privacySettings: {
        ...formData.privacySettings,
        showReadReceipts: !current,
      },
    };
    setFormData(updated);
    updateUser(updated);
  };

  const handleSave = () => {
    if (!formData) return;
    updateUser(formData);
    if (formData.language !== user?.language) {
      setLanguage(formData.language as 'ru' | 'en');
    }
    setIsEditing(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  if (!user) return null;

  const showLastSeen = formData?.privacySettings?.showLastSeen ?? true;
  const showReadReceipts = formData?.privacySettings?.showReadReceipts ?? true;

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-6 animate-fade-in select-none">
      {savedNotice && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <span>✓</span> Изменения профиля успешно сохранены
        </div>
      )}

      {/* Основная карточка профиля (по макету Союз) */}
      <div className="rounded-3xl bg-white/90 dark:bg-[#111640]/90 border border-[#dde4f0] dark:border-[#1e2955] shadow-xl p-6 sm:p-8 backdrop-blur-md">
        {/* Аватар + Основная инфа */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-[#dde4f0] dark:border-[#1e2955]">
          <div className="relative mb-3">
            <Avatar name={user.name || user.email} src={user.avatar} size="2xl" />
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-md transition-transform hover:scale-105"
              title="Изменить фото"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#1a2038] dark:text-white">
            {user.name || 'Пользователь Союза'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6070a0] dark:text-[#7b8db5] mt-1 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{user.email}</span>
          </p>
        </div>

        {/* Пункты настроек или Форма редактирования */}
        {!isEditing ? (
          <div className="py-4 space-y-4">
            {/* Страна */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-white">
                <span className="text-base text-gray-400">📍</span>
                <span>Страна</span>
              </div>
              <span className="text-xs sm:text-sm text-[#6070a0] dark:text-[#7b8db5]">
                {user.country || 'Не указана'}
              </span>
            </div>

            {/* Язык */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-white">
                <span className="text-base text-gray-400">🌐</span>
                <span>Язык интерфейса</span>
              </div>
              <span className="text-xs sm:text-sm text-[#6070a0] dark:text-[#7b8db5] font-medium">
                {user.language === 'en' ? 'English' : 'Русский'}
              </span>
            </div>

            {/* Статус */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-white">
                <span className="text-base text-gray-400">🕒</span>
                <span>Сетевой статус</span>
              </div>
              <span className="text-xs sm:text-sm text-emerald-500 font-medium">
                {user.status || 'В сети (Online)'}
              </span>
            </div>

            {/* Показывать последнее посещение */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-white">
                <span className="text-base text-gray-400">👁</span>
                <span>Показывать последнее посещение</span>
              </div>
              {/* Переключатель Toggle */}
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

            {/* Уведомлять о прочтении сообщений */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-white">
                <span className="text-base text-gray-400">✓✓</span>
                <span>Отчёты о прочтении сообщений</span>
              </div>
              {/* Переключатель Toggle */}
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

            {/* Кнопка "Редактировать профиль" (на всю ширину по макету) */}
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Редактировать профиль</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="py-4 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1">
                Отображаемое имя
              </label>
              <input
                type="text"
                name="name"
                value={formData?.name || ''}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1">
                Страна
              </label>
              <input
                type="text"
                name="country"
                value={formData?.country || ''}
                onChange={handleChange}
                placeholder="Например: Россия"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1">
                Язык приложения
              </label>
              <select
                name="language"
                value={formData?.language || 'ru'}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1">
                Статус
              </label>
              <input
                type="text"
                name="status"
                value={formData?.status || ''}
                onChange={handleChange}
                placeholder="Например: В сети или На встрече"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
