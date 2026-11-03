'use client';

interface LoadingStateProps {
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function LoadingState({
  text = 'Загрузка…',
  size = 'md',
  className = '',
}: LoadingStateProps) {
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${sizeClasses} ${className}`}>
      <span className={`inline-block ${dotSize} rounded-full bg-blue-500 animate-pulse`} />
      <span className="italic">{text}</span>
    </div>
  );
}