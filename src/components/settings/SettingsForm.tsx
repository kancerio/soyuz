'use client';

import ThemeToggle from '@/components/ui/ThemeToggle';

export default function SettingsForm() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Тёмная тема</span>
          <ThemeToggle />
        </div>
        <div className="flex justify-between items-center">
          <span>Уведомления</span>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="flex justify-between items-center">
          <span>Звук сообщений</span>
          <input type="checkbox" defaultChecked />
        </div>
      </div>
    </div>
  );
}