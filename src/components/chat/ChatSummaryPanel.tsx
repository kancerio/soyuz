'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Message } from '@/types/chat';
import { useLanguage } from '@/context/LanguageContext';

type Phase = 'idle' | 'loading' | 'done' | 'error';

interface ChatSummaryPanelProps {
  messages: Message[];
  /** Язык сводки, по умолчанию из профиля / UI */
  language?: string;
}

export default function ChatSummaryPanel({
  messages,
  language = 'ru',
}: ChatSummaryPanelProps) {
  const { t } = useLanguage();
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
      text:
        m.type === 'voice' && m.transcript
          ? m.transcript
          : m.content,
      timestamp: m.timestamp.toISOString(),
    }));

  const run = async () => {
    if (!usable.length) {
      setPhase('error');
      setError('Нет сообщений для сводки');
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
        throw new Error('Не удалось получить сводку');
      }
      setSummary(res.summary);
      const extra: string[] = [];
      if (res.decisions?.length) {
        extra.push('Решения:', ...res.decisions.map((d) => `• ${d}`));
      }
      if (res.participants?.length) {
        extra.push(`Участники: ${res.participants.join(', ')}`);
      }
      setDetails(extra);
      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Ошибка сводки');
    }
  };

  const copy = async () => {
    const text = [summary, ...details].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать');
    }
  };

  const reset = () => {
    setPhase('idle');
    setSummary('');
    setDetails([]);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="border-b dark:border-gray-700 px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium shrink-0">Сводка чата</span>

        {phase === 'idle' && (
          <button
            type="button"
            onClick={run}
            disabled={!usable.length}
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Сформировать
          </button>
        )}

        {phase === 'loading' && (
          <span className="text-sm text-amber-800 dark:text-amber-200 animate-pulse">
            Готовим сводку…
          </span>
        )}

        {phase === 'done' && (
          <>
            <button
              type="button"
              onClick={copy}
              className="rounded border border-amber-600 px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              type="button"
              onClick={run}
              className="rounded px-2 py-1 text-sm text-amber-800 dark:text-amber-200 hover:underline"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded px-2 py-1 text-sm text-gray-500 hover:underline"
            >
              Скрыть
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <button
              type="button"
              onClick={run}
              className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700"
            >
              Повторить
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-gray-500 hover:underline"
            >
              Скрыть
            </button>
          </>
        )}

        {!usable.length && phase === 'idle' && (
          <span className="text-xs text-gray-500">Нужны текстовые или расшифрованные сообщения</span>
        )}
      </div>

      {phase === 'error' && error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {phase === 'done' && summary && (
        <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-3 text-sm">
          <p className="whitespace-pre-wrap">{summary}</p>
          {details.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
              {details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}