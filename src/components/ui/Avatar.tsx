'use client';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  className?: string;
}

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-600',
  'from-rose-500 to-red-600',
  'from-violet-500 to-purple-700',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || '??').toUpperCase();
}

export default function Avatar({
  name,
  src,
  size = 'md',
  isOnline,
  className = '',
}: AvatarProps) {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
    '2xl': 'w-24 h-24 text-3xl font-bold',
  };

  const badgeSizeMap = {
    xs: 'w-2 h-2 bottom-0 right-0 border',
    sm: 'w-2.5 h-2.5 bottom-0 right-0 border-2',
    md: 'w-3 h-3 bottom-0 right-0 border-2',
    lg: 'w-3.5 h-3.5 bottom-0 right-0 border-2',
    xl: 'w-4 h-4 bottom-0.5 right-0.5 border-2',
    '2xl': 'w-5 h-5 bottom-1 right-1 border-4',
  };

  const gradient = getGradient(name || 'Chat');
  const initials = getInitials(name || 'Союз');

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-medium shadow-sm`}
        >
          {initials}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={`absolute rounded-full ${badgeSizeMap[size]} ${
            isOnline ? 'bg-emerald-500' : 'bg-gray-400'
          } border-white dark:border-[#111640]`}
          title={isOnline ? 'В сети' : 'Не в сети'}
        />
      )}
    </div>
  );
}
