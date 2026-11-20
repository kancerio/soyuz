'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  ConstructionTerm,
  ConstructionTermsStatus,
  Message,
} from '@/types/chat';

interface MessageTextProps {
  message: Message;
  isOwn: boolean;
  /** Язык интерфейса текущего пользователя (настройки) */
  myLanguage: string;
}

interface Segment {
  text: string;
  termIndex: number | null;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function findTermRange(text: string, term: string): { start: number; end: number } | null {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return null;
  return { start: idx, end: idx + term.length };
}

/**
 * Разбивает текст на сегменты по UTF-16 диапазонам [start, end) из ответа AI.
 * Диапазоны — это индексы JS-строки, поэтому slice работает напрямую,
 * но мы всё равно проверяем границы, совпадение подстроки, пересечения
 * и не разрываем суррогатные пары (emoji перед ссылкой).
 */
export function buildTermSegments(text: string, terms: ConstructionTerm[]): Segment[] {
  const ranges: { start: number; end: number; index: number }[] = [];

  terms.forEach((term, index) => {
    let { start, end } = term;
    const inBounds =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end <= text.length &&
      start < end;

    // Диапазон невалиден или подстрока не совпала с термином — ищем термин заново
    if (!inBounds || text.slice(start, end).toLowerCase() !== term.term.toLowerCase()) {
      const found = findTermRange(text, term.term);
      if (!found) return;
      start = found.start;
      end = found.end;
    }

    // Не разрываем суррогатные пары на границах диапазона
    if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start -= 1;
    if (end < text.length && isLowSurrogate(text.charCodeAt(end))) end += 1;

    ranges.push({ start, end, index });
  });

  ranges.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue; // пересечение с уже добавленным — пропускаем
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), termIndex: null });
    }
    segments.push({ text: text.slice(range.start, range.end), termIndex: range.index });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), termIndex: null });
  }
  return segments;
}

