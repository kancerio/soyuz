'use client';

import { useState, useEffect } from 'react';
import { User } from '@/types/user';
import { currentUser as mockUser } from '@/lib/mockUser';
import { useLanguage } from '@/context/LanguageContext';

export default function ProfileForm() {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<User>(mockUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user);

  useEffect(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      setFormData(parsed);
      // Синхронизируем язык интерфейса с языком из профиля
      if (parsed.language && (parsed.language === 'ru' || parsed.language === 'en')) {
        setLanguage(parsed.language);
      }
    }
  }, [setLanguage]);

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
    // Если язык изменился, обновляем язык интерфейса
    if (formData.language !== language) {
      setLanguage(formData.language as 'ru' | 'en');
    }
    setIsEditing(false);
    alert(t('save_success') || 'profile_saved');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{t('profile')}</h1>
      {!isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-2xl">👤</div>
            <div>
              <p className="text-xl font-semibold">{user.name}</p>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
          <div><strong>{t('country')}:</strong> {user.country}</div>
          <div><strong>{t('language')}:</strong> {user.language}</div>
          <div><strong>{t('status')}:</strong> {user.status}</div>
          <div><strong>{t('privacy_show_last_seen')}:</strong> {user.privacySettings.showLastSeen ? t('yes') : t('no')}</div>
          <div><strong>{t('privacy_show_read_receipts')}:</strong> {user.privacySettings.showReadReceipts ? t('yes') : t('no')}</div>
          <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded">{t('edit')}</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">{t('name')}</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('country')}</label>
            <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('language')}</label>
            <select name="language" value={formData.language} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800">
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">{t('status')}</label>
            <input type="text" name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-800" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="showLastSeen" checked={formData.privacySettings.showLastSeen} onChange={handlePrivacyChange} />
            <label>{t('privacy_show_last_seen')}</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="showReadReceipts" checked={formData.privacySettings.showReadReceipts} onChange={handlePrivacyChange} />
            <label>{t('privacy_show_read_receipts')}</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">{t('save')}</button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-500 text-white rounded">{t('cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );
}