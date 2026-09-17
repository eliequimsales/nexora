import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { MetaPixel } from "@/components/meta-pixel";
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
  title: "Nexora — recuperação de clientes inativos",
  description:
    "A Nexora descobre quais clientes pararam de voltar e te entrega a mensagem pronta para trazer cada um. Diagnóstico grátis, sem cartão.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1101648275753987";

  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <MetaPixel id={pixelId} />
        {children}
      </body>
    </html>
  );
}
