'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/user';
import Modal from '@/components/ui/Modal';
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
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiClient.getUsers()
        .then(all => setUsers(all.filter(u => u.id !== user?.id)))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setTitle('');
      setSelected([]);
      setError('');
    }
  }, [isOpen, user]);

  const toggle = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const create = async () => {
    if (!title.trim()) return setError('Введите название');
    if (selected.length === 0) return setError('Выберите хотя бы одного участника');
    setLoading(true);
    try {
      const newChat = await apiClient.createGroupChat(title, selected);
      onGroupCreated();
      onClose();
      router.push(`/chat/${newChat.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать группу">
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Название группы"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded dark:bg-gray-800"
        />
        <div className="max-h-60 overflow-y-auto space-y-2">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              <span>{u.name || u.username || u.email}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={create} disabled={loading} className="w-full bg-green-600 text-white py-2 rounded">
          {loading ? 'Создание...' : 'Создать группу'}
        </button>
      </div>
    </Modal>
  );
}