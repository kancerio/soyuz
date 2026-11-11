'use client';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  onCancel?: () => void;
  retryLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ErrorState({
  message,
  onRetry,
  onCancel,
  retryLabel = 'Повторить',
  cancelLabel = 'Отмена',
  size = 'md',
  className = '',
}: ErrorStateProps) {
  const sizeClasses = size === 'sm' ? 'text-xs py-1.5 px-2.5' : 'text-sm py-2 px-3.5';

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-300 backdrop-blur-sm ${sizeClasses} ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 shrink-0 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="truncate">{message}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/80 text-red-800 dark:text-red-200 transition-colors"
          >
            {retryLabel}
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-red-600 dark:text-red-400 hover:underline transition-colors"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}
