'use client';

import { useTheme } from '@/components/providers/ThemeProvider';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-[#1a2248] hover:bg-gray-200 dark:hover:bg-[#202a58] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 shadow-sm ${className}`}
      aria-label={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
    >
      {theme === 'light' ? (
        <svg
          className="w-5 h-5 transition-transform duration-200 hover:-rotate-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 transition-transform duration-200 hover:rotate-45"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}
