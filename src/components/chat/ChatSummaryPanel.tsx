'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Message } from '@/types/chat';
import LoadingState from '@/components/ui/LoadingState';

type Phase = 'idle' | 'loading' | 'done' | 'error';

interface ChatSummaryPanelProps {
  messages: Message[];
  language?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ChatSummaryPanel({
  messages,
  language = 'ru',
  isOpen = false,
  onClose,
}: ChatSummaryPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const usable = messages.filter((m) => {
    if (m.isDeleted) return false;
    if (m.type === 'voice') {
      return Boolean(m.transcript?.trim());
    }
    return Boolean(m.content?.trim() && m.content !== '[Голосовое сообщение]');
  });

  const buildPayload = () =>
    usable.map((m) => ({
      sender_id: String(m.senderId),
      text: m.type === 'voice' && m.transcript ? m.transcript : m.content,
      timestamp: m.timestamp.toISOString(),
    }));

  const run = async () => {
    if (!usable.length) {
      setPhase('error');
      setError('Недостаточно сообщений для формирования сводки');
      return;
    }
    setPhase('loading');
    setError(null);
    setSummary('');
    setDetails([]);
    setCopied(false);

    try {
      const res = await apiClient.summarizeMessages(language, buildPayload());
      if (res.status === 'failed' || !res.summary) {
        throw new Error('Не удалось сформировать сводку диалога');
      }
      setSummary(res.summary);
      const extra: string[] = [];
      if (res.decisions?.length) {
        extra.push('Ключевые решения:', ...res.decisions.map((d) => `• ${d}`));
      }
      if (res.participants?.length) {
        extra.push(`Участники: ${res.participants.join(', ')}`);
      }
      setDetails(extra);
      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Ошибка генерации сводки');
    }
  };

  const copy = async () => {
    const text = [summary, ...details].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать в буфер');
    }
  };

  const reset = () => {
    setPhase('idle');
    setSummary('');
    setDetails([]);
    setError(null);
    setCopied(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="border-b border-[#dde4f0] dark:border-[#1e2955] px-4 py-3 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/30 backdrop-blur-sm animate-slide-up">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
            ИИ-сводка беседы
          </span>
          <span className="text-[11px] text-[#6070a0] dark:text-[#7b8db5]">
            ({usable.length} доступных сообщ.)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'idle' && (
            <button
              type="button"
              onClick={run}
              disabled={!usable.length}
              className="text-xs font-semibold px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all disabled:opacity-40"
            >
              Сформировать
            </button>
          )}

          {phase === 'done' && (
            <>
              <button
                type="button"
                onClick={copy}
                className="text-xs font-medium px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-white/60 dark:bg-black/20 hover:bg-amber-100 transition-colors"
              >
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
              <button
                type="button"
                onClick={run}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Обновить
              </button>
            </>
          )}

          <button
            type="button"
            onClick={reset}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
            title="Закрыть панель"
          >
            ✕
          </button>
        </div>
      </div>

      {phase === 'loading' && (
        <div className="mt-2.5 py-2">
          <LoadingState text="Искусственный интеллект анализирует переписку..." size="sm" />
        </div>
      )}

      {phase === 'error' && error && (
        <div className="mt-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {phase === 'done' && summary && (
        <div className="mt-2.5 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-white/80 dark:bg-[#111640]/80 shadow-sm max-h-60 overflow-y-auto">
          <p className="text-xs sm:text-sm text-[#1a2038] dark:text-[#e8ecf4] leading-relaxed whitespace-pre-wrap select-text">
            {summary}
          </p>
          {details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/40 text-xs text-gray-600 dark:text-gray-300 space-y-1">
              {details.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
