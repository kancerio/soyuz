'use client';

import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';

export type RewriteAction = 'shorten' | 'formal' | 'friendly';

export interface RewriteState {
  status: 'idle' | 'loading' | 'preview' | 'error';
  action?: RewriteAction;
  originalDraft?: string;
  preview?: string;
  mock?: boolean;
  error?: string;
}

interface RewritePanelProps {
  draft: string;
  state: RewriteState;
  onAction: (action: RewriteAction) => void;
  onApply: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export default function RewritePanel({
  draft,
  state,
  onAction,
  onApply,
  onCancel,
  onRetry,
}: RewritePanelProps) {
  const hasText = !!draft.trim();
  const isLoading = state.status === 'loading';

  return (
    <div className="px-4 py-2 border-t border-[#dde4f0] dark:border-[#1e2955] bg-white/50 dark:bg-[#0d1230]/50 backdrop-blur-sm transition-all select-none">
      {/* Кнопки-чипы AI рерайта */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 mr-1 shrink-0">
          <span>✨</span>
          <span>ИИ-помощник:</span>
        </div>

        <button
          type="button"
          onClick={() => onAction('shorten')}
          disabled={!hasText || isLoading}
          className="text-xs px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
        >
          ✂️ Сократить
        </button>

        <button
          type="button"
          onClick={() => onAction('formal')}
          disabled={!hasText || isLoading}
          className="text-xs px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
        >
          🎩 Официально
        </button>

        <button
          type="button"
          onClick={() => onAction('friendly')}
          disabled={!hasText || isLoading}
          className="text-xs px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-[#1a2248] text-[#1a2038] dark:text-[#c7d4f0] hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
        >
          😊 Дружелюбно
        </button>
      </div>

      {/* Состояние загрузки */}
      {state.status === 'loading' && (
        <div className="mt-2.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <LoadingState size="sm" text="ИИ генерирует улучшенный вариант…" />
        </div>
      )}

      {/* Карточка предпросмотра */}
      {state.status === 'preview' && (
        <div className="mt-2.5 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-tr from-blue-50/90 to-indigo-50/70 dark:from-[#111845] dark:to-[#171f54] shadow-md animate-slide-up">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <span>✨</span> Результат обработки
            </span>
            {state.mock && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                Тестовый ИИ
              </span>
            )}
          </div>

          <div className="text-xs sm:text-sm text-[#1a2038] dark:text-gray-100 whitespace-pre-wrap leading-relaxed select-text p-2 rounded-xl bg-white/70 dark:bg-black/20 border border-blue-100 dark:border-blue-900/50">
            {state.preview}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onApply}
              className="text-xs font-semibold px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Состояние ошибки */}
      {state.status === 'error' && (
        <div className="mt-2.5">
          <ErrorState
            size="sm"
            message={`Ошибка ИИ: ${state.error || 'не удалось обработать текст'}`}
            onRetry={onRetry}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}
