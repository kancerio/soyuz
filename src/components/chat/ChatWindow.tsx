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
import { Message } from '@/types/chat';

interface ChatWindowProps {
  chatId: string;
}

type RewriteAction = 'shorten' | 'formal' | 'friendly';

type RewriteState = {
  status: 'idle' | 'loading' | 'preview' | 'error';
  action?: RewriteAction;
  originalDraft?: string;
  preview?: string;
  error?: string;
};

/**
 * Слияние сообщений по id.
 * Сохраняем локальные поля (status, перевод), если они уже есть.
 */
function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  prev.forEach(m => map.set(m.id, m));

  incoming.forEach(m => {
    const existing = map.get(m.id);
    if (existing) {
      map.set(m.id, {
        ...existing,
        ...m,
        // Сохраняем всё, что могло быть получено от AI, если backend не прислал
        translatedText: m.translatedText ?? existing.translatedText,
        translationStatus: m.translationStatus ?? existing.translationStatus,
        translationError: m.translationError ?? existing.translationError,
        sourceLang: m.sourceLang ?? existing.sourceLang,
        targetLang: m.targetLang ?? existing.targetLang,
        // Локальный статус отправки не перетираем готовым ответом backend
        status: existing.status === 'sending' ? m.status : (m.status ?? existing.status),
      });
    } else {
      map.set(m.id, m);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useUser();
  const { isConnected } = useSocketStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdNum = parseInt(chatId, 10);
  const [chatInfo, setChatInfo] = useState<{ title: string | null; isGroup: boolean } | null>(null);
  const [membersMap, setMembersMap] = useState<Map<number, string>>(new Map());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalKey, setMembersModalKey] = useState(0);

  const [rewrite, setRewrite] = useState<RewriteState>({ status: 'idle' });

  const targetLanguage = (user?.language || 'en').toLowerCase();

  // --- Информация о чате ---
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

  // --- Участники группы ---
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

  // --- WebSocket ---
  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user.id);
    socket.emit('join_chat', { chatId: chatIdNum });

    const handleNewMessage = (msg: any) => {
      if (Number(msg.chatId) !== chatIdNum) return;
      const incoming: Message = {
        id: msg.id,
        text: msg.content,
        senderId: msg.userId,
        chatId: msg.chatId,
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        status: msg.userId === user.id ? 'read' : 'delivered',
        isEdited: msg.isEdited ?? false,
        isDeleted: msg.isDeleted ?? false,
        translationStatus: 'idle',
      };
      setMessages(prev => mergeMessages(prev, [incoming]));
    };

    const handleMessageUpdated = (data: { id: number; content: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.id ? { ...m, text: data.content, isEdited: true } : m
        )
      );
    };

    const handleMessageDeleted = (data: { id: number }) => {
      setMessages(prev =>
        prev.map(m =>
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

  // --- История ---
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getMessages(chatIdNum);
        setMessages(prev => mergeMessages(prev, data));
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

  // --- Отправка ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');

    const tempId = Date.now();
    const tempMessage: Message = {
      id: tempId,
      text: content,
      senderId: user?.id ?? 0,
      chatId: chatIdNum,
      timestamp: new Date(),
      status: 'sending',
      translationStatus: 'idle',
    };
    setMessages(prev => mergeMessages(prev, [tempMessage]));

    let fallbackTimer: NodeJS.Timeout;
    const socket = getSocket();

    const cleanupFallback = () => fallbackTimer && clearTimeout(fallbackTimer);

    const onNewMessageConfirm = (msg: any) => {
      if (msg.userId === user?.id && msg.content === content && msg.chatId === chatIdNum) {
        cleanupFallback();
        socket?.off('new_message', onNewMessageConfirm);

        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? {
                  ...m,
                  id: msg.id,
                  status: 'sent',
                  timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                }
              : m
          )
        );
        setTimeout(() => {
          setMessages(prev =>
            prev.map(m => (m.id === msg.id ? { ...m, status: 'delivered' } : m))
          );
        }, 1000);
        setTimeout(() => {
          setMessages(prev =>
            prev.map(m => (m.id === msg.id ? { ...m, status: 'read' } : m))
          );
        }, 3000);
      }
    };
    socket?.on('new_message', onNewMessageConfirm);

    fallbackTimer = setTimeout(async () => {
      socket?.off('new_message', onNewMessageConfirm);
      try {
        const fresh = await apiClient.getMessages(chatIdNum);
        // mergeMessages сохранит перевод, статусы и не задублирует
        setMessages(prev => mergeMessages(prev, fresh));
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
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓✓';
      default: return '';
    }
  };

  const getRoleSymbol = (role?: string) => {
    if (role === 'owner') return '👑 ';
    if (role === 'admin') return '⭐ ';
    return '';
  };

  const refreshRoles = () => setMembersModalKey(prev => prev + 1);

  // --- Перевод ---
  const handleTranslate = async (msg: Message) => {
    if (msg.translationStatus === 'translating') return;
    if (msg.isDeleted) return;

    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? { ...m, translationStatus: 'translating', targetLang: targetLanguage }
          : m
      )
    );

    try {
      const res = await apiClient.translateMessage(
        msg.text,
        'auto',
        targetLanguage,
        `msg-${msg.id}`
      );

      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? {
                ...m,
                translationStatus: 'done',
                translatedText: res.result,
                sourceLang: res.source_lang || 'auto',
                targetLang: res.target_lang || targetLanguage,
                translationError: null,
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? {
                ...m,
                translationStatus: 'error',
                translationError: err?.message || 'Ошибка перевода',
                targetLang: targetLanguage,
              }
            : m
        )
      );
    }
  };

  // --- AI-rewrite ---
  const handleAssist = async (action: RewriteAction) => {
    const draft = newMessage.trim();
    if (!draft) return;

    setRewrite({ status: 'loading', action, originalDraft: draft });

    try {
      const res = await apiClient.assistText(
        draft,
        action,
        undefined,
        `assist-${Date.now()}`
      );
      setRewrite({
        status: 'preview',
        action,
        originalDraft: draft,
        preview: res.result,
      });
    } catch (err: any) {
      setRewrite({
        status: 'error',
        action,
        originalDraft: draft,
        error: err?.message || 'Ошибка AI',
      });
    }
  };

  const applyRewrite = () => {
    if (rewrite.preview) setNewMessage(rewrite.preview);
    setRewrite({ status: 'idle' });
  };

  const cancelRewrite = () => {
    if (rewrite.originalDraft !== undefined) setNewMessage(rewrite.originalDraft);
    setRewrite({ status: 'idle' });
  };

  if (loading) return <div className="p-4">Загрузка сообщений...</div>;

  return (
    <div className="flex flex-col h-full">
      <AIToolsPanel />

      {/* Верхняя панель */}
      <div className="p-2 border-b dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">{isConnected ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
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

      {/* Заголовок группы */}
      {chatInfo?.isGroup && (
        <div
          onClick={() => setShowMembersModal(true)}
          className="p-2 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-center"
        >
          <h2 className="text-lg font-semibold">{chatInfo.title || 'Группа'}</h2>
          <div className="text-xs text-gray-500">Нажмите для просмотра участников</div>
        </div>
      )}

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500">Нет сообщений. Напишите первое!</div>
        )}
        {messages.map(msg => (
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
                {msg.senderId === user?.id && <span>{getStatusIcon(msg.status)}</span>}
                {msg.isEdited && <span>(ред.)</span>}
              </div>

              {!msg.isDeleted && (
                <>
                  {(!msg.translationStatus || msg.translationStatus === 'idle') && (
                    <button
                      onClick={() => handleTranslate(msg)}
                      className={`text-xs mt-1 hover:underline ${
                        msg.senderId === user?.id ? 'text-blue-100' : 'text-blue-500'
                      }`}
                    >
                      Перевести на {targetLanguage.toUpperCase()}
                    </button>
                  )}

                  {msg.translationStatus === 'translating' && (
                    <div className="text-xs italic mt-1 opacity-70">
                      Переводится на {msg.targetLang?.toUpperCase()}…
                    </div>
                  )}

                  {msg.translationStatus === 'done' && (
                    <div
                      className={`text-xs mt-1 border-l-2 pl-2 ${
                        msg.senderId === user?.id
                          ? 'border-blue-300 text-blue-50'
                          : 'border-blue-400 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-[10px] uppercase opacity-60 mr-1">
                        {msg.targetLang?.toUpperCase()}:
                      </span>
                      {msg.translatedText}
                      <span className="ml-2 text-[10px] uppercase opacity-60">
                        (тестовый результат)
                      </span>
                    </div>
                  )}

                  {msg.translationStatus === 'error' && (
                    <div className="text-xs mt-1 flex items-center gap-2 text-red-300">
                      <span>{msg.translationError}</span>
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

      {/* AI-rewrite */}
      <div className="px-4 pt-2 border-t dark:border-gray-700">
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => handleAssist('shorten')}
            disabled={!newMessage.trim() || rewrite.status === 'loading'}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            ✂️ Сократить
          </button>
          <button
            type="button"
            onClick={() => handleAssist('formal')}
            disabled={!newMessage.trim() || rewrite.status === 'loading'}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            🎩 Формально
          </button>
          <button
            type="button"
            onClick={() => handleAssist('friendly')}
            disabled={!newMessage.trim() || rewrite.status === 'loading'}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            😊 Дружелюбно
          </button>
        </div>

        {rewrite.status === 'loading' && (
          <div className="text-xs text-gray-500 italic mb-2">Обработка текста…</div>
        )}

        {rewrite.status === 'preview' && (
          <div className="mb-2 p-2 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700">
            <div className="text-xs text-gray-500 mb-1">Предпросмотр:</div>
            <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
              {rewrite.preview}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={applyRewrite}
                className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Вставить
              </button>
              <button
                type="button"
                onClick={cancelRewrite}
                className="text-xs px-3 py-1 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {rewrite.status === 'error' && (
          <div className="mb-2 p-2 rounded border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <span>Ошибка AI: {rewrite.error}</span>
            <button
              type="button"
              onClick={() => rewrite.action && handleAssist(rewrite.action)}
              className="underline hover:no-underline"
            >
              Повторить
            </button>
            <button
              type="button"
              onClick={cancelRewrite}
              className="underline hover:no-underline"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {/* Форма отправки */}
      <form onSubmit={handleSend} className="p-4">
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

      {/* Модалка участников */}
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