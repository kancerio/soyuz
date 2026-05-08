'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useUser } from '@/context/UserContext';
import Modal from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';

interface Member {
  userId: number;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  onRoleChanged: () => void;
  onLeave?: () => void;
}

export default function GroupMembersModal({ isOpen, onClose, chatId, onRoleChanged, onLeave }: GroupMembersModalProps) {
  const { user } = useUser();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && chatId) {
      fetchMembers();
    }
  }, [isOpen, chatId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getChatMembers(chatId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (targetUserId: number, newRole: 'admin' | 'member') => {
    try {
      await apiClient.updateMemberRole(chatId, targetUserId, newRole);
      await fetchMembers();
      onRoleChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeMember = async (targetUserId: number) => {
    if (!confirm('Вы уверены, что хотите исключить этого участника?')) return;
    try {
      // Используем leaveGroup (или отдельный метод, но пока можно через leaveGroup с передачей userId)
      // Для исключения другого участника нужен отдельный метод, но в моках можно реализовать удаление из группы.
      // Предположим, что в apiClient есть removeMember.
      await apiClient.removeMember(chatId, targetUserId);
      await fetchMembers();
      onRoleChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const leaveGroup = async () => {
    if (!confirm('Вы уверены, что хотите покинуть группу?')) return;
    try {
      await apiClient.leaveGroup(chatId);
      if (onLeave) onLeave();
      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const currentUserMember = members.find(m => m.userId === user?.id);
  const currentUserRole = currentUserMember?.role;
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Участники группы">
      {loading && <p>Загрузка...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {members.map(m => (
          <div key={m.userId} className="flex justify-between items-center border-b pb-2">
            <div>
              <span>{m.username}</span>
              <span className="ml-2 text-sm text-gray-500">
                {m.role === 'owner' && '(Владелец)'}
                {m.role === 'admin' && '(Админ)'}
              </span>
            </div>
            <div className="flex gap-2">
              {canEdit && m.userId !== user?.id && m.role !== 'owner' && (
                <div className="flex gap-2 items-center">
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.userId, e.target.value as any)}
                    className="border border-gray-400 dark:border-gray-500 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="member">Участник</option>
                    <option value="admin">Админ</option>
                  </select>
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    title="Исключить"
                  >
                    🚫 Исключить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {currentUserRole !== 'owner' && (
        <div className="mt-4 pt-3 border-t">
          <button
            onClick={leaveGroup}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
          >
            Покинуть группу
          </button>
        </div>
      )}
    </Modal>
  );
}