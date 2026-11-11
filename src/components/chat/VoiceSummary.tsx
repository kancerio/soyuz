'use client';

import { useState } from 'react';
import type { SummaryStatus } from '@/types/chat';

interface VoiceSummaryProps {
  summary?: string | null;
  status?: SummaryStatus;
  /** Светлый текст на синем фоне (свои сообщения) */
  isOwn?: boolean;
}

export default function VoiceSummary({
  summary,
  status = 'pending',
  isOwn = false,
}: VoiceSummaryProps) {
  const [expanded, setExpanded] = useState(true);

  if (status === 'not_needed') {
    return null;
  }

  if (status === 'processing') {
    return (
      <div
        className={`flex items-center gap-1.5 text-[11px] mt-1.5 px-2 py-1 rounded-lg ${
          isOwn ? 'bg-amber-400/20 text-amber-100' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Генерация краткого содержания (AI)…</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={`text-[11px] mt-1.5 px-2 py-1 rounded-lg ${
          isOwn ? 'bg-red-500/20 text-red-200' : 'bg-red-50 dark:bg-red-950/40 text-red-500'
        }`}
      >
        Не удалось составить сводку
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div
      className={`mt-2 rounded-xl text-xs transition-all overflow-hidden ${
        isOwn
          ? 'bg-amber-500/20 border border-amber-300/30 text-white'
          : 'bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[#1a2038] dark:text-[#fef3c7] shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 font-medium text-left"
      >
        <div className="flex items-center gap-1.5 font-semibold text-amber-500 dark:text-amber-400">
          <span>⚡</span>
          <span className="text-[11px]">Кратко (AI Summary)</span>
        </div>
        <span className="text-[10px] opacity-70">
          {expanded ? 'Скрыть ▲' : 'Показать ▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 pt-0.5 whitespace-pre-wrap break-words leading-relaxed select-text font-normal text-[11px]">
          {summary}
        </div>
      )}
    </div>
  );
}
