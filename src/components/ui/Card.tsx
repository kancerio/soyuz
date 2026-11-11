'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  const variantStyles = {
    default:
      'bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] shadow-lg shadow-black/[0.03] dark:shadow-black/20',
    elevated:
      'bg-white/95 dark:bg-[#151b45]/95 border border-[#dde4f0]/80 dark:border-[#1e2955]/80 shadow-xl shadow-black/[0.05] dark:shadow-black/40 backdrop-blur-md',
    bordered:
      'bg-transparent border border-[#dde4f0] dark:border-[#1e2955]',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-4 sm:p-8',
  };

  return (
    <div
      className={`w-full rounded-3xl transition-colors duration-200 ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
