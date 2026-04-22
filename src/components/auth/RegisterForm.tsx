'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function RegisterForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('fill_all_fields') || 'Fill all fields');
      return;
    }

    // TODO: реальный запрос на бэк
    localStorage.setItem('token', 'fake-jwt-token');
    router.push('/chat');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t('email_or_phone')} *</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('password')}*</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('country')}</label>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('language')}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="">{t('choose_language')}</option>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
      >
        {t('register')}
      </button>
      <p className="text-center text-sm">
        {t('have_account')}
        <Link href="/login" className="text-blue-600 hover:underline">
          {t('login')}
        </Link>
      </p>
    </form>
  );
}