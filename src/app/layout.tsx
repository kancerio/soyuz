import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Союз | Мессенджер с ИИ',
  description: 'Безопасный мессенджер с встроенными функциями искусственного интеллекта и перевода',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0f4ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1026' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen overflow-x-hidden w-full bg-[#f0f4ff] dark:bg-[#0b1026] text-[#1a2038] dark:text-[#e8ecf4] font-sans antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
