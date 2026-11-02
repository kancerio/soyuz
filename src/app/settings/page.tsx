'use client';

import MainLayout from '@/components/layout/MainLayout';
import SettingsForm from '@/components/settings/SettingsForm';

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="w-full h-full overflow-hidden">
        <SettingsForm />
      </div>
    </MainLayout>
  );
}
