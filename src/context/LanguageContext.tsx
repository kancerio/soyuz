'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';

type Language = 'ru' | 'en';
type Translations = Record<string, string>;

const translations: Record<Language, Translations> = { ru, en };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>('ru');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language | null;
    if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
      setLanguage(savedLang);
    } else {
      // Определяем язык браузера
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === 'en') setLanguage('en');
    }
  }, []);

  const setLanguageAndSave = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageAndSave, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};