export default function MessageText({ message, isOwn, myLanguage }: MessageTextProps) {
  const original = message.originalText || message.content;
  const sourceLang = (message.sourceLang || '').toLowerCase();
  // Одинаковый язык настроек и сообщения — перевод не используем
  const sameLanguage = !sourceLang || sourceLang === myLanguage;

  const translation = !sameLanguage ? message.translations?.[myLanguage] : undefined;
  const hasTranslation = translation?.status === 'completed' && Boolean(translation?.text);
  const isTranslating = !sameLanguage && message.translateStatus === 'pending';
  const translationFailed =
    !sameLanguage &&
    !hasTranslation &&
    (message.translateStatus === 'failed' || translation?.status === 'failed');

  const [showOriginal, setShowOriginal] = useState(false);
  const [termsStatus, setTermsStatus] = useState<ConstructionTermsStatus>('idle');
  const [terms, setTerms] = useState<ConstructionTerm[]>([]);
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Сброс локального состояния при смене сообщения или редактировании текста
  useEffect(() => {
    setShowOriginal(false);
    setTermsStatus('idle');
    setTerms([]);
    setActiveTerm(null);
  }, [message.id, message.content]);

  // Закрытие карточки термина по клику вне и по Escape
  useEffect(() => {
    if (activeTerm === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveTerm(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveTerm(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeTerm]);

  const loadTerms = async () => {
    setTermsStatus('loading');
    setActiveTerm(null);
    try {
      const res = await apiClient.getConstructionTerms(message.id);
      const found = Array.isArray(res.terms) ? res.terms : [];
      setTerms(found);
      setTermsStatus(found.length > 0 ? 'loaded' : 'empty');
      // Подсветка привязана к оригинальному тексту сообщения
      if (found.length > 0) setShowOriginal(true);
    } catch {
      setTermsStatus('error');
    }
  };

  const displayOriginal = showOriginal || !hasTranslation;
  const segments =
    termsStatus === 'loaded' && displayOriginal
      ? buildTermSegments(original, terms)
      : null;

  const activeTermData = activeTerm !== null ? terms[activeTerm] : null;

  const mutedClass = isOwn
    ? 'text-blue-100'
    : 'text-[#6070a0] dark:text-[#7b8db5]';
  const linkClass = isOwn
    ? 'text-white/90 hover:text-white'
    : 'text-blue-500 hover:text-blue-600 dark:text-blue-400';

  return (
    <div ref={containerRef} className="relative">
      {/* Основной текст: для получателя — сразу перевод, оригинал по кнопке.
          dir="auto" поддерживает RTL-языки (ar, he, fa) без хардкода списка */}
      <p
        dir="auto"
        className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text"
      >
        {segments
          ? segments.map((segment, i) =>
              segment.termIndex === null ? (
                <span key={i}>{segment.text}</span>
              ) : (
                <button
                  key={i}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activeTerm === segment.termIndex}
                  onClick={() =>
                    setActiveTerm(
                      activeTerm === segment.termIndex ? null : segment.termIndex,
                    )
                  }
                  className={`underline decoration-dotted underline-offset-2 rounded-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                    isOwn
                      ? 'decoration-white/70 hover:bg-white/15'
                      : 'decoration-blue-500/70 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10'
                  }`}
                >
                  {segment.text}
                </button>
              ),
            )
          : displayOriginal
            ? original
            : translation?.text}
      </p>

      {/* Строка состояния перевода и запуска анализа терминов */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t text-[11px] select-none ${
          isOwn
            ? 'border-white/20'
            : 'border-[#dde4f0] dark:border-[#1e2955]'
        }`}
      >
        {!sameLanguage && (
          <>
            {isTranslating && (
              <span className={`${mutedClass} animate-pulse`}>Переводится…</span>
            )}
            {translationFailed && (
              <span className={isOwn ? 'text-red-200' : 'text-red-500'}>
                Перевод недоступен
              </span>
            )}
            {hasTranslation && (
              <button
                type="button"
                onClick={() => setShowOriginal((prev) => !prev)}
                className={`underline hover:no-underline ${linkClass}`}
              >
                {showOriginal
                  ? `Показать перевод (${myLanguage.toUpperCase()})`
                  : 'Показать оригинал'}
              </button>
            )}
          </>
        )}

        {termsStatus === 'idle' && (
          <button
            type="button"
            onClick={loadTerms}
            className={`flex items-center gap-1 underline hover:no-underline ${linkClass}`}
            title="Найти строительные термины в сообщении"
          >
            <span aria-hidden>🏗</span> Термины
          </button>
        )}
        {termsStatus === 'loading' && (
          <span className={`${mutedClass} animate-pulse`}>Поиск терминов…</span>
        )}
        {termsStatus === 'empty' && (
          <span className={mutedClass}>Строительные термины не найдены</span>
        )}
        {termsStatus === 'loaded' && (
          <button
            type="button"
            onClick={loadTerms}
            className={`underline hover:no-underline ${linkClass}`}
            title="Повторить анализ"
          >
            Термины: {terms.length} · обновить
          </button>
        )}
        {termsStatus === 'error' && (
          <span className="flex items-center gap-2">
            <span className={isOwn ? 'text-red-200' : 'text-red-500'}>
              Анализ не удался
            </span>
            <button
              type="button"
              onClick={loadTerms}
              className={`underline hover:no-underline ${linkClass}`}
            >
              Повторить
            </button>
          </span>
        )}
      </div>

      {/* Карточка термина: объяснение на языке интерфейса + ссылка на источник */}
      {activeTermData && (
        <div
          role="dialog"
          aria-label={`Термин: ${activeTermData.term}`}
          dir="auto"
          className="absolute z-30 start-0 mt-2 w-64 max-w-[80vw] rounded-2xl border border-[#dde4f0] dark:border-[#1e2955] bg-white dark:bg-[#151b45] shadow-xl p-3.5 text-start"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-[#1a2038] dark:text-white break-words">
              {activeTermData.term}
            </p>
            <button
              type="button"
              onClick={() => setActiveTerm(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white shrink-0"
              aria-label="Закрыть карточку"
            >
              ✕
            </button>
          </div>

          <p
            dir="auto"
            className="mt-1.5 text-xs leading-relaxed text-[#405080] dark:text-[#c7d4f0] break-words"
          >
            {activeTermData.definition}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1a2248] text-gray-500 dark:text-[#9babc6] font-semibold uppercase">
              {activeTermData.country_code}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1a2248] text-gray-500 dark:text-[#9babc6]">
              Источник: Wikipedia
            </span>
          </div>

          <a
            href={activeTermData.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Подробнее
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
