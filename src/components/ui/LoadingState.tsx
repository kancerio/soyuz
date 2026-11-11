'use client';

interface LoadingStateProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

export default function LoadingState({
  text = 'Загрузка…',
  size = 'md',
  className = '',
  fullScreen = false,
}: LoadingStateProps) {
  const spinnerSize =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  const textSize =
    size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base font-medium' : 'text-sm';

  const content = (
    <div className={`flex items-center gap-3 text-blue-500 dark:text-blue-400 ${className}`}>
      <svg
        className={`animate-spin ${spinnerSize} shrink-0`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <span className={`${textSize} text-[#6070a0] dark:text-[#9babc6]`}>{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] h-full w-full p-6">
        {content}
      </div>
    );
  }

  return content;
}
