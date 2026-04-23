'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import { apiClient } from '@/lib/apiClient';
import { initSocket } from '@/lib/socket';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import AIToolsPanel from './AIToolsPanel';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const { t } = useLanguage();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatIdNum = parseInt(chatId, 10);

  // WebSocket подписка
  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user.id);
    const handleNewMessage = (msg: Message) => {
      if (msg.chatId === chatIdNum) {
        setMessages((prev) => [...prev, msg]);
      }
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
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [chatIdNum, user]);

  // Загрузка истории
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getMessages(chatIdNum);
        // Приведение полей к единому виду
        const mapped = data.map((m: any) => ({
          ...m,
          text: m.content,
          senderId: m.userId,
          timestamp: new Date(m.createdAt),
          status: 'read',
        }));
        setMessages(mapped);
      } catch (error) {
        console.error(error);
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

    // Оптимистичное добавление
    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: content,
        senderId: user?.id ?? 0,
        chatId: chatIdNum,
        timestamp: new Date(),
        status: 'sent',
      } as Message,
    ]);

    try {
      await apiClient.sendMessage(chatIdNum, content);
      // Реальное сообщение придёт через WebSocket, удаляем временное
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (error) {
      console.error(error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  if (loading) return <div className="p-4">Загрузка сообщений...</div>;

  return (
    <div className="flex flex-col h-full">
      <AIToolsPanel />
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
              <p>{msg.text}</p>
              <div className="text-xs opacity-70 mt-1 flex justify-end gap-1">
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {msg.senderId === user?.id && msg.isEdited && <span>(ред.)</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
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
    </div>
  );
}