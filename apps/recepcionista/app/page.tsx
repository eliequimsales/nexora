import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { DemoAtendente } from "@/components/demo-atendente";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { WhatsAppDemoCard } from "@/components/whatsapp-demo-card";
import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";
import {
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_DA_HOME } from "@/lib/perguntas";
import { classificar, NOME_DA_ESTEIRA } from "@/lib/recuperacao/esteiras";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { mensagemDoToque, TOTAL_TOQUES } from "@/lib/recuperacao/toques";

export const metadata: Metadata = {
  title: "Nexora — Atendente Inteligente 24h no WhatsApp e recuperação de clientes",
  description:
    "O Atendente Inteligente que aprende com a sua empresa e atende no WhatsApp quando você não pode. Nunca mais perca um cliente fora do horário ou de madrugada. A primeira semana do Atendente e a primeira Onda são por nossa conta, sem cartão.",
};

/**
 * A LANDING DA NEXORA — ATENDENTE 24H COMO CARRO-CHEFE.
 *
 * Produto Principal:
 *   1. O Atendente Inteligente 24h no WhatsApp: aprende com as regras, preços,
 *      serviços e horários da sua empresa. Atende e fecha agendamentos à noite e finais de semana.
 *   2. O Recuperador de Clientes (Plano Completo): traz de volta quem parou de vir.
 */

const SELOS = [
  "Aprende com a sua empresa",
  "Primeira semana por nossa conta",
  "Sem cartão de crédito",
  "Responde no seu WhatsApp",
];

const PASSOS_ATENDENTE = [
  {
    titulo: "1. Você cadastra seus serviços e preços",
    corpo: "Corte, barba, consulta, sessão ou pacote: o Atendente aprende exatamente quanto custa e o tempo de cada atendimento.",
  },
  {
    titulo: "2. Você define seus horários de expediente",
    corpo: "Ele consulta sua grade livre em tempo real e nunca marca dois clientes no mesmo horário nem fura seu almoço.",
  },
  {
    titulo: "3. Conecta o WhatsApp via QR Code",
    corpo: "No seu próprio número de WhatsApp comercial. Você descansa e ele tira dúvidas, informa preços e agenda clientes.",
  },
];

const HOJE_DO_EXEMPLO = new Date("2026-09-14T12:00:00.000Z");
const DIA_MS = 86_400_000;

const ONDA_EXEMPLO = [
  { nome: "Marcos", ciclo: 28, dias: 64 },
  { nome: "Dona Cida", ciclo: 35, dias: 120 },
  { nome: "Júnior", ciclo: 21, dias: 18 },
].map((c) => {
  const { esteira, diasAlemDoCiclo } = classificar({
    ultimaVisita: new Date(HOJE_DO_EXEMPLO.getTime() - c.dias * DIA_MS),
    ciclo: { dias: c.ciclo, confianca: "alta", visitas: 6, motivo: "" },
    temAgendamentoFuturo: false,
    hoje: HOJE_DO_EXEMPLO,
  });
  return {
    ...c,
    etiqueta: esteira === "EM_DIA" ? null : NOME_DA_ESTEIRA[esteira],
    porque:
      diasAlemDoCiclo > 0
        ? `Costuma voltar a cada ${c.ciclo} dias e já passou ${diasAlemDoCiclo} dias disso.`
        : `Costuma voltar a cada ${c.ciclo} dias, e a data dele cai nesta semana.`,
  };
});

const MENSAGEM_EXEMPLO = mensagemDoToque(1, { primeiroNome: "Marcos", negocio: "", link: "" });

const REGRAS_DA_ONDA = [
  "Quem tem horário marcado nunca entra na lista.",
  "Quem já respondeu sai na hora.",
  "Você lê cada mensagem antes de ela sair do seu WhatsApp.",
];

const PASSOS_DA_REATIVACAO = [
  {
    titulo: "Você manda sua lista do jeito que ela está",
    corpo:
      "Colado do Excel, planilha, lista de contatos ou caderno digitado. A Nexora entende e diz em português o que não conseguiu ler.",
  },
  {
    titulo: "Ela descobre o ritmo de cada cliente",
    corpo:
      "Nada de regra de 60 dias para todo mundo. Quem ia toda semana e sumiu há um mês está muito mais atrasado que quem ia de três em três meses.",
  },
  {
    titulo: "Toda segunda, doze mensagens prontas",
    corpo:
      "Mensagens personalizadas para cada pessoa no tom certo. Você aprova e envia com um toque no seu WhatsApp.",
  },
];

