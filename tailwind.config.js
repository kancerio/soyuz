/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Тёмно-синяя палитра проекта Союз */
        navy: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d4f0',
          300: '#9babc6',
          400: '#7b8db5',
          500: '#6070a0',
          600: '#4a5580',
          700: '#2d3a60',
          750: '#1e2955',
          800: '#192050',
          850: '#151b45',
          900: '#111640',
          925: '#0f1535',
          950: '#0b1026',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        18: '4.5rem',
      },
      boxShadow: {
        'bubble': '0 1px 2px rgba(0, 0, 0, 0.08)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'card-dark': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'modal-dark': '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
