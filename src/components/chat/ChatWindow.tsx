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
import TranslationBlock from './TranslationBlock';
import RewritePanel, { RewriteAction, RewriteState } from './RewritePanel';
import LoadingState from '@/components/ui/LoadingState';
import { Message } from '@/types/chat';
import VoiceComposer, { VoiceDraft } from './VoiceComposer';
import AudioPlayer from './AudioPlayer';
import VoiceTranscript from './VoiceTranscript';
import VoiceSummary from './VoiceSummary';

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
  const voiceAbortRef = useRef<Map<number, AbortController>>(new Map());
  const chatIdNum = parseInt(chatId, 10);
  const [chatInfo, setChatInfo] = useState<{ title: string | null; isGroup: boolean } | null>(null);
  const [membersMap, setMembersMap] = useState<Map<number, string>>(new Map());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersModalKey, setMembersModalKey] = useState(0);
  const [rewrite, setRewrite] = useState<RewriteState>({ status: 'idle' });

  const targetLanguage = (user?.language || 'en').toLowerCase();

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
      const incoming: Message = {
        id: msg.id,
        content: msg.content,
        senderId: msg.userId,
        chatId: msg.chatId,
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        isEdited: msg.isEdited ?? false,
        isDeleted: msg.isDeleted ?? false,
        isDelivered: msg.isDelivered ?? false,
        isRead: msg.isRead ?? false,
        readAt: msg.readAt ?? null,
        originalText: msg.originalText ?? msg.content,
        sourceLang: msg.sourceLang ?? null,
        translatedText: msg.translatedText ?? null,
        targetLang: msg.targetLang ?? null,
        translateStatus: msg.translateStatus ?? 'skipped',
        localStatus: msg.userId === user.id ? 'read' : 'delivered',
        type: msg.type ?? 'text',
        audioUrl: msg.audioUrl ?? null,
        transcript: msg.transcript ?? null,
        transcriptStatus: msg.transcriptStatus ?? undefined,
        summary: msg.summary ?? null,
        summaryStatus: msg.summaryStatus ?? undefined,
        voiceMetadata: msg.voiceMetadata ?? null,
      };
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
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave_chat', { chatId: chatIdNum });
      socket.off('new_message', handleNewMessage);
      socket.off('message_translated', handleMessageTranslated);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [chatIdNum, user]);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiClient.getMessages(chatIdNum);
        setMessages((prev) => mergeMessages(prev, data));
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
        }, 1000);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, localStatus: 'read' } : m))
          );
        }, 3000);
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
      transcriptStatus: 'pending',
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

      const result = await apiClient.sendVoiceMessage(chatIdNum, draft.blob, {
        durationMs: draft.durationMs,
        mimeType: draft.mimeType,
      });

      if (controller.signal.aborted) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: result.id,
                audioUrl: result.audioUrl || draft.localUrl,
                uploadStatus: 'uploaded',
                localStatus: 'sent',
                transcriptStatus: 'processing',
              }
            : m
        )
      );

      const finalId = result.id;
      const durationMs = draft.durationMs;

      setTimeout(() => {
        const mockTranscript =
          durationMs > 60_000
            ? (
                '[mock] ' +
                'Это длинное голосовое сообщение для проверки summary. '.repeat(20)
              ).trim()
            : '[mock] Пример распознанного текста голосового сообщения.';

        const needSummary =
          durationMs > 60_000 || mockTranscript.length > 250;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalId
              ? {
                  ...m,
                  transcript: mockTranscript,
                  transcriptStatus: 'completed' as const,
                  summaryStatus: needSummary
                    ? ('processing' as const)
                    : ('not_needed' as const),
                }
              : m
          )
        );

        if (needSummary) {
          setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalId
                  ? {
                      ...m,
                      summary:
                        '[mock] Кратко: основное содержание голосового сообщения.',
                      summaryStatus: 'completed' as const,
                    }
                  : m
              )
            );
          }, 1500);
        }
      }, 2000);
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
      const result = await apiClient.sendVoiceMessage(chatIdNum, blob, {
        durationMs: meta.durationMs,
        mimeType: meta.mimeType,
      });
      if (controller.signal.aborted) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                id: result.id,
                audioUrl: result.audioUrl || msg.localAudioUrl || null,
                uploadStatus: 'uploaded',
                localStatus: 'sent',
                transcriptStatus: 'processing',
              }
            : m
        )
      );

      const finalId = result.id;
      const durationMs = meta.durationMs;

      setTimeout(() => {
        const mockTranscript =
          durationMs > 60_000
            ? (
                '[mock] ' +
                'Это длинное голосовое сообщение для проверки summary. '.repeat(20)
              ).trim()
            : '[mock] Пример распознанного текста голосового сообщения.';

        const needSummary =
          durationMs > 60_000 || mockTranscript.length > 250;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalId
              ? {
                  ...m,
                  transcript: mockTranscript,
                  transcriptStatus: 'completed' as const,
                  summaryStatus: needSummary
                    ? ('processing' as const)
                    : ('not_needed' as const),
                }
              : m
          )
        );

        if (needSummary) {
          setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalId
                  ? {
                      ...m,
                      summary:
                        '[mock] Кратко: основное содержание голосового сообщения.',
                      summaryStatus: 'completed' as const,
                    }
                  : m
              )
            );
          }, 1500);
        }
      }, 2000);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState text="Загрузка сообщений…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AIToolsPanel />

      <div className="p-2 border-b dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
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

      {chatInfo?.isGroup && (
        <div
          onClick={() => setShowMembersModal(true)}
          className="p-2 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-center"
        >
          <h2 className="text-lg font-semibold">{chatInfo.title || 'Группа'}</h2>
          <div className="text-xs text-gray-500">Нажмите для просмотра участников</div>
        </div>
      )}

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
              {msg.senderId !== user?.id && (
                <div className="font-semibold text-sm mb-1">
                  {getRoleSymbol(membersMap.get(msg.senderId))}
                </div>
              )}

              {msg.isDeleted ? (
                <p>[Удалено]</p>
              ) : msg.type === 'voice' ? (
                <div className="space-y-2 min-w-[200px]">
                  <AudioPlayer
                    src={msg.localAudioUrl || msg.audioUrl}
                    durationMs={msg.voiceMetadata?.durationMs}
                    compact
                  />

                  {msg.uploadStatus === 'uploading' && (
                    <div className="flex items-center justify-between text-xs opacity-80">
                      <span>Отправка…</span>
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
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-300">Ошибка загрузки</span>
                      <button
                        type="button"
                        onClick={() => handleVoiceRetry(msg)}
                        className="underline"
                      >
                        Повторить
                      </button>
                    </div>
                  )}

                  {msg.uploadStatus === 'cancelled' && (
                    <div className="flex items-center gap-2 text-xs opacity-80">
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

                  <VoiceTranscript
                    transcript={msg.transcript}
                    status={msg.transcriptStatus}
                    isOwn={msg.senderId === user?.id}
                  />

                  <VoiceSummary
                    summary={msg.summary}
                    status={msg.summaryStatus}
                    isOwn={msg.senderId === user?.id}
                  />
                </div>
              ) : (
                <p>{msg.content}</p>
              )}

              <div className="text-xs opacity-70 mt-1 flex justify-end gap-1">
                <span>{msg.timestamp.toLocaleTimeString()}</span>
                {msg.senderId === user?.id && <span>{getStatusIcon(msg.localStatus)}</span>}
                {msg.isEdited && <span>(ред.)</span>}
              </div>

              {msg.type !== 'voice' && (
                <TranslationBlock message={msg} isOwn={msg.senderId === user?.id} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <RewritePanel
        draft={newMessage}
        state={rewrite}
        onAction={handleAssist}
        onApply={applyRewrite}
        onCancel={cancelRewrite}
        onRetry={retryRewrite}
      />

      <form onSubmit={handleSend} className="p-4">
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
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setShowVoiceComposer(true)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
              title="Голосовое сообщение"
              aria-label="Голосовое сообщение"
            >
              🎤
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('type_message')}
              className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shrink-0"
            >
              {t('send')}
            </button>
          </div>
        )}
      </form>

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