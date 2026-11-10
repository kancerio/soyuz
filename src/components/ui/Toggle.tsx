'use client';

import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
  className = '',
}: ToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  const trackSizes = {
    sm: 'w-9 h-5',
    md: 'w-11 h-6',
  };

  const thumbSizes = {
    sm: 'w-3.5 h-3.5 translate-x-0.5',
    md: 'w-4 h-4 translate-x-1',
  };

  const thumbCheckedTranslate = {
    sm: 'translate-x-[18px]',
    md: 'translate-x-[22px]',
  };

  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${trackSizes[size]}
        ${
          checked
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-gray-200 dark:bg-[#1e2955]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out
          ${thumbSizes[size]}
          ${checked ? thumbCheckedTranslate[size] : ''}
        `}
      />
    </button>
  );

  if (!label && !description) {
    return button;
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 select-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="flex flex-col min-w-0 pr-2">
        {label && (
          <span className="text-sm font-medium text-[#1a2038] dark:text-[#e8ecf4]">
            {label}
          </span>
        )}
        {description && (
          <span className="text-xs text-[#6070a0] dark:text-[#7b8db5] leading-relaxed">
            {description}
          </span>
        )}
      </div>
      {button}
    </div>
  );
}

export default Toggle;
