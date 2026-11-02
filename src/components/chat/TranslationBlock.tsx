'use client';

import { useState } from 'react';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { Message } from '@/types/chat';

interface TranslationBlockProps {
  message: Message;
  isOwn: boolean;
}

export default function TranslationBlock({ message, isOwn }: TranslationBlockProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (message.isDeleted) return null;

  const status = message.translateStatus;

  // skipped — языки совпадают, перевод не нужен
  if (!status || status === 'skipped') return null;

  // В процессе перевода
  if (status === 'pending') {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-white/20 dark:border-white/10">
        <LoadingState size="sm" text="Перевод сообщения…" />
      </div>
    );
  }

  // Перевод готов
  if (status === 'completed' && message.translatedText) {
    const targetLang = (message.targetLang || 'ru').toUpperCase();

    return (
      <div
        className={`mt-2 pt-1.5 border-t text-xs transition-colors ${
          isOwn
            ? 'border-white/20 text-blue-50'
            : 'border-[#dde4f0] dark:border-[#1e2955] text-[#1a2038] dark:text-[#c7d4f0]'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${
                isOwn ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
              }`}
            >
              {showOriginal ? 'Оригинал' : `Перевод (${targetLang})`}
            </span>
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className={`text-[10px] underline hover:no-underline transition-opacity ${
              isOwn ? 'text-white/80 hover:text-white' : 'text-blue-500 hover:text-blue-600'
            }`}
          >
            {showOriginal ? 'Показать перевод' : 'Показать оригинал'}
          </button>
        </div>

        <p className="leading-relaxed whitespace-pre-wrap break-words">
          {showOriginal ? message.originalText || message.content : message.translatedText}
        </p>
      </div>
    );
  }

  // Ошибка перевода
  if (status === 'failed') {
    return (
      <div className="mt-1.5">
        <ErrorState size="sm" message="Перевод недоступен" />
      </div>
    );
  }

  return null;
}
