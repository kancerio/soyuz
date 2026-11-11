'use client';

import React from 'react';

export type BadgeVariant = 'accent' | 'success' | 'danger' | 'warning' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
}

export function Badge({
  children,
  variant = 'accent',
  size = 'md',
  pill = true,
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles = {
    accent:
      'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    success:
      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    danger:
      'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    warning:
      'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    neutral:
      'bg-gray-100 dark:bg-[#1a2250] text-[#6070a0] dark:text-[#7b8db5] border border-[#dde4f0] dark:border-[#1e2955]',
  };

  const sizeStyles = {
    sm: 'text-[10px] font-semibold px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
  };

  const roundedStyle = pill ? 'rounded-full' : 'rounded-md';

  return (
    <span
      className={`inline-flex items-center justify-center tracking-tight select-none ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyle} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
