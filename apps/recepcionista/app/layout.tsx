import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { MetaPixel } from "@/components/meta-pixel";
import { InstallPrompt } from "@/components/install-prompt";
import "./globals.css";

// preload: false nas três. Elas servem painel, jurídico e agendamento; o funil
// público usa a Geist (components/tema-nexora.tsx). Pré-carregadas, desciam em
// toda página — inclusive no 4G de quem chega pelo anúncio e nunca as vê.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  preload: false,
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.meunexora.com.br"),
  title: "Nexora — Atendente Inteligente 24h no WhatsApp com IA",
  description:
    "O Atendente Inteligente que aprende com a sua empresa e atende no WhatsApp quando você não pode. Nunca mais perca um cliente fora do horário ou de madrugada. Primeira semana por nossa conta, sem cartão.",
  keywords: [
    "atendente virtual whatsapp",
    "ia para whatsapp",
    "inteligencia artificial whatsapp",
    "agendamento automatico whatsapp",
    "atendimento 24h whatsapp",
    "chatbot humanizado sem menu",
    "ia para clinicas",
    "ia para barbearias e saloes",
    "nexora",
    "nexora atendente",
  ],
  authors: [{ name: "Nexora Tecnologia" }],
  creator: "Nexora",
  publisher: "Nexora",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://www.meunexora.com.br",
    siteName: "Nexora",
    title: "Nexora — Atendente Inteligente 24h no WhatsApp com IA",
    description:
      "O Atendente Inteligente que aprende com a sua empresa e atende no WhatsApp quando você não pode. Primeira semana por nossa conta, sem cartão.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Nexora Atendente Inteligente 24h",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexora — Atendente Inteligente 24h no WhatsApp com IA",
    description:
      "Atendimento 24 horas no WhatsApp sem perder clientes. Primeira semana por nossa conta, sem cartão.",
    images: ["/icons/icon-512.png"],
  },
  alternates: {
    canonical: "https://www.meunexora.com.br",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexora",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#08090A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1041816645171094";

  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <MetaPixel id={pixelId} />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
