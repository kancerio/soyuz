'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/user';

export default function LoginForm() {
  const { t } = useLanguage();
  const { login } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('fetch')) {
        setError('Бэкенд-сервер (localhost:3001) не отвечает. Для просмотра вёрстки воспользуйтесь кнопкой «Демо-вход для просмотра» ниже.');
      } else {
        setError(err.message || 'Ошибка входа. Проверьте введённые данные.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1.5">
          Email или телефон
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-white dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1.5">
          Пароль
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-white dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            required
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Вход в Союз...</span>
          </>
        ) : (
          <span>Войти в Союз</span>
        )}
      </button>

      <div className="pt-2 text-center">
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-200 dark:border-gray-800" />
          <span className="flex-shrink mx-3 text-xs text-gray-400">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
              Создать аккаунт
            </Link>
          </span>
          <div className="flex-grow border-t border-gray-200 dark:border-gray-800" />
        </div>
      </div>
    </form>
  );
}
