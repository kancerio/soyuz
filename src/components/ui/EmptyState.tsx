'use client';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title = 'Выберите чат',
  description = 'Чтобы начать общение, выберите чат из списка слева',
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full p-8 text-center select-none ${className}`}
    >
      <div className="relative mb-6">
        {icon ? (
          icon
        ) : (
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Орбитальное сияние вокруг бабблов */}
            <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-600/20 rounded-full blur-2xl" />
            <div className="absolute w-32 h-16 rounded-full border border-blue-400/20 dark:border-blue-500/20 -rotate-12 transform" />
            <div className="absolute w-28 h-28 rounded-full border border-blue-400/10 dark:border-blue-400/15" />

            {/* Звёздочки / искры */}
            <span className="absolute top-2 right-4 text-blue-400/70 text-xs animate-pulse">✦</span>
            <span className="absolute bottom-4 left-3 text-blue-300/60 text-sm animate-pulse delay-150">✧</span>
            <span className="absolute top-6 left-6 text-blue-400/40 text-[10px]">✦</span>

            {/* Иконка двух диалоговых пузырей */}
            <div className="relative z-10 flex items-center justify-center">
              {/* Задний пузырь */}
              <div className="absolute -top-3 -left-3 w-16 h-12 bg-blue-400/40 dark:bg-blue-600/40 rounded-2xl rounded-bl-sm flex items-center justify-center gap-1 shadow-lg backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
              </div>
              {/* Передний пузырь */}
              <div className="relative w-20 h-14 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-2xl rounded-br-sm flex items-center justify-center gap-1.5 shadow-xl shadow-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <h3 className="text-xl font-semibold text-[#1a2038] dark:text-[#e8ecf4] mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-[#6070a0] dark:text-[#7b8db5] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
