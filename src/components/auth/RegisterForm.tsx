'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Заполните обязательные поля');
      return;
    }

    // TODO: реальный запрос на бэк
    localStorage.setItem('token', 'fake-jwt-token');
    router.push('/chat');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Email или телефон *</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Пароль *</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Страна</label>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Язык профиля</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
        >
          <option value="">Выберите язык</option>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
      >
        Зарегистрироваться
      </button>
      <p className="text-center text-sm">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
}