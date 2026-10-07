'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { aiClient, SummaryResponse } from '@/lib/aiClient';

type AssistAction = 'shorten' | 'formal' | 'friendly';

interface AIMessage {
  senderId: number;
  text: string;
  timestamp: Date;
  isDeleted?: boolean;
}

interface AIToolsPanelProps {
  messages: AIMessage[];
  onTranscript: (text: string) => void;
}

interface AIResult {
  title: string;
  body: string;
  details?: string[];
}

export default function AIToolsPanel({ messages, onTranscript }: AIToolsPanelProps) {
  const { language, t } = useLanguage();
  const [assistAction, setAssistAction] = useState<AssistAction>('shorten');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const usableMessages = messages.filter(
    (message) => !message.isDeleted && message.text.trim(),
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
      setError(requestError instanceof Error ? requestError.message : t('ai_error'));
    } finally {
      setBusy(null);
    }
  };

  const handleTranslate = () => {
    if (!latestMessage) return;
    void run('translate', async () => {
      const response = await aiClient.translate({
        text: latestMessage.text,
        source_lang: sourceLanguage,
        target_lang: targetLanguage,
      });
      return {
        title: `${t('translate')} (${targetLanguage})`,
        body: response.translated_text || response.result,
      };
    });
  };

  const handleAssist = () => {
    if (!latestMessage) return;
    void run('assist', async () => {
      const response = await aiClient.assist({
        prompt: latestMessage.text,
        action: assistAction,
      });
      return {
        title: t(`assist_${assistAction}`),
        body: response.result,
      };
    });
  };

  const handleSummary = () => {
    if (!usableMessages.length) return;
    void run('summary', async () => {
      const response: SummaryResponse = await aiClient.summarize({
        language,
        messages: usableMessages.map((message) => ({
          sender_id: String(message.senderId),
          text: message.text,
          timestamp: message.timestamp.toISOString(),
        })),
      });
      return {
        title: t('summary'),
        body: response.summary,
        details: [
          ...(response.decisions.length ? [`${t('ai_decisions')}:`, ...response.decisions] : []),
          ...(response.participants.length
            ? [`${t('ai_participants')}: ${response.participants.join(', ')}`]
            : []),
        ],
      };
    });
  };

  const handleAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run('stt', async () => {
      const response = await aiClient.transcribe(file, language);
      onTranscript(response.transcript);
      return { title: t('ai_voice'), body: response.transcript };
    });
  };

  const handleDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run('document', async () => {
      const response = await aiClient.analyzeDocument(file);
      return {
        title: response.filename || file.name,
        body: response.summary,
        details: response.classification ? [response.classification] : undefined,
      };
    });
  };

  const disabled = busy !== null || !latestMessage;

  return (
    <div className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <button
          type="button"
          onClick={handleTranslate}
          disabled={disabled}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {busy === 'translate' ? t('ai_loading') : t('translate')}
        </button>
        <select
          value={assistAction}
          onChange={(event) => setAssistAction(event.target.value as AssistAction)}
          disabled={disabled}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          aria-label={t('ai_assist_action')}
        >
          <option value="shorten">{t('assist_shorten')}</option>
          <option value="formal">{t('assist_formal')}</option>
          <option value="friendly">{t('assist_friendly')}</option>
        </select>
        <button
          type="button"
          onClick={handleAssist}
          disabled={disabled}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {busy === 'assist' ? t('ai_loading') : t('ai_assist')}
        </button>
        <button
          type="button"
          onClick={handleSummary}
          disabled={busy !== null || !usableMessages.length}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {busy === 'summary' ? t('ai_loading') : t('summary')}
        </button>
        <button
          type="button"
          onClick={() => audioInputRef.current?.click()}
          disabled={busy !== null}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {busy === 'stt' ? t('ai_loading') : t('ai_voice')}
        </button>
        <button
          type="button"
          onClick={() => documentInputRef.current?.click()}
          disabled={busy !== null}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {busy === 'document' ? t('ai_loading') : t('document_analysis')}
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

      {error && (
        <div role="alert" className="mx-2 mb-2 rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          {error}
        </div>
      )}
      {result && (
        <section className="mx-2 mb-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
          <h2 className="font-semibold">{result.title}</h2>
          <p className="mt-1 whitespace-pre-wrap">{result.body}</p>
          {result.details?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.details.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  );
}
