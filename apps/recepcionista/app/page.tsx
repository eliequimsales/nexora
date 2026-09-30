import type { Metadata } from "next";
import Link from "next/link";
import { DemoAtendente } from "@/components/demo-atendente";
import { ProvaSocialNotion } from "@/components/prova-social-notion";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import {
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
} from "@/lib/atendente/constantes";

export const metadata: Metadata = {
  title: "Nexora — Atendente Inteligente 24h no WhatsApp",
  description:
    "O Atendente Inteligente que aprende com a sua empresa e atende no WhatsApp quando você não pode. Nunca mais perca um cliente fora do horário ou de madrugada. A primeira semana é por nossa conta, sem cartão.",
};

/**
 * A LANDING DA NEXORA — 100% FOCADA NO ATENDENTE 24H.
 *
 * Produto Único de Entrada:
 *   O Atendente Inteligente 24h no WhatsApp: aprende com as regras, preços,
 *   serviços e horários da sua empresa. Atende e fecha agendamentos à noite e finais de semana.
 */

const PASSOS_ATENDENTE = [
  {
    titulo: "Você cadastra seus serviços e preços",
    corpo: "Corte, barba, consulta, sessão ou pacote: o Atendente aprende exatamente quanto custa e o tempo de cada atendimento.",
  },
  {
    titulo: "Você define seus horários de expediente",
    corpo: "Ele consulta sua grade livre em tempo real e nunca marca dois clientes no mesmo horário nem fura seu almoço.",
  },
  {
    titulo: "Conecta no seu WhatsApp em 30 segundos",
    corpo: "Direto pelo celular digitando um código seguro (sem precisar de câmera!) ou no computador via QR Code.",
  },
  {
    titulo: "Tira dúvidas com a sua empresa",
    corpo: "Conforme trabalha, se surgir uma pergunta nova de cliente que ele ainda não sabe, ele pergunta para você no painel e aprende para as próximas vezes.",
  },
];

/** O diferencial do Atendente no dia a dia da empresa. */
const DIFERENCA_DO_ATENDENTE = [
  {
    titulo: "Aprende com a sua empresa",
    corpo:
      "Ele responde seus clientes usando apenas as informações reais do seu negócio, sem inventar preços ou horários.",
  },
  {
    titulo: "Agenda em tempo real",
    corpo:
      "Consulta os horários livres da sua equipe automaticamente e confirma os agendamentos sem qualquer conflito.",
  },
  {
    titulo: "Transparência e Honestidade",
    corpo:
      "Ele se identifica educadamente como o assistente virtual da sua empresa, garantindo um atendimento profissional.",
  },
  {
    titulo: "Controle Total na sua Mão",
    corpo:
      "O robô atende os clientes que chegam, mas se você responder diretamente pelo celular, ele para na hora e te deixa assumir.",
  },
];

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

