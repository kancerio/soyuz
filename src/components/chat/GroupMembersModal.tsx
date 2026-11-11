'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useUser } from '@/context/UserContext';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { useRouter } from 'next/navigation';

interface Member {
  userId: number;
  username?: string;
  role: 'owner' | 'admin' | 'member';
}

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  onRoleChanged: () => void;
  onLeave?: () => void;
}

export default function GroupMembersModal({
  isOpen,
  onClose,
  chatId,
  onRoleChanged,
  onLeave,
}: GroupMembersModalProps) {
  const { user } = useUser();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && chatId) {
      fetchMembers();
    } else {
      setSearch('');
      setError('');
    }
  }, [isOpen, chatId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getChatMembers(chatId);
      setMembers(
        data.map((m: any) => ({
          userId: m.userId,
          role: m.role,
          username: m.username || `Пользователь #${m.userId}`,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки участников');
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
      setError(err.message || 'Ошибка изменения роли');
    }
  };

  const removeMember = async (targetUserId: number) => {
    try {
      await apiClient.removeMember(chatId, targetUserId);
      await fetchMembers();
      onRoleChanged();
    } catch (err: any) {
      setError(err.message || 'Не удалось исключить участника');
    }
  };

  const leaveGroup = async () => {
    try {
      await apiClient.leaveGroup(chatId);
      if (onLeave) onLeave();
      router.push('/chat');
    } catch (err: any) {
      setError(err.message || 'Ошибка выхода из группы');
    }
  };

  const currentUserMember = members.find((m) => m.userId === user?.id);
  const currentUserRole = currentUserMember?.role;
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';

  const filteredMembers = members.filter((m) =>
    (m.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Участники группы">
      <div className="space-y-4">
        {/* Поиск участника */}
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск по участникам…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {error && <ErrorState message={error} size="sm" />}

        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingState text="Загрузка списка участников…" />
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {filteredMembers.map((m) => {
              const isMe = m.userId === user?.id;
              const isOwner = m.role === 'owner';
              const isAdmin = m.role === 'admin';

              return (
                <div
                  key={m.userId}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a2248] transition-colors gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={m.username || `User ${m.userId}`} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[#1a2038] dark:text-white truncate">
                          {m.username}
                        </span>
                        {isMe && (
                          <span className="text-[10px] text-blue-500 font-medium">(Вы)</span>
                        )}
                      </div>
                      <span className="text-xs text-[#6070a0] dark:text-[#7b8db5] flex items-center gap-1">
                        {isOwner && '👑 Владелец'}
                        {isAdmin && '⭐ Администратор'}
                        {!isOwner && !isAdmin && 'Участник'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && !isMe && !isOwner && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.userId, e.target.value as any)}
                          className="border border-[#dde4f0] dark:border-[#1e2955] rounded-xl px-2 py-1 text-xs bg-white dark:bg-[#0f1535] text-[#1a2038] dark:text-white outline-none cursor-pointer"
                        >
                          <option value="member">Участник</option>
                          <option value="admin">Администратор</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(m.userId)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Исключить из группы"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentUserRole !== 'owner' && (
          <div className="pt-3 border-t border-[#dde4f0] dark:border-[#1e2955]">
            <button
              type="button"
              onClick={leaveGroup}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              Покинуть группу
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
