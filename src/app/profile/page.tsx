import MainLayout from '@/components/layout/MainLayout';

export default function ProfilePage() {
  return (
    <MainLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold">Профиль пользователя</h1>
        <p>Настройки профиля, аватар, язык, страна</p>
      </div>
    </MainLayout>
  );
}