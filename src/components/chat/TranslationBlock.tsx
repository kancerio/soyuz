'use client';

import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { Message } from '@/types/chat';

interface TranslationBlockProps {
  message: Message;
  isOwn: boolean;
}

export default function TranslationBlock({ message, isOwn }: TranslationBlockProps) {
  if (message.isDeleted) return null;

  const status = message.translateStatus;

  // skipped — языки совпадают, перевод не нужен
  if (!status || status === 'skipped') return null;

  // В процессе
  if (status === 'pending') {
    return (
      <div className="mt-1">
        <LoadingState size="sm" text="Переводится…" />
      </div>
    );
  }

  // Готово
  if (status === 'completed' && message.translatedText) {
    return (
      <div
        className={`text-xs mt-1 border-l-2 pl-2 ${
          isOwn
            ? 'border-blue-300 text-blue-50'
            : 'border-blue-400 text-gray-600 dark:text-gray-300'
        }`}
      >
        <span className="text-[10px] uppercase opacity-60 mr-1">
          {(message.targetLang || '??').toUpperCase()}:
        </span>
        {message.translatedText}
      </div>
    );
  }

  // Ошибка
  if (status === 'failed') {
    return (
      <div className="mt-1">
        <ErrorState size="sm" message="Перевод недоступен" />
      </div>
    );
  }

  return null;
}