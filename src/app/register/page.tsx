'use client';

import RegisterForm from '@/components/auth/RegisterForm';
import SoyuzLogo from '@/components/ui/SoyuzLogo';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-b from-[#eef4ff] to-[#f7f9ff] dark:from-[#080c1d] dark:to-[#0f1535]">
      {/* Кнопка смены темы в правом верхнем углу */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Фоновые космические орбиты */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="absolute w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full border border-blue-400/15 dark:border-blue-500/10 -rotate-12" />
        <div className="absolute w-[800px] h-[400px] sm:w-[1100px] sm:h-[500px] rounded-full border border-sky-400/20 dark:border-blue-400/10 rotate-45" />
        <div className="absolute w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl" />
        {/* Звёздочки */}
        <span className="absolute top-[20%] left-[15%] text-blue-400/30 text-xs">✦</span>
        <span className="absolute bottom-[25%] left-[20%] text-sky-400/40 text-sm">✧</span>
        <span className="absolute top-[30%] right-[18%] text-blue-300/30 text-base">✦</span>
        <span className="absolute bottom-[20%] right-[22%] text-indigo-400/40 text-xs">✧</span>
      </div>

      {/* Карточка регистрации */}
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl bg-white/90 dark:bg-[#111640]/90 border border-[#dde4f0] dark:border-[#1e2955] shadow-xl dark:shadow-2xl dark:shadow-black/40 backdrop-blur-md p-6 sm:p-8 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-6">
          <SoyuzLogo size="lg" className="mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-[#1a2038] dark:text-white">
            Союз
          </h1>
          <p className="text-xs text-[#6070a0] dark:text-[#7b8db5] mt-1">
            Общайтесь без границ
          </p>
        </div>

        <RegisterForm />
      </div>

      {/* Преимущества футер */}
      <div className="relative z-10 mt-8 flex items-center justify-center gap-4 sm:gap-6 text-xs text-[#6070a0] dark:text-[#7b8db5] select-none">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500">⚡</span>
          <span>Быстро</span>
        </div>
        <span className="opacity-30">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500">🛡</span>
          <span>Безопасно</span>
        </div>
        <span className="opacity-30">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-rose-500">💙</span>
          <span>Удобно</span>
        </div>
      </div>
    </div>
  );
}
