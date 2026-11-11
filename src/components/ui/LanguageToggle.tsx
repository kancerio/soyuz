'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';

interface LanguageToggleProps {
  className?: string;
  variant?: 'pill' | 'select' | 'compact';
}

export default function LanguageToggle({ className = '', variant = 'pill' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const { changeLanguage } = useUser();

  const handleSwitch = (newLang: 'ru' | 'en') => {
    setLanguage(newLang);
    changeLanguage(newLang);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => handleSwitch(language === 'ru' ? 'en' : 'ru')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[#dde4f0] dark:border-[#1e2955] bg-white/80 dark:bg-[#111640]/80 text-[#1a2038] dark:text-[#e8ecf4] hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
        title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
        aria-label="Переключение языка"
      >
        <span className="text-sm">🌐</span>
        <span className="uppercase font-bold tracking-wider">{language}</span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-[#151c42] border border-[#dde4f0] dark:border-[#1e2955] ${className}`}
      role="group"
      aria-label="Выбор языка интерфейса"
    >
      <button
        type="button"
        onClick={() => handleSwitch('ru')}
        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
          language === 'ru'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-blue-500'
        }`}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => handleSwitch('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
          language === 'en'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-blue-500'
        }`}
      >
        EN
      </button>
    </div>
  );
}
