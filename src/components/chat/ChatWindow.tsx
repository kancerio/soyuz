'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { initSocket, getSocket } from '@/lib/socket';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSocketStatus } from '@/context/SocketContext';
import AIToolsPanel from './AIToolsPanel';
import GroupMembersModal from './GroupMembersModal';

interface ChatWindowProps {
  chatId: string;
}

interface LocalMessage {
  id: number;
  text: string;
  senderId: number;
  chatId: number;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  isEdited?: boolean;
  isDeleted?: boolean;
}

type TranslationState = {
  status: 'idle' | 'translating' | 'done' | 'error';
  text?: string;
  error?: string;
  sourceLang?: string;
  targetLang?: string;
};

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useUser();
  const { isConnected } = useSocketStatus();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdNum = parseInt(chatId, 10);
  const [chatInfo, setChatInfo] = useState<{ title: string | null; isGroup: boolean } | null>(null);
  const [membersMap, setMembersMap] = useState<Map<number, string>>(new Map());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalKey, setMembersModalKey] = useState(0);
  const [translations, setTranslations] = useState<Record<number, TranslationState>>({});

  // 🎯 Язык перевода берём из профиля пользователя (настройки пользователя)
  const targetLanguage = (user?.language || 'en').toLowerCase();

  // Загрузка информации о чате
  useEffect(() => {
    const fetchChatInfo = async () => {
      try {
        const info = await apiClient.getChat(chatIdNum);
        setChatInfo(info);
      } catch (error) {
        console.error('Failed to fetch chat info', error);
      }
    };
    fetchChatInfo();
  }, [chatIdNum]);

  // Загрузка участников группы (только для групповых чатов)
  useEffect(() => {
    if (!chatInfo?.isGroup) return;
    const fetchMembers = async () => {
      try {
        const members = await apiClient.getChatMembers(chatIdNum);
        const map = new Map<number, string>();
        members.forEach((m: any) => map.set(m.userId, m.role));
        setMembersMap(map);
      } catch (error) {
        console.error('Failed to load members', error);
      }
    };
    fetchMembers();
  }, [chatInfo?.isGroup, chatIdNum, membersModalKey]);

  // WebSocket подписка и присоединение к комнате
  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user.id);
    socket.emit('join_chat', { chatId: chatIdNum });
    console.log(`🔗 Joined chat room: ${chatIdNum}`);

    const handleNewMessage = (msg: any) => {
      if (Number(msg.chatId) !== chatIdNum) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            text: msg.content,
            senderId: msg.userId,
            chatId: msg.chatId,
            timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            status: msg.userId === user.id ? ('read' as const) : ('delivered' as const),
            isEdited: msg.isEdited,
            isDeleted: msg.isDeleted,
          },
        ];
      });
    };

    const handleMessageUpdated = (data: { id: number; content: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, text: data.content, isEdited: true } : m
        )
      );
    };

    const handleMessageDeleted = (data: { id: number }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, text: '[Удалено]', isDeleted: true } : m
        )
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave_chat', { chatId: chatIdNum });
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [chatIdNum, user]);

  // Загрузка истории сообщений
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getMessages(chatIdNum);
        const mapped: LocalMessage[] = data.map((m: any) => ({
          id: m.id,
          text: m.content,
          senderId: m.userId,
          chatId: m.chatId,
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
          status: 'read' as const,
          isEdited: m.isEdited,
          isDeleted: m.isDeleted,
        }));
        setMessages(mapped);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [chatIdNum]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');

    const tempId = Date.now();
    const tempMessage: LocalMessage = {
      id: tempId,
      text: content,
      senderId: user?.id ?? 0,
      chatId: chatIdNum,
      timestamp: new Date(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, tempMessage]);

    let fallbackTimer: NodeJS.Timeout;
    const socket = getSocket();

    const cleanupFallback = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };

    const onNewMessageConfirm = (msg: any) => {
      if (msg.userId === user?.id && msg.content === content && msg.chatId === chatIdNum) {
        cleanupFallback();
        socket?.off('new_message', onNewMessageConfirm);
        setMessages((prev) =>
          prev.map((msgItem) =>
            msgItem.id === tempId
              ? {
                  ...msgItem,
                  id: msg.id,
                  status: 'sent' as const,
                  timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                }
              : msgItem
          )
        );
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msgItem) =>
              msgItem.id === msg.id ? { ...msgItem, status: 'delivered' as const } : msgItem
            )
          );
        }, 1000);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msgItem) =>
              msgItem.id === msg.id ? { ...msgItem, status: 'read' as const } : msgItem
            )
          );
        }, 3000);
      }
    };
    socket?.on('new_message', onNewMessageConfirm);

    fallbackTimer = setTimeout(async () => {
      console.log('Fallback: reloading messages');
      socket?.off('new_message', onNewMessageConfirm);
      try {
        const fresh = await apiClient.getMessages(chatIdNum);
        const mapped: LocalMessage[] = fresh.map((m: any) => ({
          id: m.id,
          text: m.content,
          senderId: m.userId,
          chatId: m.chatId,
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
          status: 'read' as const,
          isEdited: m.isEdited,
          isDeleted: m.isDeleted,
        }));
        setMessages(mapped);
      } catch (err) {
        console.error('Fallback failed:', err);
      }
    }, 5000);

    try {
      await apiClient.sendMessage(chatIdNum, content);
    } catch (error) {
      console.error('Failed to send message:', error);
      cleanupFallback();
      socket?.off('new_message', onNewMessageConfirm);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓✓';
      default:
        return '';
    }
  };

  const getRoleSymbol = (role?: string) => {
    if (role === 'owner') return '👑 ';
    if (role === 'admin') return '⭐ ';
    return '';
  };

  const refreshRoles = () => {
    setMembersModalKey(prev => prev + 1);
  };

  // --- Перевод сообщения (target-язык из профиля пользователя) ---
  const handleTranslate = async (msg: LocalMessage) => {
    if (translations[msg.id]?.status === 'translating') return;
    if (msg.isDeleted) return;

    setTranslations(prev => ({
      ...prev,
      [msg.id]: { status: 'translating', targetLang: targetLanguage },
    }));

    try {
      // source = auto (сервис определит), target = язык из профиля
      const res = await apiClient.translateMessage(
        msg.text,
        'auto',
        targetLanguage,
        `msg-${msg.id}`
      );

      setTranslations(prev => ({
        ...prev,
        [msg.id]: {
          status: 'done',
          text: res.result,
          sourceLang: res.source_lang || 'auto',
          targetLang: res.target_lang || targetLanguage,
        },
      }));
    } catch (err: any) {
      // Ошибка AI — оригинал НЕ удаляем, показываем статус
      setTranslations(prev => ({
        ...prev,
        [msg.id]: {
          status: 'error',
          error: err?.message || 'Ошибка перевода',
          targetLang: targetLanguage,
        },
      }));
    }
  };

  if (loading) return <div className="p-4">Загрузка сообщений...</div>;

  return (
    <div className="flex flex-col h-full">
      <AIToolsPanel />

      {/* Верхняя панель: индикатор соединения + язык перевода */}
      <div className="p-2 border-b dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">{isConnected ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* 🎯 Индикатор языка перевода из профиля */}
          <div
            className="text-xs text-gray-500 dark:text-gray-400"
            title="Язык перевода берётся из настроек профиля"
          >
            Перевод → <span className="font-semibold uppercase">{targetLanguage}</span>
          </div>
          {chatInfo?.isGroup && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Участники ({membersMap.size})
            </button>
          )}
        </div>
      </div>

      {/* Заголовок группы (кликабельный) */}
      {chatInfo?.isGroup && (
        <div
          onClick={() => setShowMembersModal(true)}
          className="p-2 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-center"
        >
          <h2 className="text-lg font-semibold">{chatInfo.title || 'Группа'}</h2>
          <div className="text-xs text-gray-500">Нажмите для просмотра участников</div>
        </div>
      )}

      {/* Список сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500">Нет сообщений. Напишите первое!</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.senderId === user?.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <p>
                {msg.senderId !== user?.id && (
                  <span className="font-semibold">
                    {getRoleSymbol(membersMap.get(msg.senderId))}
                  </span>
                )}
                {msg.isDeleted ? '[Удалено]' : msg.text}
              </p>

              <div className="text-xs opacity-70 mt-1 flex justify-end gap-1">
                <span>{msg.timestamp.toLocaleTimeString()}</span>
                {msg.senderId === user?.id && (
                  <span>{getStatusIcon(msg.status)}</span>
                )}
                {msg.isEdited && <span>(ред.)</span>}
              </div>

              {/* --- Перевод --- */}
              {!msg.isDeleted && (
                <>
                  {!translations[msg.id] && (
                    <button
                      onClick={() => handleTranslate(msg)}
                      className={`text-xs mt-1 hover:underline ${
                        msg.senderId === user?.id ? 'text-blue-100' : 'text-blue-500'
                      }`}
                      title={`Перевести на ${targetLanguage.toUpperCase()}`}
                    >
                      Перевести на {targetLanguage.toUpperCase()}
                    </button>
                  )}

                  {translations[msg.id]?.status === 'translating' && (
                    <div className="text-xs italic mt-1 opacity-70">
                      Переводится на {translations[msg.id].targetLang?.toUpperCase()}…
                    </div>
                  )}

                  {translations[msg.id]?.status === 'done' && (
                    <div
                      className={`text-xs mt-1 border-l-2 pl-2 ${
                        msg.senderId === user?.id
                          ? 'border-blue-300 text-blue-50'
                          : 'border-blue-400 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-[10px] uppercase opacity-60 mr-1">
                        {translations[msg.id].targetLang?.toUpperCase()}:
                      </span>
                      {translations[msg.id].text}
                      <span className="ml-2 text-[10px] uppercase opacity-60">
                        (тестовый результат)
                      </span>
                    </div>
                  )}

                  {translations[msg.id]?.status === 'error' && (
                    <div className="text-xs mt-1 flex items-center gap-2 text-red-300">
                      <span>{translations[msg.id].error}</span>
                      <button
                        onClick={() => handleTranslate(msg)}
                        className="underline hover:no-underline"
                      >
                        Повторить
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Форма отправки */}
      <form onSubmit={handleSend} className="p-4 border-t dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('type_message')}
            className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {t('send')}
          </button>
        </div>
      </form>

      {/* Модалка участников группы */}
      {chatInfo?.isGroup && (
        <GroupMembersModal
          key={membersModalKey}
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          chatId={chatIdNum}
          onRoleChanged={refreshRoles}
          onLeave={() => {
            setShowMembersModal(false);
            router.push('/chat');
          }}
        />
      )}
    </div>
  );
}