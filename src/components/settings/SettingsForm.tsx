'use client';

import ThemeToggle from '@/components/ui/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';

export default function SettingsForm() {
  const { t } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{t('settings')}</h1>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span>{t('dark_theme')}</span>
          <ThemeToggle />
        </div>
        <div className="flex justify-between items-center">
          <span>{t('notifications')}</span>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="flex justify-between items-center">
          <span>{t('sound')}</span>
          <input type="checkbox" defaultChecked />
        </div>
      </div>
    </div>
  );
}