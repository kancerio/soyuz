'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import { mockMessages } from '@/lib/mockData';
import AIToolsPanel from './AIToolsPanel';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Загружаем сообщения для чата
    setMessages(mockMessages[chatId] || []);
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const tempMessage: Message = {
      id: Date.now().toString(),
      chatId,
      text: newMessage,
      senderId: 'user1', // текущий пользователь
      timestamp: new Date(),
      status: 'sent',
    };
    setMessages([...messages, tempMessage]);
    setNewMessage('');

    // Имитируем доставку и прочтение
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'delivered' } : msg
        )
      );
    }, 500);
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'read' } : msg
        )
      );
    }, 1000);
  };

  //Имитация голосовой записи
  const startVoiceRecording = () => {
    setIsRecording(true);
    alert('Запись голосового сообщения (заглушка)');
    // Через 2 секунды имитируем отправку голосового сообщения
    setTimeout(() => {
      const voiceMessageText = '🎤 Голосовое сообщение (заглушка)';
      const tempVoiceMessage: Message = {
        id: Date.now().toString(),
        chatId,
        text: voiceMessageText,
        senderId: 'user1',
        timestamp: new Date(),
        status: 'sent',
      };
      setMessages(prev => [...prev, tempVoiceMessage]);
      setIsRecording(false);
      // Имитация статусов
      setTimeout(() => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempVoiceMessage.id ? { ...msg, status: 'delivered' } : msg
          )
        );
      }, 500);
      setTimeout(() => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempVoiceMessage.id ? { ...msg, status: 'read' } : msg
          )
        );
      }, 1000);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Панель ИИ-инструментов */}
      <AIToolsPanel />

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === 'user1' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.senderId === 'user1'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <p>{msg.text}</p>
              <div className="text-xs opacity-70 mt-1 flex justify-end gap-1">
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.senderId === 'user1' && (
                  <span>
                    {msg.status === 'sent' && '✓'}
                    {msg.status === 'delivered' && '✓✓'}
                    {msg.status === 'read' && '✓✓ (прочитано)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Форма отправки с голосовой кнопкой */}
      <form onSubmit={handleSend} className="p-4 border-t dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение..."
            className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={startVoiceRecording}
            disabled={isRecording}
            className={`px-3 py-2 rounded-md ${
              isRecording
                ? 'bg-red-500 animate-pulse'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white transition`}
            title="Голосовое сообщение"
          >
            🎙️
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Отправить
          </button>
        </div>
        {isRecording && (
          <p className="text-sm text-red-500 mt-2">Запись... (заглушка)</p>
        )}
      </form>
    </div>
  );
}