'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { aiClient } from '@/lib/aiClient';
import { Message } from '@/types/chat';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';

type AssistAction = 'shorten' | 'formal' | 'friendly';

interface AIToolsPanelProps {
  messages: Message[];
  onTranscript: (text: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface AIResult {
  title: string;
  body: string;
  details?: string[];
}

export default function AIToolsPanel({
  messages,
  onTranscript,
  isOpen = false,
  onClose,
}: AIToolsPanelProps) {
  const { language, t } = useLanguage();
  const [assistAction, setAssistAction] = useState<AssistAction>('shorten');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const usableMessages = messages.filter(
    (message) => !message.isDeleted && message.content.trim(),
  );
  const latestMessage = usableMessages[usableMessages.length - 1];
  const sourceLanguage = language;
  const targetLanguage = language === 'ru' ? 'en' : 'ru';

  const run = async (name: string, operation: () => Promise<AIResult>) => {
    setBusy(name);
    setError(null);
    try {
      setResult(await operation());
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : 'Ошибка ИИ-сервиса');
    } finally {
      setBusy(null);
    }
  };

  const handleTranslate = () => {
    if (!latestMessage) return;
    void run('translate', async () => {
      const response = await apiClient.translateText(
        latestMessage.content,
        sourceLanguage,
        targetLanguage,
      );
      return {
        title: `Перевод последнего сообщения (${targetLanguage.toUpperCase()})`,
        body: response.translatedText,
      };
    });
  };

  const handleAssist = () => {
    if (!latestMessage) return;
    void run('assist', async () => {
      const response = await apiClient.assistText(latestMessage.content, assistAction);
      return {
        title: `ИИ-обработка (${assistAction})`,
        body: response.resultText,
      };
    });
  };

  const handleAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    void run('stt', async () => {
      const response = await apiClient.transcribeAudio(file, language);
      onTranscript(response.transcript);
      return {
        title: 'Распознанный голос (вставлен в черновик)',
        body: response.transcript,
      };
    });
  };

  const handleDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    void run('document', async () => {
      const response = await aiClient.analyzeDocument(file);
      return {
        title: `Анализ документа: ${file.name}`,
        body: response.summary,
        details: response.fields
          ? Object.entries(response.fields).map(([k, v]) => `${k}: ${v}`)
          : undefined,
      };
    });
  };

  const disabled = busy !== null || !latestMessage;

  return (
    <div className="border-b border-[#dde4f0] dark:border-[#1e2955] px-4 py-3 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-950/30 backdrop-blur-sm animate-slide-up select-none">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            ИИ-панель инструментов
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
            title="Закрыть панель"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleTranslate}
          disabled={disabled}
          className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] border border-[#dde4f0] dark:border-[#1e2955] hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40"
        >
          {busy === 'translate' ? 'Перевод…' : '🌐 Перевести последнее'}
        </button>

        <div className="flex items-center gap-1 bg-white dark:bg-[#1a2248] border border-[#dde4f0] dark:border-[#1e2955] rounded-xl px-1 py-0.5">
          <select
            value={assistAction}
            onChange={(e) => setAssistAction(e.target.value as AssistAction)}
            disabled={disabled}
            className="bg-transparent text-xs text-[#1a2038] dark:text-white px-2 py-1 outline-none cursor-pointer"
          >
            <option value="shorten">Сократить</option>
            <option value="formal">Официально</option>
            <option value="friendly">Дружелюбно</option>
          </select>
          <button
            type="button"
            onClick={handleAssist}
            disabled={disabled}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-all"
          >
            {busy === 'assist' ? 'Обработка…' : '✨ Обработать'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => audioInputRef.current?.click()}
          disabled={busy !== null}
          className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] border border-[#dde4f0] dark:border-[#1e2955] hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40"
        >
          {busy === 'stt' ? 'Распознавание…' : '🎙 Расшифровать аудио'}
        </button>

        <button
          type="button"
          onClick={() => documentInputRef.current?.click()}
          disabled={busy !== null}
          className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] border border-[#dde4f0] dark:border-[#1e2955] hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40"
        >
          {busy === 'document' ? 'Анализ документа…' : '📄 Анализ документа'}
        </button>

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudio}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleDocument}
        />
      </div>

      {busy && (
        <div className="mt-3">
          <LoadingState text="ИИ обрабатывает запрос..." size="sm" />
        </div>
      )}

      {error && (
        <div className="mt-2.5">
          <ErrorState message={error} size="sm" />
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-white/90 dark:bg-[#111640]/90 shadow-sm max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {result.title}
            </h4>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Закрыть
            </button>
          </div>
          <p className="text-xs sm:text-sm text-[#1a2038] dark:text-[#e8ecf4] leading-relaxed whitespace-pre-wrap select-text">
            {result.body}
          </p>
          {result.details && result.details.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-gray-600 dark:text-gray-300 space-y-1">
              {result.details.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
