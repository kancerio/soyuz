'use client';

import MainLayout from '@/components/layout/MainLayout';
import ProfileForm from '@/components/profile/ProfileForm';

export default function ProfilePage() {
  return (
    <MainLayout>
      <div className="w-full h-full overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-[#eef4ff] to-[#f7f9ff] dark:from-[#0b1026] dark:to-[#0f1535]">
        <ProfileForm />
      </div>
    </MainLayout>
  );
}
