'use client';

import { useState } from 'react';
import type { TranscriptStatus } from '@/types/chat';

interface VoiceTranscriptProps {
  transcript?: string | null;
  status?: TranscriptStatus;
  /** Светлый текст на синем фоне (свои сообщения) */
  isOwn?: boolean;
}

export default function VoiceTranscript({
  transcript,
  status = 'pending',
  isOwn = false,
}: VoiceTranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  const muted = isOwn ? 'opacity-80' : 'text-gray-500 dark:text-gray-400';
  const link = isOwn ? 'underline opacity-90 hover:opacity-100' : 'text-blue-600 dark:text-blue-400 hover:underline';

  if (status === 'pending' || status === 'skipped') {
    return null;
  }

  if (status === 'processing') {
    return (
      <div className={`text-xs mt-1 ${muted}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Распознаётся…
        </span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={`text-xs mt-1 ${isOwn ? 'text-red-200' : 'text-red-500'}`}>
        Не удалось распознать речь
      </div>
    );
  }

  // completed
  if (!transcript) return null;

  const isLong = transcript.length > 120;

  return (
    <div className={`text-xs mt-1 ${muted}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`${link} text-left`}
      >
        {expanded ? 'Скрыть текст' : 'Показать текст'}
      </button>

      {expanded && (
        <p
          className={`mt-1 whitespace-pre-wrap break-words ${
            isOwn ? 'text-white/90' : 'text-gray-700 dark:text-gray-200'
          } ${!isLong ? '' : ''}`}
        >
          {transcript}
        </p>
      )}
    </div>
  );
}