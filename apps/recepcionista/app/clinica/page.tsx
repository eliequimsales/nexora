import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { DemoAtendente } from "@/components/demo-atendente";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { WhatsAppDemoCard } from "@/components/whatsapp-demo-card";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
import { MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

export const metadata: Metadata = {
  title: "Nexora para Clínicas e Salões — Atendente Inteligente 24h no WhatsApp",
  description:
    "Para clínicas de estética e salões: o Atendente Inteligente que atende no seu WhatsApp 24h, responde sobre procedimentos, valores e fecha agendamentos à noite e aos finais de semana.",
};

/**
 * PÁGINA DE NICHO: CLÍNICAS DE ESTÉTICA & SALÕES DE BELEZA.
 *
 * Foco na maior dor do segmento: mensagens que chegam às 22h/23h ou fins de semana
 * pedindo orçamentos de procedimentos, valores e horários vagos — e que esfriam
 * quando a resposta só chega no dia seguinte.
 */

const RAMO = "estetica";
const RITMO_DA_CLINICA = MEDIANA_POR_SEGMENTO.estetica;
const DIAGNOSTICO = "/diagnostico?ramo=estetica";

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

const PASSOS = [
  {
    titulo: "1. Você cadastra seus procedimentos e valores",
    corpo:
      "Limpeza de pele, botox, drenagem, massagem ou manicure: a Nexora aprende os valores e a duração de cada procedimento.",
  },
  {
    titulo: "2. Define a grade de horários de cada profissional",
    corpo:
      `Ela consulta os horários livres em tempo real e nunca marca duas clientes no mesmo horário. O ritmo médio de retorno é de cerca de ${RITMO_DA_CLINICA} dias.`,
  },
  {
    titulo: "3. Atende no WhatsApp mesmo enquanto você descansa",
    corpo:
      "A cliente mandou mensagem às 23h de domingo? O Atendente tira as dúvidas com carinho e já deixa a sessão agendada.",
  },
];

export default function PaginaClinica() {
  const linkWhatsApp = obterLinkWhatsAppDemo();

  return (
    <TemaNexora>
      <header className="sticky top-0 z-40 border-b border-nx-border bg-nx-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
              N
            </span>
            <span className="font-semibold text-nx-primary">Nexora</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-nx-secondary transition-colors hover:text-nx-primary"
            >
              Entrar
            </Link>
            <Link href="/cadastro" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Começar grátis <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO CLÍNICA */}
        <section className="px-6 pb-12 pt-16 sm:pt-20">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              Para clínicas de estética, spas e salões de beleza
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem] text-nx-primary">
              Nunca mais perca clientes que mandam mensagem{" "}
              <span className="text-nx-gold">às 22h ou no domingo.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-nx-secondary sm:text-xl">
              Quantas clientes já te chamaram no WhatsApp fora do expediente perguntando sobre
              procedimentos e você só viu no dia seguinte? A Nexora responde na hora, informa valores
              e fecha o agendamento no seu próprio WhatsApp.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Link href="/cadastro" className={`${BOTAO_DOURADO} px-7 py-4 text-base shadow-nx-glow-sm`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </Link>
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-nx-success/40 bg-nx-surface px-6 py-4 text-base font-medium text-nx-primary transition-colors hover:border-nx-success hover:bg-nx-surface-2"
              >
                <span className="h-2 w-2 rounded-full bg-nx-success animate-pulse" />
                Testar no WhatsApp de Demonstração
              </a>
            </div>

            {/* DEMONSTRAÇÃO DIRETA NO WHATSAPP */}
            <div className="pt-6">
              <WhatsAppDemoCard className="mx-auto max-w-2xl text-left" origem="hero" />
            </div>
          </div>
        </section>

        {/* SIMULADOR AO VIVO DO WHATSAPP */}
        <section id="simulador" className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/20 px-6 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              Demonstração ao Vivo
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl text-nx-primary">
              Experimente agora como sua cliente vai ser atendida
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-nx-secondary">
              Mande uma mensagem abaixo ou clique nas sugestões. Veja como o Atendente tira dúvidas sobre procedimentos, valores e fecha horários na hora.
            </p>
            <div className="mt-10 mx-auto max-w-md text-left">
              <DemoAtendente nichoInicial="clinica" />
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA PARA CLÍNICAS */}
        <section className="bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl text-nx-primary">
              Como funciona para sua clínica ou salão
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PASSOS.map((p, i) => (
                <div key={p.titulo} className="rounded-xl border border-nx-border bg-nx-surface p-6 shadow-sm">
                  <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">
                    PASSO {i + 1}
                  </span>
                  <h3 className="mt-3 font-semibold leading-snug text-nx-primary">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CALCULADORA DE RETORNO */}
        <section id="calculadora" className="scroll-mt-20 px-6 pb-20 pt-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold leading-tight sm:text-4xl text-nx-primary">
              Quanto faturamento está parado na lista da sua clínica?
            </h2>
            <p className="mx-auto mb-10 mt-4 max-w-xl text-center text-nx-secondary">
              Descubra quantas clientes de estética e salão costumam sumir sem avisar. Ritmo de referência de{" "}
              {RITMO_DA_CLINICA} dias.
            </p>
            <Calculadora ramo="estetica" />
          </div>
        </section>

        {/* QUANTO CUSTA */}
        <section id="preco" className="scroll-mt-20 border-t border-nx-border bg-nx-surface-2/20 px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl text-nx-primary">Preço justo e sem surpresas</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-nx-secondary">
              Apenas {emReais(PRECO_MENSAL_CENTS)} por mês no plano Atendente 24h. Menos que o valor de um único
              procedimento da sua clínica para ter atendimento automático 24 horas por dia, 7 dias por semana.
            </p>

            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-nx-gold/30 bg-nx-gold/5 p-5 text-sm leading-relaxed text-nx-secondary text-left">
              <strong className="font-semibold text-nx-gold">
                Garantia Dinheiro Recuperado de {GARANTIA_DIAS} dias.
              </strong>{" "}
              Se em {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas e o
              faturamento recuperado não pagar a mensalidade, devolvemos 100% do seu dinheiro. O risco é nosso.
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/cadastro" className={`${BOTAO_DOURADO} px-8 py-4 text-base shadow-nx-glow-sm`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </Link>
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-nx-border bg-nx-surface px-6 py-4 text-sm font-semibold text-nx-primary hover:bg-nx-surface-2 transition-colors"
              >
                💬 Falar com o Atendente no WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES */}
        <section className="bg-nx-surface-2/30 px-6 py-20 border-t border-nx-border">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl text-nx-primary">
              Perguntas frequentes
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {PERGUNTAS_FREQUENTES.map((p) => (
                <div key={p.pergunta} className="rounded-xl border border-nx-border bg-nx-surface p-6 shadow-sm">
                  <h3 className="font-semibold text-nx-primary">{p.pergunta}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.resposta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* CTA FIXO NO MOBILE */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <Link href="/cadastro" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Começar grátis sem cartão <span aria-hidden="true">→</span>
        </Link>
      </div>
    </TemaNexora>
  );
}
