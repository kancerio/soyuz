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
  const disabled = !draft.trim() || state.status === 'loading';

  return (
    <div className="px-4 pt-2 border-t dark:border-gray-700">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => onAction('shorten')}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          ✂️ Сократить
        </button>
        <button
          type="button"
          onClick={() => onAction('formal')}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          🎩 Официально
        </button>
        <button
          type="button"
          onClick={() => onAction('friendly')}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          😊 Дружелюбно
        </button>
      </div>

      {state.status === 'loading' && (
        <div className="mb-2">
          <LoadingState size="sm" text="Обработка текста…" />
        </div>
      )}

      {state.status === 'preview' && (
        <div className="mb-2 p-2 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">Предпросмотр:</span>
            {state.mock && (
              <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 border border-amber-400 px-1 rounded">
                тестовый режим
              </span>
            )}
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
            {state.preview}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onApply}
              className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Вставить
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs px-3 py-1 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="mb-2">
          <ErrorState
            size="sm"
            message={`Ошибка AI: ${state.error || 'неизвестно'}`}
            onRetry={onRetry}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}