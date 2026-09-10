import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

/**
 * O VISUAL DA NEXORA ANTIGA, SÓ NO FUNIL PÚBLICO.
 *
 * Os anúncios rodaram em cima da Nexora antiga (apps/app): quem clica espera
 * aquela cara. Home, diagnóstico, cadastro, login e as telas de senha usam este
 * tema; painel, jurídico e agendamento continuam no de antes.
 *
 * A troca de fonte não passa por classe nenhuma: .tema-nx (app/globals.css)
 * redefine --font-body, --font-display e --font-mono, então tudo aqui dentro
 * vira Geist — inclusive componentes que já existiam.
 *
 * Componente de servidor de propósito. As telas "use client" o recebem por um
 * layout.tsx ao lado, e ele não vai parar no código enviado ao navegador.
 */
export function TemaNexora({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} tema-nx min-h-screen bg-nx-bg text-nx-primary antialiased`}
    >
      {children}
    </div>
  );
}
