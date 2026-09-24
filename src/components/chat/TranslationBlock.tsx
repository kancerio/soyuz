'use client';

import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { Message } from '@/types/chat';

interface TranslationBlockProps {
  message: Message;
  targetLanguage: string;
  isOwn: boolean;
  onTranslate: (msg: Message) => void;
}

export default function TranslationBlock({
  message,
  targetLanguage,
  isOwn,
  onTranslate,
}: TranslationBlockProps) {
  if (message.isDeleted) return null;

  const status = message.translationStatus ?? 'idle';

  // Кнопка перевода
  if (status === 'idle') {
    return (
      <button
        onClick={() => onTranslate(message)}
        className={`text-xs mt-1 hover:underline ${
          isOwn ? 'text-blue-100' : 'text-blue-500'
        }`}
        title={`Перевести на ${targetLanguage.toUpperCase()}`}
      >
        Перевести на {targetLanguage.toUpperCase()}
      </button>
    );
  }

  // Загрузка
  if (status === 'translating') {
    return (
      <div className="mt-1">
        <LoadingState
          size="sm"
          text={`Переводится на ${(message.targetLang || targetLanguage).toUpperCase()}…`}
        />
      </div>
    );
  }

  // Готово
  if (status === 'done') {
    return (
      <div
        className={`text-xs mt-1 border-l-2 pl-2 ${
          isOwn
            ? 'border-blue-300 text-blue-50'
            : 'border-blue-400 text-gray-600 dark:text-gray-300'
        }`}
      >
        <span className="text-[10px] uppercase opacity-60 mr-1">
          {(message.targetLang || targetLanguage).toUpperCase()}:
        </span>
        {message.translatedText}
        <span className="ml-2 text-[10px] uppercase opacity-60">
          (тестовый результат)
        </span>
      </div>
    );
  }

  // Ошибка
  if (status === 'error') {
    return (
      <div className="mt-1">
        <ErrorState
          size="sm"
          message={message.translationError || 'Ошибка перевода'}
          onRetry={() => onTranslate(message)}
        />
      </div>
    );
  }

  return null;
}