'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { User } from '@/types/user';
import { useUser } from '@/context/UserContext';
import Modal from '@/components/ui/Modal';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await apiClient.getUsers();
      const filtered = allUsers.filter(u => u.id !== currentUser?.id);
      setUsers(filtered);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (userId: number) => {
    try {
      await apiClient.createPrivateChat(userId);
      onChatCreated(); // обновляем ключ в MainLayout
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новый чат">
      {loading && <p>Загрузка пользователей...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && users.length === 0 && <p>Нет других пользователей</p>}
      <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => createChat(user.id)}
            className="w-full text-left px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {user.name || user.username || user.email}
          </button>
        ))}
      </div>
    </Modal>
  );
}