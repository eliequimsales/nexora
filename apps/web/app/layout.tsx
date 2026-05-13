import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://reshit.com'),
  title: {
    default: "B'reshit — Operação inteligente com IA",
    template: "%s | B'reshit",
  },
  description:
    'Plataforma SaaS de automação empresarial com IA. Leads, pipeline, mensagens, tarefas e workflows num sistema que pensa junto com sua equipe.',
  keywords: ['automação empresarial', 'CRM com IA', 'plataforma SaaS', 'gestão de leads', 'workflows de IA'],
  authors: [{ name: "B'reshit" }],
  creator: "B'reshit",
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://reshit.com',
    siteName: "B'reshit",
    title: "B'reshit — Operação inteligente com IA",
    description:
      'Plataforma SaaS de automação empresarial com IA. Do lead ao fechamento, com inteligência em cada etapa.',
    images: [{ url: '/og/default.png', width: 1200, height: 630, alt: "B'reshit" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "B'reshit — Operação inteligente com IA",
    description: 'Automação empresarial com IA. Multi-nicho. Escalável.',
    images: ['/og/default.png'],
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