/** O diferencial do Atendente, que é também o limite dele. */
const DIFERENCA_DO_ATENDENTE = [
  {
    titulo: "Aprende com a sua empresa",
    corpo:
      "Preço e horário só do seu cadastro: horário livre sai da sua agenda de verdade, e é nela que ele marca. O que não está cadastrado, ele não inventa: anota para você responder.",
  },
  {
    titulo: "Agenda em tempo real sem conflito",
    corpo:
      "Ele sabe quem são os profissionais da equipe, consulta vagas em tempo real e confirma direto com o cliente.",
  },
  {
    titulo: "Nunca finge ser gente",
    corpo:
      "Na primeira resposta do dia, ele se apresenta como atendente virtual do seu negócio, com o nome que você escolher.",
  },
  {
    titulo: "Você respondeu, ele sai",
    corpo: `Com a loja aberta, a mensagem é sua: ele só entra depois de ${MINUTOS_SEM_RESPOSTA} minutos sem ninguém responder, se você deixar. Respondeu pelo celular, ele sai da conversa.`,
  },
];

const INCLUI = [
  `Atendente Virtual no seu WhatsApp, até ${TETO_CONVERSAS_MES} conversas por mês`,
  `A primeira semana do Atendente por nossa conta: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas`,
  "Aprende seus serviços, valores e horários para responder sem inventar",
  "Página de agendamento com seu link, para o cliente marcar sozinho",
  `A primeira Onda por nossa conta, sem cartão: até ${TAMANHO_DA_ONDA} mensagens em até ${DIAS_DA_PRIMEIRA_ONDA} dias`,
  "Doze mensagens prontas por semana, escritas para cada cliente no plano Completo",
  `Garantia Dinheiro Recuperado de ${GARANTIA_DIAS} dias`,
  "O quanto você já recuperou, em reais, com nome de quem voltou",
  "Cancele quando quiser — você fica com o período que já pagou",
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

            <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight [text-wrap:balance] sm:text-5xl lg:text-[3.5rem]">
              Nunca mais perca clientes fora do horário ou{" "}
              <span className="text-nx-gold">de madrugada.</span>
              <span className="mt-4 block text-xl font-normal tracking-normal text-nx-secondary sm:text-2xl lg:text-[1.65rem]">
                O Atendente Inteligente que aprende tudo sobre a sua empresa e fecha agendamentos no seu WhatsApp enquanto você dorme.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-nx-secondary sm:text-lg">
              Quantas mensagens chegam no seu WhatsApp às 22h, 23h ou no fim de semana e você só vê no dia seguinte?
              A Nexora responde imediatamente, tira dúvidas sobre serviços e preços e fecha o agendamento no automático — direto no seu
              número, mesmo com o estabelecimento fechado.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <CtaLink href="/cadastro" ctaName="hero_atendente" className={`${BOTAO_DOURADO} px-8 py-4 text-base shadow-nx-glow-sm hover:scale-[1.02]`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <a
                href="#atendente"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-nx-border-2 bg-nx-surface/60 px-6 py-4 text-base font-medium text-nx-primary transition-all hover:border-nx-gold/40 hover:bg-nx-surface"
              >
                Ver demonstração ao vivo <span aria-hidden="true">↓</span>
              </a>
              <a
                href="#calculadora"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-nx-border-2 bg-nx-surface/60 px-6 py-4 text-base font-medium text-nx-primary transition-all hover:border-nx-gold/40 hover:bg-nx-surface"
              >
                Calcular quanto estou perdendo <span aria-hidden="true">↓</span>
              </a>
            </div>

            {/* MICRO BADGES DE CONFIANÇA E RAPIDEZ */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-nx-secondary font-medium">
              <span className="flex items-center gap-1.5 text-nx-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-nx-gold animate-pulse" />
                Pronto no seu WhatsApp em 2 minutos
              </span>
              <span className="text-nx-muted">•</span>
              <span>não pedimos cartão para começar</span>
              <span className="text-nx-muted">•</span>
              <span>Cancele quando quiser</span>
            </div>

            {/* SELOS DE SEGURANÇA */}
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-xs text-nx-secondary">
              {SELOS.map((selo) => (
                <li
                  key={selo}
                  className="inline-flex items-center gap-1.5 rounded-full border border-nx-border/80 bg-nx-surface/80 px-3.5 py-1 font-medium"
                >
                  <span aria-hidden="true" className="text-nx-success">
                    ✓
                  </span>
                  {selo}
                </li>
              ))}
            </ul>

            {/* SIMULADOR INTERATIVO NO WHATSAPP (Substitui o card e o preview estático) */}
            <div id="atendente" className="scroll-mt-24 mx-auto mt-12 w-full max-w-2xl text-left">
              <DemoAtendente />
            </div>
          </div>
        </section>

        {/* DIFERENCIAIS DO ATENDENTE VIRTUAL */}
        <section className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                Por que a Nexora
              </span>
              <h2 className="mt-3 text-3xl font-bold leading-tight [text-wrap:balance] sm:text-4xl text-nx-primary">
                O Atendente que aprende tudo sobre a sua empresa — e nunca deixa cliente sem resposta
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-nx-secondary">
                O cliente mandou mensagem às 22h, no domingo ou enquanto você atendia outra pessoa? Quem
                responde primeiro fica com a venda.
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

            <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-nx-border/80 bg-nx-surface-2/60 p-4 text-xs leading-relaxed text-nx-muted text-center">
              <span className="font-semibold text-nx-secondary">Nota de transparência:</span> A conexão pelo QR Code não é a oficial do WhatsApp, e números podem ser restringidos. Como o
              Atendente só responde quem escreveu primeiro e nunca manda mensagem sozinho, o risco
              diminui — mas não some.
            </div>
          </div>
        </section>

        {/* COMO O ATENDENTE APRENDE COM A SUA EMPRESA */}
        <section className="border-t border-nx-border/80 bg-nx-surface-2/10 px-6 py-20">
          <div className="mx-auto max-w-5xl text-center">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              O Diferencial da Nexora
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl text-nx-primary">
              O Atendente aprende as regras exatas da sua empresa
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-nx-secondary">
              Ele não é um robô que inventa respostas. Ele consulta os dados que você mesmo cadastrou no painel.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-3 text-left">
              {PASSOS_ATENDENTE.map((p) => (
                <div key={p.titulo} className="rounded-2xl border border-nx-border bg-nx-surface p-7 transition-all hover:border-nx-gold/40">
                  <h3 className="font-semibold text-lg text-nx-primary">{p.titulo}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* E PARA QUEM QUER MAIS: O RECUPERADOR DE CLIENTES (PLANO COMPLETO) */}
        <section id="como-funciona" className="scroll-mt-20 border-t border-nx-border/80 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                Disponível no Plano Completo
              </span>
              <h2 className="mt-3 text-3xl font-bold leading-tight [text-wrap:balance] sm:text-4xl text-nx-primary">
                Seus clientes não avisam que estão indo embora. Eles simplesmente param de voltar.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-nx-secondary">
                Seus clientes não sumiram porque quiseram. Eles só esqueceram de voltar. A Nexora percebe pelo ritmo de cada um — e escreve a mensagem que traz cada um de volta.
              </p>
              <div className="mt-6 flex justify-center">
                <CtaLink href="/cadastro" ctaName="recuperador_secao" className={`${BOTAO_DOURADO} px-6 py-3 text-sm`}>
                  Recuperar meus clientes grátis <span aria-hidden="true">→</span>
                </CtaLink>
              </div>
            </div>

            {/* OS 3 PASSOS DA REATIVAÇÃO */}
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {PASSOS_DA_REATIVACAO.map((p, i) => (
                <div
                  key={p.titulo}
                  className="rounded-2xl border border-nx-border bg-nx-surface p-7 transition-all hover:border-nx-gold/40 hover:bg-nx-surface-2/60"
                >
                  <span className="font-mono text-xs font-bold tracking-[0.16em] text-nx-gold">
                    PASSO 0{i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold leading-snug text-nx-primary">{p.titulo}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>

            {/* A ONDA DE EXEMPLO COM REGRAS ANTI-DISPARO */}
            <div className="mt-16 grid items-start gap-10 lg:grid-cols-2">
              <div>
                <h3 className="text-2xl font-bold leading-snug text-nx-primary">
                  Não é para todo mundo no mesmo dia.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-nx-secondary sm:text-lg">
                  A Nexora manda <strong className="font-semibold text-nx-primary">doze por semana</strong>,
                  escolhidas pelo ritmo de cada cliente. É mais devagar de propósito.
                </p>
                <ul className="mt-6 space-y-3">
                  {REGRAS_DA_ONDA.map((regra) => (
                    <li
                      key={regra}
                      className="flex items-start gap-3 rounded-xl border border-nx-border/80 bg-nx-surface/60 p-3.5 text-sm text-nx-secondary"
                    >
                      <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nx-success/15 text-xs font-bold text-nx-success">
                        ✓
                      </span>
                      <span>{regra}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CARD DE EXEMPLO DA ONDA */}
              <div className="rounded-2xl border border-nx-border-2 bg-nx-surface p-6 shadow-nx-panel">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nx-border pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-nx-gold" />
                    <p className="font-semibold text-nx-primary">Reativar clientes</p>
                    <span className="rounded-full border border-nx-border bg-nx-surface-2 px-2 py-0.5 text-[11px] font-medium text-nx-muted">
                      exemplo
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-nx-gold">
                    {TAMANHO_DA_ONDA} clientes · ~9 min
                  </span>
                </div>
                <ul className="divide-y divide-nx-border">
                  {ONDA_EXEMPLO.map((c, i) => (
                    <li key={c.nome} className="py-4 first:pt-4 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-nx-primary">{c.nome}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-nx-secondary">
                            Última visita há {c.dias} dias. {c.porque}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {c.etiqueta && (
                            <span className="rounded-full border border-nx-gold/25 bg-nx-gold/10 px-2 py-0.5 text-[11px] font-semibold text-nx-gold">
                              {c.etiqueta}
                            </span>
                          )}
                          <span className="text-[11px] text-nx-muted">1ª de {TOTAL_TOQUES} mensagens</span>
                        </div>
                      </div>
                      {i === 0 && (
                        <div className="mt-3 whitespace-pre-line rounded-xl border border-nx-border bg-nx-surface-2 p-3.5 text-sm leading-relaxed text-nx-secondary">
                          {MENSAGEM_EXEMPLO}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-nx-border/60 pt-3 text-center text-[11px] leading-relaxed text-nx-muted">
                  As etiquetas e a mensagem são as mesmas que o painel monta. Os nomes não são de ninguém.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CALCULADORA DE RETORNO */}
        <section id="calculadora" className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/20 px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                A conta que ninguém faz
              </span>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-nx-primary sm:text-4xl">
                Quanto dinheiro está parado na sua lista de clientes?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-nx-secondary">
                Três números seus. A conta aparece na hora, com a fórmula à vista.
              </p>
            </div>
            <div className="mt-12 rounded-2xl border border-nx-border-2 bg-nx-surface p-6 sm:p-10 shadow-nx-panel">
              <Calculadora />
            </div>
          </div>
        </section>

        {/* O QUE A NEXORA NÃO É */}
        <section id="nao-e" className="scroll-mt-20 border-t border-nx-border/80 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-error">
                Segurança do seu número
              </span>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl text-nx-primary">O que a Nexora não é</h2>
            </div>
            <div className="mx-auto mt-6 max-w-3xl space-y-4 text-center text-base leading-relaxed text-nx-secondary sm:text-lg">
              <p>
                Ferramenta de disparo manda a mesma mensagem para a lista inteira no mesmo dia. Duas coisas
                acontecem: o WhatsApp limita ou bloqueia o número — e o número da sua empresa é a sua agenda
                inteira — e quem esteve na sua loja ontem recebe uma mensagem de saudade e percebe que é
                robô.
              </p>
              <p>
                A Nexora faz o contrário de propósito: poucas mensagens, no ritmo de cada cliente, lidas por
                você antes de saírem do seu WhatsApp. O Atendente Virtual segue a mesma regra: só responde
                quem escreveu primeiro.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {O_QUE_A_NEXORA_NAO_E.map((item) => (
                <div key={item.titulo} className="rounded-2xl border border-nx-border bg-nx-surface p-6 transition-all hover:border-nx-error/40">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-error/10 text-nx-error font-bold text-sm">
                    ✕
                  </div>
                  <h3 className="mt-4 font-semibold text-nx-primary">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{item.explicacao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* A OFERTA — ATENDENTE COMO ENTRADA (R$ 97) E COMPLETO (R$ 197) */}
        <section id="preco" className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/30 px-6 py-24">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-nx-gold/30 bg-nx-gold/10 px-3 py-1 text-xs font-semibold text-nx-gold">
                Risco zero
              </div>
              <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl text-nx-primary">
                A primeira semana do Atendente e a primeira Onda são por nossa conta.
              </h2>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="whitespace-nowrap text-6xl sm:text-7xl font-bold tracking-tight text-nx-primary">R$ 97</span>
                <span className="text-base text-nx-secondary">/mês no plano Atendente 24h</span>
              </div>
              <div className="mt-6 space-y-3 leading-relaxed text-nx-secondary">
                <div className="rounded-xl border border-nx-border bg-nx-surface p-4 text-sm">
                  <strong className="font-semibold text-nx-primary">A primeira semana do Atendente também:</strong>{" "}
                  {SEMANA_GRATIS_DIAS} dias ou {SEMANA_GRATIS_CONVERSAS} conversas, o que vier primeiro, a partir de quando você ligar. No plano, ele atende até{" "}
                  {TETO_CONVERSAS_MES} conversas por mês e entra no expediente depois de {MINUTOS_SEM_RESPOSTA}{" "}
                  minutos sem ninguém responder, se você quiser.
                </div>
                <div className="rounded-xl border border-nx-border bg-nx-surface p-4 text-sm">
                  <strong className="font-semibold text-nx-primary">A primeira Onda é por nossa conta:</strong> até{" "}
                  {TAMANHO_DA_ONDA} mensagens prontas para mandar do seu WhatsApp em até{" "}
                  {DIAS_DA_PRIMEIRA_ONDA} dias — não pedimos cartão para começar.
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-nx-gold/40 bg-nx-gold/10 p-4 text-sm leading-relaxed text-nx-secondary">
                <strong className="font-semibold text-nx-gold">Garantia Dinheiro Recuperado.</strong> Se em{" "}
                {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas e o dinheiro que voltou
                não chegar a {emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que você pagou. O risco é
                nosso. Vale uma vez por negócio, para lista com pelo menos {MIN_SUMIDOS} clientes sumidos; as
                regras completas estão nos{" "}
                <Link href="/termos" className="text-nx-gold underline underline-offset-4 hover:text-nx-gold/80">
                  Termos de Uso
                </Link>
                .
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <CtaLink href="/cadastro" ctaName="preco" className={`${BOTAO_DOURADO} px-8 py-4 text-base shadow-nx-glow-sm hover:scale-[1.02]`}>
                  Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
                </CtaLink>
                <Link href="/precos" className="text-sm font-semibold text-nx-gold transition-colors hover:underline">
                  Ver os três jeitos de pagar <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="mt-6">
                <WhatsAppDemoCard className="text-left" origem="atendente" />
              </div>
            </div>

            {/* CHECKLIST DE TUDO INCLUSO */}
            <div className="rounded-2xl border border-nx-border-2 bg-nx-surface p-6 sm:p-8 shadow-nx-panel">
              <h3 className="text-sm font-bold uppercase tracking-wider text-nx-gold">Tudo incluído no plano Atendente</h3>
              <ul className="mt-6 divide-y divide-nx-border">
                {INCLUI.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3.5 py-3.5 text-sm leading-relaxed text-nx-secondary first:pt-0 last:pb-0"
                  >
                    <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nx-gold/20 text-[10px] font-bold text-nx-gold">
                      ✓
                    </span>
                    <span className="text-nx-primary/95">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES */}
        <section id="perguntas" className="scroll-mt-20 border-t border-nx-border/80 px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                Tire suas dúvidas
              </span>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl text-nx-primary">
                O que ainda pode estar te segurando
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {PERGUNTAS_DA_HOME.map((p) => (
                <div key={p.pergunta} className="rounded-2xl border border-nx-border bg-nx-surface p-6 sm:p-7 transition-all hover:border-nx-border-2">
                  <h3 className="font-semibold text-nx-primary text-base">{p.pergunta}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-nx-secondary">{p.resposta}</p>
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
              Crie sua conta em 15 segundos, sem cartão de crédito. Teste o Atendente 24h com as regras da sua empresa. Você só continua se gostar do resultado.
            </p>
            <div className="mt-8 flex justify-center">
              <CtaLink href="/cadastro" ctaName="final" className={`${BOTAO_DOURADO} px-8 py-4 text-base sm:text-lg shadow-nx-glow-sm hover:scale-[1.02]`}>
                Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
              </CtaLink>
            </div>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* No celular o botão nunca sai da tela */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="mobile_sticky_atendente" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Ativar meu Atendente 24h grátis <span aria-hidden="true">→</span>
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