export default function Home({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  return (
    <TemaNexora>
      <TrackViewContent name="Landing Page" />
      <header className="sticky top-0 z-40 border-b border-nx-border/80 bg-nx-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg transition-transform group-hover:scale-105">
              N
            </span>
            <span className="text-base font-bold tracking-tight text-nx-primary">Nexora</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-sm font-medium text-nx-secondary transition-colors hover:text-nx-primary"
            >
              Entrar
            </Link>
            <CtaLink href="/cadastro" ctaName="header" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Começar grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </div>
      </header>

      <main>
        {/* HERO — ATENDENTE 24H COMO CARRO-CHEFE */}
        <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-24 lg:pb-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-nx-gold/30 bg-nx-gold/10 px-3.5 py-1 text-xs font-semibold text-nx-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-nx-gold animate-pulse" />
              Atendente Inteligente 24 horas no WhatsApp
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight [text-wrap:balance] sm:text-5xl lg:text-[3.35rem]">
              Nunca mais perca clientes fora do horário ou{" "}
              <span className="text-nx-gold">de madrugada.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-nx-secondary sm:text-lg">
              Mensagens que chegam às 22h ou no fim de semana viram agendamentos fechados.
              A Nexora atende no seu WhatsApp em segundos, tira dúvidas de preços e garante o cliente enquanto você descansa.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <CtaLink href="/cadastro" ctaName="hero_atendente" className={`${BOTAO_DOURADO} px-8 py-4 text-base shadow-nx-glow-sm hover:scale-[1.02]`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <a
                href="#atendente"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-nx-border-2 bg-nx-surface/60 px-6 py-4 text-base font-medium text-nx-primary transition-all hover:border-nx-gold/40 hover:bg-nx-surface"
              >
                Ver demonstração ao vivo <span aria-hidden="true">↓</span>
              </a>
            </div>

            {/* SIMULADOR INTERATIVO NO WHATSAPP */}
            <div id="atendente" className="scroll-mt-24 mx-auto mt-12 w-full max-w-2xl text-left">
              <span id="simulador" className="sr-only" />
              <DemoAtendente />
            </div>
          </div>
        </section>

        {/* PROVA SOCIAL ESTILO NOTION — LOGO ABAIXO DA TELA DO WHATSAPP */}
        <ProvaSocialNotion />

        {/* DIFERENCIAIS DO ATENDENTE VIRTUAL */}
        <section className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                Por que a Nexora
              </span>
              <h2 className="mt-3 text-3xl font-bold leading-tight [text-wrap:balance] sm:text-4xl text-nx-primary">
                O Atendente que aprende tudo sobre a sua empresa
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-nx-secondary">
                Quem responde primeiro fica com a venda. Veja os pilares de inteligência e controle do seu WhatsApp:
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DIFERENCA_DO_ATENDENTE.map((d) => (
                <div key={d.titulo} className="rounded-2xl border border-nx-border bg-nx-surface p-5 transition-all hover:border-nx-gold/30">
                  <h3 className="flex items-center gap-2 font-semibold text-nx-primary text-base">
                    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nx-success/15 text-xs font-bold text-nx-success">
                      ✓
                    </span>
                    {d.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{d.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMO O ATENDENTE APRENDE COM A SUA EMPRESA */}
        <section className="border-t border-nx-border/80 bg-nx-surface-2/10 px-6 py-20">
          <div className="mx-auto max-w-6xl text-center">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              O Diferencial da Nexora
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl text-nx-primary">
              O Atendente aprende as regras exatas da sua empresa
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-nx-secondary">
              Ele não é um robô que inventa respostas. Ele consulta os dados que você mesmo cadastrou no painel.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
              {PASSOS_ATENDENTE.map((p) => (
                <div key={p.titulo} className="rounded-2xl border border-nx-border bg-nx-surface p-6 sm:p-7 transition-all hover:border-nx-gold/40">
                  <h3 className="font-semibold text-base sm:text-lg text-nx-primary">{p.titulo}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* CTA FINAL */}
        <section className="border-t border-nx-border/80 px-6 py-24">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-nx-gold/30 bg-nx-surface p-8 text-center sm:p-14 shadow-nx-glow-sm">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl text-nx-primary">
              Nunca mais perca clientes fora do horário.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-nx-secondary sm:text-lg">
              Crie sua conta em 15 segundos: não pedimos cartão para começar. A Primeira semana por nossa conta permite testar o Atendente 24h por {SEMANA_GRATIS_DIAS} dias ou até {SEMANA_GRATIS_CONVERSAS} conversas com as regras da sua empresa. Você só continua se gostar do resultado.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4">
              <CtaLink href="/cadastro" ctaName="final" className={`${BOTAO_DOURADO} px-8 py-4 text-base sm:text-lg shadow-nx-glow-sm hover:scale-[1.02]`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <Link href="/precos" className="text-sm font-semibold text-nx-gold transition-colors hover:underline">
                Conhecer todos os planos e preços <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* No celular o botão nunca sai da tela */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-2 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="mobile_sticky_atendente" className={`${BOTAO_DOURADO} flex-1 px-4 py-3 text-xs font-bold`}>
          Ativar 24h grátis →
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
