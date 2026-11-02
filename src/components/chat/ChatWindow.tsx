'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, mapBackendMessage } from '@/lib/apiClient';
import { initSocket, getSocket } from '@/lib/socket';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSocketStatus } from '@/context/SocketContext';
import AIToolsPanel from './AIToolsPanel';
import GroupMembersModal from './GroupMembersModal';
import TranslationBlock from './TranslationBlock';
import RewritePanel, { RewriteAction, RewriteState } from './RewritePanel';
import LoadingState from '@/components/ui/LoadingState';
import Avatar from '@/components/ui/Avatar';
import { Message } from '@/types/chat';
import VoiceComposer, { VoiceDraft } from './VoiceComposer';
import AudioPlayer from './AudioPlayer';
import VoiceTranscript from './VoiceTranscript';
import VoiceSummary from './VoiceSummary';
import ChatSummaryPanel from './ChatSummaryPanel';

interface ChatWindowProps {
  chatId: string;
}

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  prev.forEach((m) => map.set(m.id, m));

  incoming.forEach((m) => {
    const existing = map.get(m.id);
    if (existing) {
      map.set(m.id, {
        ...existing,
        ...m,
        translatedText: m.translatedText ?? existing.translatedText,
        translateStatus: m.translateStatus ?? existing.translateStatus,
        sourceLang: m.sourceLang ?? existing.sourceLang,
        targetLang: m.targetLang ?? existing.targetLang,
        type: m.type ?? existing.type,
        voiceFileId: m.voiceFileId ?? existing.voiceFileId,
        audioUrl: m.audioUrl ?? existing.audioUrl,
        localAudioUrl: m.localAudioUrl ?? existing.localAudioUrl,
        transcript: m.transcript ?? existing.transcript,
        transcriptStatus: m.transcriptStatus ?? existing.transcriptStatus,
        summary: m.summary ?? existing.summary,
        summaryStatus: m.summaryStatus ?? existing.summaryStatus,
        voiceMetadata: m.voiceMetadata ?? existing.voiceMetadata,
        uploadStatus: m.uploadStatus ?? existing.uploadStatus,
        localStatus:
          existing.localStatus === 'sending'
            ? m.localStatus
            : (m.localStatus ?? existing.localStatus),
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
  const [showVoiceComposer, setShowVoiceComposer] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceAbortRef = useRef<Map<number, AbortController>>(new Map());
  const chatIdNum = parseInt(chatId, 10);
  const [chatInfo, setChatInfo] = useState<{ title: string | null; isGroup: boolean } | null>(null);
  const [membersMap, setMembersMap] = useState<Map<number, string>>(new Map());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalKey, setMembersModalKey] = useState(0);
  const [rewrite, setRewrite] = useState<RewriteState>({ status: 'idle' });

  // Панели
  const [showAITools, setShowAITools] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);
  const [showPinned, setShowPinned] = useState(true);

  const targetLanguage = (user?.language || 'en').toLowerCase();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('panel') === 'ai') setShowAITools(true);
      if (sp.get('panel') === 'summary') setShowSummaryPanel(true);
      if (sp.get('sidebar') === 'details') setShowDetailsSidebar(true);
    }
  }, []);

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

  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user.id);
    socket.emit('join_chat', { chatId: chatIdNum });

    const handleNewMessage = (msg: any) => {
      if (Number(msg.chatId) !== chatIdNum) return;
      const incoming = mapBackendMessage(msg);
      incoming.localStatus = msg.userId === user.id ? 'read' : 'delivered';
      setMessages((prev) => mergeMessages(prev, [incoming]));
    };

    const handleMessageTranslated = (data: {
      messageId: number;
      chatId: number;
      translatedText: string;
      translateStatus: 'completed' | 'failed';
    }) => {
      if (Number(data.chatId) !== chatIdNum) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                translatedText: data.translatedText,
                translateStatus: data.translateStatus,
              }
            : m
        )
      );
    };

    const handleMessageTranscribed = (data: {
      messageId: number;
      chatId: number;
      transcript?: string;
      sttStatus?: string;
      transcriptStatus?: string;
    }) => {
      if (Number(data.chatId) !== chatIdNum) return;
      const status =
        data.transcriptStatus ??
        (data.sttStatus === 'pending'
          ? 'processing'
          : data.sttStatus === 'none'
          ? 'skipped'
          : data.sttStatus);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                transcript: data.transcript ?? m.transcript,
                transcriptStatus: (status as any) ?? m.transcriptStatus,
              }
            : m
        )
      );
    };

    const handleMessageVoiceSummary = (data: {
      messageId: number;
      chatId: number;
      summary?: string;
      summaryStatus?: string;
    }) => {
      if (Number(data.chatId) !== chatIdNum) return;
      const status =
        data.summaryStatus === 'none'
          ? 'not_needed'
          : data.summaryStatus === 'pending'
          ? 'processing'
          : data.summaryStatus;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                summary: data.summary ?? m.summary,
                summaryStatus: (status as any) ?? m.summaryStatus,
              }
            : m
        )
      );
    };

    const handleMessageUpdated = (data: { id: number; content: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, content: data.content, isEdited: true } : m
        )
      );
    };

    const handleMessageDeleted = (data: { id: number }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, content: '[Удалено]', isDeleted: true } : m
        )
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_translated', handleMessageTranslated);
    socket.on('message_transcribed', handleMessageTranscribed);
    socket.on('message.transcribed', handleMessageTranscribed);
    socket.on('message_voice_summary', handleMessageVoiceSummary);
    socket.on('message.voice_summary', handleMessageVoiceSummary);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave_chat', { chatId: chatIdNum });
      socket.off('new_message', handleNewMessage);
      socket.off('message_translated', handleMessageTranslated);
      socket.off('message_transcribed', handleMessageTranscribed);
      socket.off('message.transcribed', handleMessageTranscribed);
      socket.off('message_voice_summary', handleMessageVoiceSummary);
      socket.off('message.voice_summary', handleMessageVoiceSummary);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [chatIdNum, user]);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getMessages(chatIdNum);
        if (data && data.length > 0) {
          setMessages((prev) => mergeMessages(prev, data));
        } else {
          setMessages(getMockMessages());
        }
      } catch (error) {
        // Подставляем сообщения из макета Союз, если бэкенд не запущен
        setMessages(getMockMessages());
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [chatIdNum]);

  function getMockMessages(): Message[] {
    return [
      {
        id: 101,
        senderId: 999,
        chatId: chatIdNum,
        content: 'Коллеги, выложил новую версию сборки на тестовый сервер. Проверьте, пожалуйста. Если всё ок — можно мерджить в main.',
        timestamp: new Date(Date.now() - 3600000),
        type: 'text',
        translatedText: 'Colleagues, I uploaded a new build version to the test server. Please check. If all is ok — we can merge to main.',
        translateStatus: 'completed',
        targetLang: 'en',
      },
      {
        id: 102,
        senderId: user?.id || 1,
        chatId: chatIdNum,
        content: 'Всё работает, ошибок не нашёл. Можно мерджить! 🚀',
        timestamp: new Date(Date.now() - 2400000),
        type: 'text',
        localStatus: 'read',
      },
      {
        id: 103,
        senderId: 998,
        chatId: chatIdNum,
        content: 'Отлично! Я уже подготовил релиз-ноты. Сегодня вечером выложим на прод.',
        timestamp: new Date(Date.now() - 1800000),
        type: 'text',
      },
      {
        id: 104,
        senderId: 998,
        chatId: chatIdNum,
        content: '[Документ] release-notes.md (2.4 МБ)',
        timestamp: new Date(Date.now() - 1200000),
        type: 'text',
      },
      {
        id: 105,
        senderId: 999,
        chatId: chatIdNum,
        content: '',
        timestamp: new Date(Date.now() - 600000),
        type: 'voice',
        audioUrl: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
        transcript: 'Привет команде! Завтра в 10:00 проводим синхронизацию по итогам релиза.',
        transcriptStatus: 'completed',
        summary: 'Синхронизация по итогам релиза назначена на завтра в 10:00.',
        summaryStatus: 'completed',
        voiceMetadata: { durationMs: 14000, mimeType: 'audio/ogg', sizeBytes: 52000 },
      },
      {
        id: 106,
        senderId: user?.id || 1,
        chatId: chatIdNum,
        content: 'Супер, спасибо! 👍',
        timestamp: new Date(Date.now() - 60000),
        type: 'text',
        localStatus: 'read',
      },
    ];
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');

    const tempId = Date.now();
    const tempMessage: Message = {
      id: tempId,
      content,
      senderId: user?.id ?? 0,
      chatId: chatIdNum,
      timestamp: new Date(),
      originalText: content,
      sourceLang: 'auto',
      targetLang: targetLanguage,
      translatedText: null,
      translateStatus: 'pending',
      localStatus: 'sending',
      type: 'text',
    };
    setMessages((prev) => mergeMessages(prev, [tempMessage]));

    let fallbackTimer: NodeJS.Timeout;
    const socket = getSocket();
    const cleanupFallback = () => fallbackTimer && clearTimeout(fallbackTimer);

    const onNewMessageConfirm = (msg: any) => {
      if (msg.userId === user?.id && msg.content === content && msg.chatId === chatIdNum) {
        cleanupFallback();
        socket?.off('new_message', onNewMessageConfirm);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: msg.id,
                  localStatus: 'sent',
                  timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                }
              : m
          )
        );
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, localStatus: 'delivered' } : m))
          );
        }, 800);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, localStatus: 'read' } : m))
          );
        }, 2000);
      }
    };
    socket?.on('new_message', onNewMessageConfirm);

    fallbackTimer = setTimeout(async () => {
      socket?.off('new_message', onNewMessageConfirm);
      try {
        const fresh = await apiClient.getMessages(chatIdNum);
        setMessages((prev) => mergeMessages(prev, fresh));
      } catch (err) {
        console.error('Fallback failed:', err);
      }
    }, 5000);

    try {
      await apiClient.sendMessage(chatIdNum, content, 'auto', targetLanguage);
    } catch (error) {
      console.error('Failed to send message:', error);
      cleanupFallback();
      socket?.off('new_message', onNewMessageConfirm);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleVoiceReady = async (draft: VoiceDraft) => {
    const tempId = -Date.now();

    const voiceMessage: Message = {
      id: tempId,
      content: '',
      senderId: user?.id ?? 0,
      chatId: chatIdNum,
      timestamp: new Date(),
      type: 'voice',
      localAudioUrl: draft.localUrl,
      audioUrl: null,
      transcript: null,
      transcriptStatus: 'processing',
      summary: null,
      summaryStatus: 'not_needed',
      voiceMetadata: {
        durationMs: draft.durationMs,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
      },
      uploadStatus: 'uploading',
      localStatus: 'sending',
    };

    setMessages((prev) => mergeMessages(prev, [voiceMessage]));
    setVoiceDraft(null);
    setShowVoiceComposer(false);

    const controller = new AbortController();
    voiceAbortRef.current.set(tempId, controller);

    try {
      if (controller.signal.aborted) return;

      const result = await apiClient.sendVoiceMessage(
        chatIdNum,
        draft.blob,
        {
          durationMs: draft.durationMs,
          mimeType: draft.mimeType,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      let playUrl = draft.localUrl;
      try {
        if (result.voiceFileId) {
          const serverBlob = await apiClient.getVoiceAudio(result.voiceFileId);
          if (!controller.signal.aborted) {
            playUrl = URL.createObjectURL(serverBlob);
          }
        }
      } catch (e) {
        console.warn('[voice] JWT fetch failed, keep local preview', e);
      }

      if (controller.signal.aborted) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: result.id,
                audioUrl: result.audioUrl,
                localAudioUrl: playUrl,
                voiceFileId: result.voiceFileId ?? undefined,
                uploadStatus: 'uploaded',
                localStatus: 'sent',
                transcriptStatus: 'processing',
                summaryStatus: 'not_needed',
                voiceMetadata: {
                  durationMs: result.durationMs || draft.durationMs,
                  mimeType: result.mimeType || draft.mimeType,
                  sizeBytes: draft.sizeBytes,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Voice upload failed', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, uploadStatus: 'error', localStatus: undefined }
            : m
        )
      );
    } finally {
      voiceAbortRef.current.delete(tempId);
    }
  };

  const handleVoiceCancelUpload = (messageId: number) => {
    const controller = voiceAbortRef.current.get(messageId);
    controller?.abort();
    voiceAbortRef.current.delete(messageId);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, uploadStatus: 'cancelled', localStatus: undefined }
          : m
      )
    );
  };

  const handleVoiceRetry = async (msg: Message) => {
    if (!msg.localAudioUrl && !msg.audioUrl) return;

    let blob: Blob;
    try {
      const url = msg.localAudioUrl || msg.audioUrl!;
      const res = await fetch(url);
      blob = await res.blob();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, uploadStatus: 'error' } : m))
      );
      return;
    }

    const meta = msg.voiceMetadata ?? {
      durationMs: 0,
      mimeType: blob.type || 'audio/webm',
      sizeBytes: blob.size,
    };

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, uploadStatus: 'uploading', localStatus: 'sending' }
          : m
      )
    );

    const controller = new AbortController();
    voiceAbortRef.current.set(msg.id, controller);

    try {
      const result = await apiClient.sendVoiceMessage(
        chatIdNum,
        blob,
        {
          durationMs: meta.durationMs,
          mimeType: meta.mimeType,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      let playUrl = msg.localAudioUrl || undefined;
      try {
        if (result.voiceFileId) {
          const serverBlob = await apiClient.getVoiceAudio(result.voiceFileId);
          if (!controller.signal.aborted) {
            playUrl = URL.createObjectURL(serverBlob);
          }
        }
      } catch (e) {
        console.warn('[voice] JWT fetch failed on retry', e);
      }

      if (controller.signal.aborted) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                id: result.id,
                audioUrl: result.audioUrl,
                localAudioUrl: playUrl ?? m.localAudioUrl,
                voiceFileId: result.voiceFileId ?? undefined,
                uploadStatus: 'uploaded',
                localStatus: 'sent',
                transcriptStatus: 'processing',
                summaryStatus: 'not_needed',
                voiceMetadata: {
                  durationMs: result.durationMs || meta.durationMs,
                  mimeType: result.mimeType || meta.mimeType,
                  sizeBytes: meta.sizeBytes,
                },
              }
            : m
        )
      );
    } catch {
      if (controller.signal.aborted) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, uploadStatus: 'error' } : m))
      );
    } finally {
      voiceAbortRef.current.delete(msg.id);
    }
  };

  const handleVoiceRemoveCancelled = (messageId: number) => {
    setMessages((prev) => {
      const target = prev.find((m) => m.id === messageId);
      if (target?.localAudioUrl) {
        try {
          URL.revokeObjectURL(target.localAudioUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((m) => m.id !== messageId);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Имитация отправки файла / документа в чат
    const content = `[Документ] ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} МБ)`;
    setNewMessage(content);
  };

  const renderStatusTicks = (status?: string) => {
    switch (status) {
      case 'sending':
        return <span className="text-[10px] opacity-70">⏳</span>;
      case 'sent':
        return <span className="text-xs">✓</span>;
      case 'delivered':
        return <span className="text-xs font-semibold">✓✓</span>;
      case 'read':
        return <span className="text-xs font-semibold text-sky-200">✓✓</span>;
      default:
        return null;
    }
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'owner') return <span className="text-amber-500 text-xs font-semibold">👑 Владелец</span>;
    if (role === 'admin') return <span className="text-blue-500 text-xs font-semibold">⭐ Админ</span>;
    return null;
  };

  const refreshRoles = () => setMembersModalKey((prev) => prev + 1);

  const handleAssist = async (action: RewriteAction) => {
    const draft = newMessage.trim();
    if (!draft) return;

    setRewrite({ status: 'loading', action, originalDraft: draft });

    try {
      const res = await apiClient.assistText(draft, action);
      setRewrite({
        status: 'preview',
        action,
        originalDraft: draft,
        preview: res.resultText,
        mock: res.mock,
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

  const retryRewrite = () => {
    if (rewrite.action) handleAssist(rewrite.action);
  };

  const title = chatInfo?.title || (chatInfo?.isGroup ? `Группа #${chatId}` : `Диалог #${chatId}`);
  const memberCount = membersMap.size || 24;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#f0f4ff] dark:bg-[#0b1026]">
        <LoadingState text="Загрузка сообщений…" size="md" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f0f4ff] dark:bg-[#0b1026] relative">
      {/* ========================================================= */}
      {/* Центральная часть: Чат (сообщения и поле ввода)           */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white/70 dark:bg-[#0e1438]/90 backdrop-blur-sm border-r border-[#dde4f0] dark:border-[#1e2955]">
        {/* ========================================================= */}
        {/* Шапка чата (по макету Союз)                               */}
        {/* ========================================================= */}
        <header className="px-4 py-3 border-b border-[#dde4f0] dark:border-[#1e2955] flex items-center justify-between bg-white dark:bg-[#111640] select-none shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {/* Кнопка "Назад" для мобильных экранов */}
            <Link
              href="/chat"
              className="md:hidden p-1.5 -ml-1 text-gray-500 hover:text-blue-600 rounded-xl"
              title="Назад к списку чатов"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Аватар чата */}
            <div
              className="cursor-pointer"
              onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
            >
              <Avatar name={title} size="md" isOnline={isConnected} />
            </div>

            {/* Заголовок и подзаголовок */}
            <div
              className="min-w-0 cursor-pointer"
              onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
            >
              <h2 className="font-semibold text-sm sm:text-base text-[#1a2038] dark:text-white truncate">
                {title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#6070a0] dark:text-[#7b8db5]">
                {chatInfo?.isGroup ? (
                  <span>{memberCount} участников</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    <span>{isConnected ? 'в сети' : 'был(а) недавно'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Действия в шапке */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Кнопка AI Tools */}
            <button
              type="button"
              onClick={() => {
                setShowAITools(!showAITools);
                setShowSummaryPanel(false);
              }}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors ${
                showAITools
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248]'
              }`}
              title="ИИ-инструменты"
            >
              <span>🤖</span>
              <span className="hidden lg:inline text-xs">ИИ</span>
            </button>

            {/* Кнопка сводки чата */}
            <button
              type="button"
              onClick={() => {
                setShowSummaryPanel(!showSummaryPanel);
                setShowAITools(false);
              }}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors ${
                showSummaryPanel
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-500 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-[#1a2248]'
              }`}
              title="Сводка переписки"
            >
              <span>⚡</span>
              <span className="hidden lg:inline text-xs">Сводка</span>
            </button>

            {/* Иконка звонка */}
            <button
              type="button"
              className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors"
              title="Аудиозвонок"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>

            {/* Иконка видеозвонка */}
            <button
              type="button"
              className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors"
              title="Видеозвонок"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Переключатель правой боковой панели */}
            <button
              type="button"
              onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
              className={`p-2 rounded-xl transition-colors ${
                showDetailsSidebar
                  ? 'bg-blue-50 text-blue-600 dark:bg-[#1a2248] dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a2248]'
              }`}
              title="Информация о чате"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* Выдвижные AI панели                                       */}
        {/* ========================================================= */}
        <AIToolsPanel
          messages={messages}
          isOpen={showAITools}
          onClose={() => setShowAITools(false)}
          onTranscript={(text) => {
            setNewMessage((prev) => (prev ? `${prev} ${text}` : text));
          }}
        />

        <ChatSummaryPanel
          messages={messages}
          language={(user?.language || 'ru').toLowerCase()}
          isOpen={showSummaryPanel}
          onClose={() => setShowSummaryPanel(false)}
        />

        {/* ========================================================= */}
        {/* Закреплённое сообщение (Pinned message)                   */}
        {/* ========================================================= */}
        {showPinned && (
          <div className="px-4 py-2 bg-blue-50/70 dark:bg-[#131b4a] border-b border-[#dde4f0] dark:border-[#1e2955] flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-blue-500 dark:text-blue-400 text-sm shrink-0">📌</span>
              <div className="min-w-0 truncate">
                <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
                  Закреплённое сообщение:
                </span>
                <span className="text-[#6070a0] dark:text-[#9babc6] truncate">
                  Добро пожаловать в проект Союз! Все ключевые функции перевода и ИИ активны.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPinned(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 shrink-0"
              title="Скрыть"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* Лента сообщений                                           */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Разделитель даты (по центру) */}
          <div className="flex justify-center select-none my-2">
            <span className="px-3.5 py-1 rounded-full text-[11px] font-medium bg-gray-200/60 dark:bg-[#1a2248] text-[#6070a0] dark:text-[#7b8db5] shadow-sm">
              Сегодня, 15 апреля
            </span>
          </div>

          {messages.length === 0 && (
            <div className="text-center py-12 text-sm text-[#6070a0] dark:text-[#7b8db5]">
              В этом чате пока нет сообщений. Напишите первое!
            </div>
          )}

          {messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            const senderRole = membersMap.get(msg.senderId);
            const isFile = msg.content.startsWith('[Документ]');

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 group ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {/* Аватар отправителя (если чужое сообщение) */}
                {!isOwn && (
                  <Avatar
                    name={membersMap.get(msg.senderId) || `User ${msg.senderId}`}
                    size="sm"
                    className="mb-1"
                  />
                )}

                {/* Баббл сообщения */}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] p-3.5 transition-all ${
                    isOwn
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-sm shadow-md shadow-blue-500/15'
                      : 'bg-white dark:bg-[#151b45] text-[#1a2038] dark:text-[#e8ecf4] border border-[#dde4f0] dark:border-[#1e2955] rounded-2xl rounded-bl-sm shadow-sm'
                  }`}
                >
                  {/* Имя отправителя в группе */}
                  {!isOwn && chatInfo?.isGroup && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      <span>{membersMap.get(msg.senderId) || `Участник #${msg.senderId}`}</span>
                      {getRoleBadge(senderRole)}
                    </div>
                  )}

                  {/* Контент: Файл, Голосовое или Текст */}
                  {msg.isDeleted ? (
                    <p className="italic opacity-60 text-xs">[Сообщение удалено]</p>
                  ) : isFile ? (
                    /* Карточка документа */
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-blue-500/10 dark:bg-black/20 border border-white/20">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{msg.content.replace('[Документ] ', '')}</p>
                        <p className="text-[10px] opacity-70">Файл документа</p>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                        title="Скачать"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  ) : msg.type === 'voice' ? (
                    /* Голосовое сообщение */
                    <div className="space-y-2">
                      <AudioPlayer
                        src={msg.localAudioUrl || msg.audioUrl}
                        durationMs={msg.voiceMetadata?.durationMs}
                        isOwn={isOwn}
                      />

                      {msg.uploadStatus === 'uploading' && (
                        <div className="flex items-center justify-between text-xs opacity-80 pt-1">
                          <span className="animate-pulse">Отправка аудио…</span>
                          <button
                            type="button"
                            onClick={() => handleVoiceCancelUpload(msg.id)}
                            className="underline hover:opacity-100"
                          >
                            Отмена
                          </button>
                        </div>
                      )}

                      {msg.uploadStatus === 'error' && (
                        <div className="flex items-center justify-between text-xs text-red-300 pt-1">
                          <span>Ошибка отправки</span>
                          <button
                            type="button"
                            onClick={() => handleVoiceRetry(msg)}
                            className="underline font-medium"
                          >
                            Повторить
                          </button>
                        </div>
                      )}

                      {msg.uploadStatus === 'cancelled' && (
                        <div className="flex items-center gap-2 text-xs opacity-80 pt-1">
                          <span>Отменено</span>
                          <button
                            type="button"
                            onClick={() => handleVoiceRetry(msg)}
                            className="underline"
                          >
                            Отправить снова
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVoiceRemoveCancelled(msg.id)}
                            className="underline"
                          >
                            Удалить
                          </button>
                        </div>
                      )}

                      {/* Стенограмма (STT) */}
                      <VoiceTranscript
                        transcript={msg.transcript}
                        status={msg.transcriptStatus}
                        isOwn={isOwn}
                      />

                      {/* Краткое содержание (AI Summary) */}
                      <VoiceSummary
                        summary={msg.summary}
                        status={msg.summaryStatus}
                        isOwn={isOwn}
                      />
                    </div>
                  ) : (
                    /* Обычный текст */
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                      {msg.content}
                    </p>
                  )}

                  {/* Нижняя строка: Время + статус доставки */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
                      isOwn ? 'text-blue-100' : 'text-[#6070a0] dark:text-[#7b8db5]'
                    }`}
                  >
                    {msg.isEdited && <span>(ред.)</span>}
                    <span>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && renderStatusTicks(msg.localStatus)}
                  </div>

                  {/* Блок перевода для текстовых сообщений */}
                  {msg.type !== 'voice' && !isFile && (
                    <TranslationBlock message={msg} isOwn={isOwn} />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================= */}
        {/* Панель AI-рерайта над строкой ввода                       */}
        {/* ========================================================= */}
        <RewritePanel
          draft={newMessage}
          state={rewrite}
          onAction={handleAssist}
          onApply={applyRewrite}
          onCancel={cancelRewrite}
          onRetry={retryRewrite}
        />

        {/* ========================================================= */}
        {/* Нижняя панель ввода сообщения                             */}
        {/* ========================================================= */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#111640] border-t border-[#dde4f0] dark:border-[#1e2955] shrink-0">
          {showVoiceComposer ? (
            <VoiceComposer
              disabled={false}
              onReady={handleVoiceReady}
              onCancel={() => {
                if (voiceDraft?.localUrl) {
                  URL.revokeObjectURL(voiceDraft.localUrl);
                }
                setVoiceDraft(null);
                setShowVoiceComposer(false);
              }}
            />
          ) : (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              {/* Кнопка скрепки (прикрепить файл) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-2xl text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors shrink-0"
                title="Прикрепить файл"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Поле ввода сообщения */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Написать сообщение…"
                  className="w-full pl-4 pr-10 py-3 text-sm rounded-2xl border border-[#dde4f0] dark:border-[#1e2955] bg-gray-50 dark:bg-[#0f1535] text-[#1a2038] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />

                {/* Кнопка смайла */}
                <button
                  type="button"
                  onClick={() => setNewMessage((prev) => `${prev} 😊`)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  title="Добавить эмодзи"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              {/* Кнопка микрофона */}
              <button
                type="button"
                onClick={() => setShowVoiceComposer(true)}
                className="p-2.5 rounded-2xl text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors shrink-0"
                title="Голосовое сообщение"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Кнопка отправки (самолётик) */}
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center hover:from-blue-700 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-95 transition-all shrink-0"
                title="Отправить"
              >
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Правая панель: Информация о группе / собеседнике (Third) */}
      {/* ========================================================= */}
      {showDetailsSidebar && (
        <aside className="w-80 h-full bg-white dark:bg-[#111640] border-l border-[#dde4f0] dark:border-[#1e2955] flex flex-col overflow-y-auto animate-slide-in-right shrink-0 select-none">
          {/* Шапка сайдбара */}
          <div className="p-4 border-b border-[#dde4f0] dark:border-[#1e2955] flex items-center justify-between">
            <h3 className="font-semibold text-sm">Информация о чате</h3>
            <button
              type="button"
              onClick={() => setShowDetailsSidebar(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Карточка профиля чата */}
          <div className="p-6 flex flex-col items-center text-center border-b border-[#dde4f0] dark:border-[#1e2955]">
            <Avatar name={title} size="xl" isOnline={isConnected} className="mb-3" />
            <h4 className="text-base font-bold text-[#1a2038] dark:text-white truncate max-w-[240px]">
              {title}
            </h4>
            <p className="text-xs text-[#6070a0] dark:text-[#7b8db5] mt-0.5">
              {chatInfo?.isGroup ? `${memberCount} участников` : 'Личный контакт'}
            </p>

            {/* Быстрые действия */}
            <div className="flex items-center gap-4 mt-5">
              <button className="flex flex-col items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600">
                <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#1a2248] flex items-center justify-center">🔍</span>
                <span>Поиск</span>
              </button>
              {chatInfo?.isGroup && (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="flex flex-col items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600"
                >
                  <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#1a2248] flex items-center justify-center">👥</span>
                  <span>Участники</span>
                </button>
              )}
              <button className="flex flex-col items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600">
                <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#1a2248] flex items-center justify-center">🔔</span>
                <span>Уведомл.</span>
              </button>
            </div>
          </div>

          {/* Секции медиа и файлов */}
          <div className="p-4 space-y-3 border-b border-[#dde4f0] dark:border-[#1e2955] text-xs">
            <div className="flex items-center justify-between text-[#1a2038] dark:text-white cursor-pointer hover:opacity-80">
              <span className="flex items-center gap-2">
                <span>📁</span> Медиа, файлы
              </span>
              <span className="text-gray-400">128 ›</span>
            </div>
            <div className="flex items-center justify-between text-[#1a2038] dark:text-white cursor-pointer hover:opacity-80">
              <span className="flex items-center gap-2">
                <span>🔗</span> Ссылки
              </span>
              <span className="text-gray-400">24 ›</span>
            </div>
            <div className="flex items-center justify-between text-[#1a2038] dark:text-white cursor-pointer hover:opacity-80">
              <span className="flex items-center gap-2">
                <span>📌</span> Закреплённые сообщения
              </span>
              <span className="text-gray-400">1 ›</span>
            </div>
          </div>

          {/* Список участников */}
          {chatInfo?.isGroup && (
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3 text-xs font-semibold text-[#6070a0] dark:text-[#7b8db5]">
                <span>Участники ({membersMap.size})</span>
                <button
                  type="button"
                  onClick={() => setShowMembersModal(true)}
                  className="text-blue-500 hover:underline"
                >
                  Управление
                </button>
              </div>

              <div className="space-y-2">
                {Array.from(membersMap.entries()).map(([mId, role]) => (
                  <div key={mId} className="flex items-center gap-2.5">
                    <Avatar name={`User ${mId}`} size="sm" isOnline />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-[#1a2038] dark:text-white">
                        {mId === user?.id ? `${user.name || 'Вы'} (Вы)` : `Пользователь #${mId}`}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {role === 'owner' ? 'Владелец' : role === 'admin' ? 'Админ' : 'в сети'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Модальное окно участников группы */}
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
