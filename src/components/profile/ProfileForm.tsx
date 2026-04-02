'use client';

import { useState, useEffect } from 'react';
import { User } from '@/types/user';
import { currentUser as mockUser } from '@/lib/mockUser';

export default function ProfileForm() {
  const [user, setUser] = useState<User>(mockUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user);

  useEffect(() => {
    // Загружаем сохранённые данные из localStorage
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      setFormData(parsed);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePrivacyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      privacySettings: {
        ...formData.privacySettings,
        [e.target.name]: e.target.checked,
      },
    });
  };

  const handleSave = () => {
    setUser(formData);
    localStorage.setItem('userProfile', JSON.stringify(formData));
    setIsEditing(false);
    alert('Профиль сохранён');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Профиль</h1>
      {!isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-2xl">
              {user.avatar ? <img src={user.avatar} alt="avatar" className="rounded-full" /> : '👤'}
            </div>
            <div>
              <p className="text-xl font-semibold">{user.name}</p>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
          <div><strong>Страна:</strong> {user.country}</div>
          <div><strong>Язык:</strong> {user.language}</div>
          <div><strong>Статус:</strong> {user.status}</div>
          <div><strong>Показывать время последнего визита:</strong> {user.privacySettings.showLastSeen ? 'Да' : 'Нет'}</div>
          <div><strong>Показывать уведомления о прочтении:</strong> {user.privacySettings.showReadReceipts ? 'Да' : 'Нет'}</div>
          <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded">Редактировать</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Имя</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium">Страна</label>
            <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium">Язык</label>
            <select name="language" value={formData.language} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800">
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Статус</label>
            <input type="text" name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="showLastSeen" checked={formData.privacySettings.showLastSeen} onChange={handlePrivacyChange} />
            <label>Показывать время последнего визита</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="showReadReceipts" checked={formData.privacySettings.showReadReceipts} onChange={handlePrivacyChange} />
            <label>Показывать уведомления о прочтении</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Сохранить</button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-500 text-white rounded">Отмена</button>
          </div>
        </form>
      )}
    </div>
  );
}