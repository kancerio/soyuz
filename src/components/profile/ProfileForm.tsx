'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { Avatar, Button, Input, Toggle, Card } from '@/components/ui';

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

  const toggleLastSeen = (checked: boolean) => {
    if (!formData) return;
    const updated = {
      ...formData,
      privacySettings: {
        ...formData.privacySettings,
        showLastSeen: checked,
      },
    };
    setFormData(updated);
    updateUser(updated);
  };

  const toggleReadReceipts = (checked: boolean) => {
    if (!formData) return;
    const updated = {
      ...formData,
      privacySettings: {
        ...formData.privacySettings,
        showReadReceipts: checked,
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
    <div className="w-full max-w-[340px] sm:max-w-xl mx-auto animate-fade-in select-none">
      {savedNotice && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <span>✓</span> Изменения профиля успешно сохранены
        </div>
      )}

      {/* Основная карточка профиля */}
      <Card variant="elevated" padding="lg">
        {/* Аватар + Основная инфа */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-[#dde4f0] dark:border-[#1e2955]">
          <div className="relative mb-3">
            <Avatar name={user.name || user.email} src={user.avatar} size="2xl" isOnline={true} />
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-md transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Изменить фото"
              aria-label="Изменить фото профиля"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#1a2038] dark:text-[#e8ecf4]">
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
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-[#e8ecf4]">
                <span className="text-base text-gray-400">📍</span>
                <span>Страна</span>
              </div>
              <span className="text-xs sm:text-sm text-[#6070a0] dark:text-[#7b8db5]">
                {user.country || 'Россия'}
              </span>
            </div>

            {/* Язык */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-[#e8ecf4]">
                <span className="text-base text-gray-400">🌐</span>
                <span>Язык интерфейса</span>
              </div>
              <span className="text-xs sm:text-sm text-[#6070a0] dark:text-[#7b8db5] font-medium">
                {user.language === 'en' ? 'English' : 'Русский'}
              </span>
            </div>

            {/* Статус */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#1a2038] dark:text-[#e8ecf4]">
                <span className="text-base text-gray-400">🕒</span>
                <span>Сетевой статус</span>
              </div>
              <span className="text-xs sm:text-sm text-emerald-500 font-medium">
                {user.status || 'В сети'}
              </span>
            </div>

            {/* Показывать последнее посещение */}
            <div className="py-2">
              <Toggle
                label="Показывать последнее посещение"
                description="Другие пользователи смогут видеть время вашей активности"
                checked={showLastSeen}
                onChange={toggleLastSeen}
              />
            </div>

            {/* Уведомлять о прочтении сообщений */}
            <div className="py-2">
              <Toggle
                label="Отчёты о прочтении сообщений"
                description="Собеседники будут видеть две синие галочки при прочтении"
                checked={showReadReceipts}
                onChange={toggleReadReceipts}
              />
            </div>

            {/* Кнопка "Редактировать профиль" */}
            <div className="pt-4">
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setIsEditing(true)}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                }
              >
                Редактировать профиль
              </Button>
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
            <Input
              label="Отображаемое имя"
              type="text"
              name="name"
              value={formData?.name || ''}
              onChange={handleChange}
              required
            />

            <Input
              label="Страна"
              type="text"
              name="country"
              value={formData?.country || ''}
              onChange={handleChange}
              placeholder="Например: Россия"
            />

            <div className="w-full space-y-1.5">
              <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5]">
                Язык приложения
              </label>
              <select
                name="language"
                value={formData?.language || 'ru'}
                onChange={handleChange}
                className="w-full py-2.5 px-3.5 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-white dark:bg-[#0f1535] text-[#1a2038] dark:text-[#e8ecf4] outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>

            <Input
              label="Статус"
              type="text"
              name="status"
              value={formData?.status || ''}
              onChange={handleChange}
              placeholder="Например: В сети или На встрече"
            />

            <div className="flex items-center gap-3 pt-3">
              <Button type="submit" variant="primary" size="md" className="flex-1">
                Сохранить
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsEditing(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
