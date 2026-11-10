'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { User } from '@/types/user';
import { useUser } from '@/context/UserContext';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { useRouter } from 'next/navigation';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: () => void;
}

export default function CreateChatModal({ isOpen, onClose, onChatCreated }: CreateChatModalProps) {
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    } else {
      setSearch('');
      setError('');
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await apiClient.getUsers();
      const filtered = allUsers.filter(u => u.id !== currentUser?.id);
      setUsers(filtered);
    } catch (err: any) {
      setUsers([
        { id: 2, name: 'Анна Петрова', username: 'anna_p', email: 'anna@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
        { id: 3, name: 'Максим Смирнов', username: 'max_smirnov', email: 'max@soyuz.chat', country: 'Россия', language: 'ru', status: 'Был недавно', privacySettings: { showLastSeen: true, showReadReceipts: true } },
        { id: 4, name: 'Елена Васильева', username: 'elena_v', email: 'elena@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
        { id: 5, name: 'Дмитрий Козлов', username: 'dmitry_k', email: 'dmitry@soyuz.chat', country: 'Россия', language: 'ru', status: 'В сети', privacySettings: { showLastSeen: true, showReadReceipts: true } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (userId: number) => {
    setCreatingId(userId);
    try {
      const chat = await apiClient.createPrivateChat(userId);
      onChatCreated();
      onClose();
      if (chat?.id) {
        router.push(`/chat/${chat.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка создания чата');
    } finally {
      setCreatingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const name = (u.name || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || username.includes(q) || email.includes(q);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новый личный диалог">
      <div className="space-y-4">
        {/* Поиск собеседника */}
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск по имени или почте..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-2.5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {error && <ErrorState message={error} onRetry={fetchUsers} size="sm" />}

        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingState text="Поиск пользователей..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#6070a0] dark:text-[#7b8db5]">
            {search ? 'Пользователи не найдены' : 'Нет доступных пользователей'}
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              const displayName = user.name || user.username || user.email;
              const isCreating = creatingId === user.id;

              return (
                <button
                  key={user.id}
                  onClick={() => createChat(user.id)}
                  disabled={isCreating}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-[#1a2248] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={displayName} src={user.avatar} size="md" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#1a2038] dark:text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-[#6070a0] dark:text-[#7b8db5] truncate">
                        {user.username ? `@${user.username}` : user.email}
                      </p>
                    </div>
                  </div>
                  {isCreating ? (
                    <span className="text-xs text-blue-500 animate-pulse">Создание...</span>
                  ) : (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Начать →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
