'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { initSocket } from '@/lib/socket';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import AIToolsPanel from './AIToolsPanel';

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

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const { t } = useLanguage();
  const { user } = useUser();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdNum = parseInt(chatId, 10);

  // WebSocket подписка и подключение к комнате
  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user.id);
    
    // Присоединяемся к комнате чата
    socket.emit('join_chat', { chatId: chatIdNum });
    console.log(`🔗 Joined chat room: ${chatIdNum}`);

    const handleNewMessage = (msg: any) => {
      console.log('🟢 new_message received:', msg);
      // Приводим chatId к числу для безопасного сравнения
      if (Number(msg.chatId) !== chatIdNum) return;
      
      setMessages((prev) => {
        // Избегаем дублирования по id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            text: msg.content,
            senderId: msg.userId,
            chatId: msg.chatId,
            timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            status: msg.userId === user.id ? 'read' : 'delivered',
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
          status: 'read',
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

  // Авто-скролл вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');

    // Оптимистичное добавление сообщения со статусом 'sending'
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

    try {
      const sent = await apiClient.sendMessage(chatIdNum, content);
      // Обновляем временное сообщение реальными данными от сервера
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: sent.id,
                status: 'sent',
                timestamp: sent.createdAt ? new Date(sent.createdAt) : new Date(),
              }
            : msg
        )
      );
      // Имитация получения статусов (если бэкенд их не присылает)
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === sent.id ? { ...msg, status: 'delivered' } : msg
          )
        );
      }, 1000);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === sent.id ? { ...msg, status: 'read' } : msg
          )
        );
      }, 3000);
    } catch (error) {
      console.error('Failed to send message:', error);
      // При ошибке удаляем временное сообщение
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
              <p>{msg.isDeleted ? '[Удалено]' : msg.text}</p>
              <div className="text-xs opacity-70 mt-1 flex justify-end gap-1">
                <span>{msg.timestamp.toLocaleTimeString()}</span>
                {msg.senderId === user?.id && (
                  <span>{getStatusIcon(msg.status)}</span>
                )}
                {msg.isEdited && <span>(ред.)</span>}
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