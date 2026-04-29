'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold">{t('app_name')}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/chat" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('chats')}
          </Link>
          <Link href="/profile" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('profile')}
          </Link>
          <Link href="/settings" className="block px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            {t('settings')}
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}