'use client';

import { useState } from 'react';
import type { SummaryStatus } from '@/types/chat';

interface VoiceSummaryProps {
  summary?: string | null;
  status?: SummaryStatus;
  isOwn?: boolean;
}

export default function VoiceSummary({
  summary,
  status = 'not_needed',
  isOwn = false,
}: VoiceSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  // короткое сообщение — блок не нужен
  if (status === 'not_needed' || status === 'pending') {
    return null;
  }

  const muted = isOwn ? 'opacity-80' : 'text-gray-500 dark:text-gray-400';
  const link = isOwn
    ? 'underline opacity-90 hover:opacity-100'
    : 'text-blue-600 dark:text-blue-400 hover:underline';

  if (status === 'processing') {
    return (
      <div className={`text-xs mt-1 ${muted}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Готовится краткое…
        </span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={`text-xs mt-1 ${isOwn ? 'text-red-200' : 'text-red-500'}`}>
        Не удалось сделать краткое
      </div>
    );
  }

  // completed
  if (!summary) return null;

  return (
    <div className={`text-xs mt-1 ${muted}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`${link} text-left font-medium`}
      >
        {expanded ? 'Скрыть кратко' : 'Кратко'}
      </button>

      {expanded && (
        <p
          className={`mt-1 whitespace-pre-wrap break-words ${
            isOwn ? 'text-white/90' : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {summary}
        </p>
      )}
    </div>
  );
}