import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/lib/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: "B'reshit",
    template: "%s — B'reshit",
  },
  description: 'Plataforma de operação comercial com IA.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-brand-bg text-text-primary font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
