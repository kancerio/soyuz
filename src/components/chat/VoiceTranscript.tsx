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

  if (status === 'pending' || status === 'skipped') {
    return null;
  }

  if (status === 'processing') {
    return (
      <div
        className={`flex items-center gap-1.5 text-[11px] mt-1.5 px-2 py-1 rounded-lg ${
          isOwn ? 'bg-white/10 text-white/80' : 'bg-gray-100 dark:bg-[#151b45] text-[#6070a0] dark:text-[#7b8db5]'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span>Распознавание речи…</span>
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
        Не удалось распознать речь
      </div>
    );
  }

  if (!transcript) return null;

  return (
    <div
      className={`mt-2 rounded-xl text-xs transition-all overflow-hidden ${
        isOwn
          ? 'bg-white/10 border border-white/15'
          : 'bg-white dark:bg-[#151b45] border border-[#dde4f0] dark:border-[#1e2955] shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 font-medium text-left ${
          isOwn
            ? 'text-white/90 hover:text-white'
            : 'text-[#1a2038] dark:text-[#e8ecf4] hover:text-blue-600 dark:hover:text-blue-400'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[11px]">Транскрипт</span>
        </div>
        <span className="text-[10px] opacity-70">
          {expanded ? 'Скрыть ▲' : 'Показать ▼'}
        </span>
      </button>

      {expanded && (
        <div
          className={`px-2.5 pb-2 pt-1 border-t ${
            isOwn ? 'border-white/10 text-white/95' : 'border-[#dde4f0] dark:border-[#1e2955] text-[#1a2038] dark:text-[#e8ecf4]'
          } whitespace-pre-wrap break-words leading-relaxed select-text`}
        >
          {transcript}
        </div>
      )}
    </div>
  );
}
