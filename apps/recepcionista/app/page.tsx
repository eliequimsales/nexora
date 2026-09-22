import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { DemoAtendente } from "@/components/demo-atendente";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import {
  MAX_RESPOSTAS_POR_DIA,
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
import { classificar, NOME_DA_ESTEIRA } from "@/lib/recuperacao/esteiras";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { mensagemDoToque, TOTAL_TOQUES } from "@/lib/recuperacao/toques";

export const metadata: Metadata = {
  title: "Nexora — responda seus clientes no WhatsApp quando você não pode, e traga de volta quem sumiu",
  description:
    "O Atendente Virtual responde e marca horário quando você não pode. A Onda traz de volta quem parou de vir. A primeira semana do Atendente e a primeira Onda são por nossa conta, sem cartão.",
};

/**
 * A LANDING DA ESTEIRA.
 *
 * Duas dores, uma de cada lado do mesmo dinheiro:
 *
 *   - O cliente que escreve e ninguém responde (de noite, no domingo, com a loja
 *     cheia) marca com quem respondeu primeiro. É o hero, com a demonstração do
 *     Atendente Virtual ao lado.
 *   - O cliente que para de voltar e não avisa. É a reativação, com a frase
 *     aprovada, a calculadora e a Onda de exemplo.
 *
 * Tudo que a página promete, o código cumpre: os números saem das constantes
 * (tests/promessas-da-landing.test.ts), a demonstração usa os textos do motor e
 * se declara exemplo, e o risco zero é exatamente o que a conta nova ganha — a
 * primeira Onda e a primeira semana do Atendente.
 *
 * Direção visual: a da Nexora antiga, que os anúncios mostram
 * (docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md).
 * Desenho desta versão: docs/superpowers/specs/2026-09-22-atendente-virtual-design.md
 */

const SELOS = [
  "Primeira semana do Atendente por nossa conta",
  "Primeira Onda por nossa conta",
  "Sem cartão para começar",
  "Nunca finge ser gente",
];

/**
 * A ONDA DE EXEMPLO — e a tela diz que é exemplo.
 *
 * Os ritmos são plausíveis para uma barbearia e os nomes não são de ninguém. O
 * que NÃO é inventado: a etiqueta sai da mesma classificação que monta a Onda de
 * verdade, e a mensagem sai do mesmo motor que escreve a do painel. A data é fixa
 * para a página não mudar de etiqueta sozinha de um dia para o outro.
 */
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

/** Os três passos da tela "Atendente Virtual", do jeito que o dono vai ver. */
const PASSOS_DO_ATENDENTE = [
  {
    titulo: "Quem ele é e como fala",
    corpo:
      "Você dá um nome e escolhe o jeito — acolhedor, direto ou descontraído — lendo a mesma conversa escrita nos três, com os seus serviços.",
  },
  {
    titulo: "O que ele sabe",
    corpo:
      "Serviços, preços e horários vêm da sua agenda; endereço, pagamento e perguntas, do seu cadastro. Nada de formulário novo.",
  },
  {
    titulo: "Testar e ligar",
    corpo:
      "Você conversa com ele num WhatsApp na tela, com os seus dados de verdade, e liga no seu número quando gostar do que viu.",
  },
];

/** As regras dele, que são o argumento. */
const REGRAS_DO_ATENDENTE = [
  {
    titulo: "Nunca finge ser gente",
    corpo: "Na primeira resposta do dia, ele se apresenta como atendente virtual do seu negócio.",
  },
  {
    titulo: "Preço e horário só do seu cadastro",
    corpo: "Horário livre sai da sua agenda de verdade. O que ele não sabe, ele anota para você responder.",
  },
  {
    titulo: "Marca na sua agenda",
    corpo: "O cliente escolhe um dos três horários livres e ele marca na hora, pela mesma regra do seu link.",
  },
  {
    titulo: "Você manda",
    corpo: `Com a loja aberta, a mensagem é sua: ele só entra depois de ${MINUTOS_SEM_RESPOSTA} minutos sem resposta, se você deixar. Respondeu pelo celular, ele sai da conversa.`,
  },
  {
    titulo: "Não insiste",
    corpo: `Só responde quem escreveu primeiro, no máximo ${MAX_RESPOSTAS_POR_DIA} respostas por conversa por dia. Nunca puxa conversa.`,
  },
  {
    titulo: "Urgência vai para quem resolve",
    corpo: "Mensagem de saúde ou segurança recebe o número de emergência na hora, e você é avisado no seu WhatsApp.",
  },
];

const PASSOS_DA_REATIVACAO = [
  {
    titulo: "Você manda sua lista do jeito que ela está",
    // O WhatsApp não entra aqui: o importador agrupa a exportação por remetente,
    // e uma conversa rende um cliente só, sem telefone.
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
      "Uma para cada cliente, com o nome dele escrito. Você lê, muda se quiser e manda do SEU WhatsApp. Uns nove minutos.",
  },
];

const INCLUI = [
  `Atendente Virtual no seu WhatsApp, até ${TETO_CONVERSAS_MES} conversas por mês`,
  `A primeira semana do Atendente por nossa conta: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas`,
  "A primeira Onda por nossa conta, sem cartão",
  `Garantia Dinheiro Recuperado de ${GARANTIA_DIAS} dias`,
  "Doze mensagens prontas por semana, escritas para cada cliente",
  "Página de agendamento com seu link, para o cliente marcar sozinho",
  "O quanto você já recuperou, em reais, com nome de quem voltou",
  "Cancele quando quiser — você fica com o período que já pagou",
];

/** O botão dourado da Nexora antiga, com o brilho. */
const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

export default function Home() {
  return (
    <TemaNexora>
      <TrackViewContent name="Landing Page" />
      <header className="sticky top-0 z-40 border-b border-nx-border bg-nx-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
              N
            </span>
            <span className="font-semibold">Nexora</span>
          </Link>
          <div className="flex items-center gap-4">
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
        {/* HERO — a dor de quem responde tarde, e o Atendente respondendo ao lado. */}
        <section className="px-6 pb-16 pt-14 sm:pt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6 text-center lg:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
                Atendente Virtual + reativação de clientes
              </p>
              <h1 className="text-4xl font-bold leading-[1.06] tracking-tight [text-wrap:balance] sm:text-5xl lg:text-[3.25rem]">
                Seu cliente mandou mensagem às 22h.{" "}
                <span className="text-nx-gold">Quem respondeu primeiro ficou com ele.</span>
              </h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-nx-secondary lg:mx-0">
                A Nexora responde por você no WhatsApp quando você não pode — de noite, no domingo e
                com a loja cheia — e marca na sua agenda. E toda semana traz de volta quem parou de vir.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 lg:justify-start">
                <CtaLink href="/cadastro" ctaName="hero" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                  Começar grátis <span aria-hidden="true">→</span>
                </CtaLink>
                <a
                  href="#calculadora"
                  className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
                >
                  Calcular quanto estou perdendo
                </a>
              </div>
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-xs text-nx-muted lg:justify-start">
                {SELOS.map((selo) => (
                  <li key={selo} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="text-nx-success">
                      ✓
                    </span>
                    {selo}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mx-auto w-full max-w-md">
              <DemoAtendente />
            </div>
          </div>
        </section>

        {/* OS DOIS JEITOS DE PERDER CLIENTE — a esteira inteira numa tela. */}
        <section id="dois-jeitos" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Os dois jeitos de perder cliente</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-nx-secondary">
              Um acontece hoje à noite. O outro, devagar, sem ninguém perceber. A Nexora cuida dos dois.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-nx-border bg-nx-surface p-7">
                <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">QUANDO NINGUÉM RESPONDE</span>
                <h3 className="mt-3 text-xl font-semibold leading-snug">
                  A mensagem chega de noite, no domingo ou com a loja cheia — e fica sem resposta.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-nx-secondary">
                  Quem pergunta preço ou horário e não ouve nada marca com quem respondeu primeiro. O
                  Atendente Virtual responde na hora, mostra três horários livres de verdade e marca na sua
                  agenda.
                </p>
                <a href="#atendente" className="mt-5 inline-block text-sm font-semibold text-nx-gold hover:underline">
                  Conhecer o Atendente Virtual →
                </a>
              </div>
              <div className="rounded-xl border border-nx-border bg-nx-surface p-7">
                <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">QUANDO O CLIENTE PARA DE VOLTAR</span>
                <h3 className="mt-3 text-xl font-semibold leading-snug">
                  Seus clientes não avisam que estão indo embora. Eles simplesmente param de voltar.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-nx-secondary">
                  A Nexora mostra quem parou de comprar, quanto dinheiro isso representa e escreve a mensagem
                  para trazer cada um de volta — {TAMANHO_DA_ONDA} por semana, que você lê e manda do seu
                  WhatsApp.
                </p>
                <a href="#calculadora" className="mt-5 inline-block text-sm font-semibold text-nx-gold hover:underline">
                  Ver quanto está parado na sua lista →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* O ATENDENTE VIRTUAL — os três passos e as regras como argumento. */}
        <section id="atendente" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              Atendente Virtual
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold leading-tight sm:text-4xl">
              Um atendente que você cria em três passos
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-nx-secondary">
              Sem configurar nada técnico: ele aprende com a agenda e o cadastro que você já tem, e você testa
              antes de ligar.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PASSOS_DO_ATENDENTE.map((p, i) => (
                <div key={p.titulo} className="rounded-xl border border-nx-border bg-nx-surface p-6">
                  <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">PASSO {i + 1}</span>
                  <h3 className="mt-3 font-semibold leading-snug">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {REGRAS_DO_ATENDENTE.map((r) => (
                <div key={r.titulo} className="rounded-xl border border-nx-border bg-nx-surface-2/60 p-5">
                  <h3 className="font-semibold">
                    <span aria-hidden="true" className="mr-2 text-nx-success">
                      ✓
                    </span>
                    {r.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{r.corpo}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-nx-muted">
              A conexão pelo QR Code não é a oficial do WhatsApp, e números podem ser restringidos. Como o
              Atendente só responde quem escreveu primeiro e nunca manda mensagem sozinho, o risco diminui — mas
              não some.
            </p>
          </div>
        </section>

        {/* A CONTA — quanto mais cedo o visitante põe os números dele, mais o
            problema vira problema DELE. */}
        <section id="calculadora" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              A conta que ninguém faz
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold leading-tight sm:text-4xl">
              Quanto dinheiro está parado na sua lista de clientes?
            </h2>
            <p className="mx-auto mb-10 mt-4 max-w-xl text-center text-nx-muted">
              Três números seus. A conta aparece na hora, com a fórmula à vista.
            </p>
            <Calculadora />
          </div>
        </section>

        {/* ONDE ELES APARECEM — a Onda de exemplo, com as peças de verdade do produto. */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              E é aqui que esses clientes aparecem
            </h2>
            <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-sm text-nx-muted">
              Uma onda de exemplo, com as mesmas etiquetas e a mesma mensagem que o painel
              monta de verdade. Os nomes não são de ninguém.
            </p>
            <div className="mx-auto max-w-xl rounded-2xl border border-nx-border bg-nx-surface p-5 shadow-nx-glow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-nx-border pb-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Reativar clientes</p>
                  <span className="rounded-full border border-nx-border bg-nx-surface-2 px-2 py-0.5 text-[11px] font-medium text-nx-muted">
                    exemplo
                  </span>
                </div>
                <span className="font-mono text-[11px] text-nx-muted">
                  {TAMANHO_DA_ONDA} clientes · ~9 min
                </span>
              </div>
              <ul>
                {ONDA_EXEMPLO.map((c, i) => (
                  <li key={c.nome} className="border-b border-nx-border py-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">{c.nome}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-nx-secondary">
                          Última visita há {c.dias} dias. {c.porque}
                        </p>
                      </div>
                      {/* Etiqueta, não botão: numa lista de exemplo, nada finge ser clicável. */}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {c.etiqueta && (
                          <span className="rounded-full border border-nx-gold/25 bg-nx-gold/10 px-2 py-0.5 text-[11px] font-semibold text-nx-gold">
                            {c.etiqueta}
                          </span>
                        )}
                        <span className="text-[11px] text-nx-muted">
                          1ª de {TOTAL_TOQUES} mensagens
                        </span>
                      </div>
                    </div>
                    {i === 0 && (
                      <p className="mt-3 whitespace-pre-line rounded-lg border border-nx-border bg-nx-surface-2 p-3 text-sm leading-relaxed text-nx-secondary">
                        {MENSAGEM_EXEMPLO}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Como a reativação funciona</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PASSOS_DA_REATIVACAO.map((p, i) => (
                <div key={p.titulo} className="rounded-xl border border-nx-border bg-nx-surface p-6">
                  <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">
                    PASSO {i + 1}
                  </span>
                  <h3 className="mt-3 font-semibold leading-snug">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="nao-e" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">O que a Nexora não é</h2>
            <div className="mx-auto mt-8 grid max-w-3xl gap-5 text-lg leading-relaxed text-nx-secondary">
              <p>
                Ferramenta de disparo manda a mesma mensagem para a lista inteira. Duas coisas
                acontecem: o WhatsApp bane o número — e o número da sua empresa é a sua agenda
                inteira — e quem esteve na sua loja ontem recebe uma mensagem de saudade e
                percebe que é robô.
              </p>
              <p>
                A Nexora manda <strong className="font-semibold text-nx-primary">doze por semana</strong>,
                escolhidas pelo ritmo de cada um. Quem tem horário marcado nunca entra na
                lista. Quem já respondeu sai na hora. E você lê cada mensagem antes de mandar.
                É mais devagar de propósito. O Atendente Virtual segue a mesma regra: só responde
                quem escreveu primeiro.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {O_QUE_A_NEXORA_NAO_E.map((item) => (
                <div key={item.titulo} className="rounded-xl border border-nx-border bg-nx-surface p-6">
                  <h3 className="font-semibold">
                    <span aria-hidden="true" className="mr-2 text-nx-error">
                      ✕
                    </span>
                    {item.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{item.explicacao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RISCO ZERO — exatamente o que a conta nova ganha, com os números do código. */}
        <section id="preco" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">Risco zero</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Comece sem pagar nada: o Atendente e a Onda, por nossa conta
              </h2>
              <p className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="whitespace-nowrap text-7xl font-bold tracking-tight">R$ 97</span>
                <span className="text-nx-secondary">/mês com tudo, depois do período por nossa conta</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-nx-secondary">
                A primeira semana do Atendente é por nossa conta: {SEMANA_GRATIS_DIAS} dias ou{" "}
                {SEMANA_GRATIS_CONVERSAS} conversas, o que vier primeiro, a partir de quando você ligar. A
                primeira Onda também: até {TAMANHO_DA_ONDA} mensagens prontas para mandar do seu WhatsApp em até{" "}
                {DIAS_DA_PRIMEIRA_ONDA} dias — não pedimos cartão para começar. No plano, o Atendente atende até{" "}
                {TETO_CONVERSAS_MES} conversas por mês e entra no expediente depois de {MINUTOS_SEM_RESPOSTA}{" "}
                minutos sem resposta, se você quiser.
              </p>
              <p className="mt-4 max-w-md rounded-lg border border-nx-gold/30 bg-nx-gold/5 p-4 text-sm leading-relaxed text-nx-secondary">
                <strong className="font-semibold text-nx-primary">
                  Garantia Dinheiro Recuperado.
                </strong>{" "}
                Se em {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas e o
                dinheiro que voltou não chegar a {emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o
                que você pagou. Vale uma vez por negócio, para lista com pelo menos{" "}
                {MIN_SUMIDOS} clientes sumidos; as regras completas estão nos{" "}
                <Link href="/termos" className="underline underline-offset-4">
                  Termos de Uso
                </Link>
                .
              </p>
              <CtaLink href="/cadastro" ctaName="preco" className={`${BOTAO_DOURADO} mt-9 px-7 py-4`}>
                Começar grátis <span aria-hidden="true">→</span>
              </CtaLink>
            </div>
            <ul className="rounded-xl border border-nx-border bg-nx-surface px-6">
              {INCLUI.map((item) => (
                <li
                  key={item}
                  className="flex gap-4 border-b border-nx-border py-4 text-[15px] leading-relaxed last:border-b-0"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-nx-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">
              Perguntas de quem está chegando
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {PERGUNTAS_FREQUENTES.map((p) => (
                <div key={p.pergunta} className="rounded-xl border border-nx-border bg-nx-surface p-6">
                  <h3 className="font-semibold">{p.pergunta}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.resposta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 pt-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-nx-gold/30 bg-nx-surface p-8 text-center sm:p-12">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Responda primeiro. Traga de volta quem sumiu.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Crie sua conta em 15 segundos, sem cartão de crédito. Teste o Atendente com os seus dados, ligue no
              seu WhatsApp e mande a primeira Onda. Você só paga se quiser continuar.
            </p>
            <CtaLink href="/cadastro" ctaName="final" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-lg`}>
              Começar grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* No celular o botão nunca sai da tela — veio da Nexora antiga. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="mobile_sticky" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Começar grátis <span aria-hidden="true">→</span>
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
