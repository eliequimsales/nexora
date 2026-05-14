import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://nexora.com.br'),
  title: {
    default: "Nexora — A IA que recupera seus clientes perdidos",
    template: "%s | Nexora",
  },
  description:
    'A Nexora identifica clientes que pararam de voltar e traz eles de volta automaticamente — enquanto você cuida do seu negócio.',
  keywords: ['recuperação de clientes', 'IA para barbearias', 'automação de clientes', 'retenção automática', 'churn de clientes'],
  authors: [{ name: "Nexora" }],
  creator: "Nexora",
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://nexora.com.br',
    siteName: "Nexora",
    title: "Nexora — A IA que recupera seus clientes perdidos",
    description:
      'A Nexora identifica clientes que pararam de voltar e traz eles de volta automaticamente — enquanto você cuida do seu negócio.',
    images: [{ url: '/og/default.png', width: 1200, height: 630, alt: "Nexora" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nexora — A IA que recupera seus clientes perdidos",
    description: 'A IA que recupera seus clientes perdidos no automático.',
    images: ['/og/default.png'],
    creator: '@nexora',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
        {children}
      </body>
    </html>
  );
}
