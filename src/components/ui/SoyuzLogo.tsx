'use client';

interface SoyuzLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function SoyuzLogo({
  size = 'md',
  showText = false,
  className = '',
}: SoyuzLogoProps) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textMap = {
    sm: 'text-base font-semibold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold tracking-tight',
    xl: 'text-3xl font-extrabold tracking-tight',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div
        className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0`}
      >
        {/* Орбита с точками */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1"
        >
          {/* Наклонный эллипс орбиты */}
          <ellipse
            cx="24"
            cy="24"
            rx="20"
            ry="9"
            transform="rotate(-25 24 24)"
            stroke="white"
            strokeWidth="2.5"
            strokeDasharray="none"
          />
          {/* Спутники-точки на орбите */}
          <circle cx="9" cy="29" r="2.5" fill="white" />
          <circle cx="39" cy="19" r="2.5" fill="white" />
          <circle cx="27" cy="15" r="2" fill="white" opacity="0.9" />
        </svg>
      </div>

      {showText && (
        <span className={`text-[#1a2038] dark:text-white ${textMap[size]}`}>
          Союз
        </span>
      )}
    </div>
  );
}
