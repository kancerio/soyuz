'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/user';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { useRouter } from 'next/navigation';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const { user } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiClient.getUsers()
        .then(all => setUsers(all.filter(u => u.id !== user?.id)))
        .catch(() => setUsers([
          { id: 2, name: 'Анна Петрова', username: 'anna_p', email: 'anna@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
          { id: 3, name: 'Максим Смирнов', username: 'max_smirnov', email: 'max@soyuz.chat', country: 'Россия', language: 'ru', status: 'Был недавно', privacySettings: { showLastSeen: true, showReadReceipts: true } },
          { id: 4, name: 'Елена Васильева', username: 'elena_v', email: 'elena@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
          { id: 5, name: 'Дмитрий Козлов', username: 'dmitry_k', email: 'dmitry@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
        ]))
        .finally(() => setLoading(false));
    } else {
      setTitle('');
      setSelected([]);
      setSearch('');
      setError('');
    }
  }, [isOpen, user]);

  const toggle = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const create = async () => {
    if (!title.trim()) return setError('Введите название группы');
    if (selected.length === 0) return setError('Выберите хотя бы одного участника');
    setIsSubmitting(true);
    setError('');
    try {
      const newChat = await apiClient.createGroupChat(title.trim(), selected);
      onGroupCreated();
      onClose();
      if (newChat?.id) {
        router.push(`/chat/${newChat.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании группы');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const name = (u.name || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать групповой чат">
      <div className="space-y-4">
        {/* Поле названия */}
        <div>
          <label className="block text-xs font-medium text-[#6070a0] dark:text-[#7b8db5] mb-1.5">
            Название группы *
          </label>
          <input
            type="text"
            placeholder="Например: Разработка или Проектная команда"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Выбор участников */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#6070a0] dark:text-[#7b8db5]">
              Участники ({selected.length} выбрано)
            </label>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs text-blue-500 hover:underline"
              >
                Сбросить
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Фильтр участников..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />

          {loading ? (
            <div className="py-6 flex justify-center">
              <LoadingState text="Загрузка списка контактов..." />
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {filteredUsers.map((u) => {
                const isChecked = selected.includes(u.id);
                const displayName = u.name || u.username || u.email;

                return (
                  <div
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-[#1a2248]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={displayName} src={u.avatar} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a2038] dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <ErrorState message={error} size="sm" />}

        <button
          type="button"
          onClick={create}
          disabled={isSubmitting || !title.trim() || selected.length === 0}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Создание группы...</span>
            </>
          ) : (
            <span>Создать группу</span>
          )}
        </button>
      </div>
    </Modal>
  );
}
