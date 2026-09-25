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
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 ${sizeClasses} ${className}`}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="underline hover:no-underline font-medium"
        >
          {retryLabel}
        </button>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="underline hover:no-underline"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}