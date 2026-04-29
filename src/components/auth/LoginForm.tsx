'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Простая валидация
    if (!email || !password) {
      setError(t('fill_all_fields') || 'Fill all fields');
      return;
    }

    // TODO: заменить на реальный запрос к бэку
    // Пока имитируем успешный вход
    if (email && password) {
      localStorage.setItem('token', 'fake-jwt-token');
      router.push('/chat');
    } else {
      setError('Неверные учетные данные');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t('email_or_phone')}</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          required
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
      >
        {t('login')}
      </button>
      <p className="text-center text-sm">
        {t('no_account')}
        <Link href="/register" className="text-blue-600 hover:underline">
          {t('register')}
        </Link>
      </p>
    </form>
  );
}