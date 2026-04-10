'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import { mockMessages } from '@/lib/mockData';
import AIToolsPanel from './AIToolsPanel';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await apiClient.getMessages(chatId); // Используем apiClient
        setMessages(data);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Добавляем сообщение в состояние (оптимистично)
    const tempMessage: Message = {
        id: Date.now().toString(),
        chatId,
      text: newMessage,
        senderId: 'user1',
        timestamp: new Date(),
        status: 'sent',
      };
    setMessages([...messages, tempMessage]);
    setNewMessage('');

    // Отправляем на сервер (или в моки)
    try {
      await apiClient.sendMessage(chatId, newMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Удаляем оптимистичное сообщение, если ошибка
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    }
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
    alert(t('voice_message'));
    setTimeout(() => {
      const voiceMessageText = '🎤 ' + t('voice_message');
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
      <AIToolsPanel />
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
                    {msg.status === 'read' && '✓✓ (' + t('read') + ')'}
                  </span>
                )}
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
            type="button"
            onClick={startVoiceRecording}
            disabled={isRecording}
            className={`px-3 py-2 rounded-md ${
              isRecording
                ? 'bg-red-500 animate-pulse'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white transition`}
            title={t('voice_message')}
          >
            🎙️
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {t('send')}
          </button>
        </div>
        {isRecording && (
          <p className="text-sm text-red-500 mt-2">{t('recording')}</p>
        )}
      </form>
    </div>
  );
}