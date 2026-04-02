import MainLayout from '@/components/layout/MainLayout';

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold">Настройки</h1>
        <p>Тема, приватность, уведомления</p>
      </div>
    </MainLayout>
  );
}