import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
import { classificar, NOME_DA_ESTEIRA } from "@/lib/recuperacao/esteiras";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { mensagemDoToque, TOTAL_TOQUES } from "@/lib/recuperacao/toques";

export const metadata: Metadata = {
  title: "Nexora — ganhe dinheiro trazendo seus clientes sumidos de volta",
  description:
    "A Nexora descobre quais clientes pararam de voltar e te entrega a mensagem pronta para trazer cada um. Diagnóstico grátis, sem cartão.",
};

/**
 * A LANDING.
 *
 * O CTA principal não é "criar conta" — é o Diagnóstico. Prova de primeira
 * pessoa sobre a base DELE converte muito mais que promessa sobre o produto, e
 * é a única prova que a gente tem enquanto não existe depoimento.
 *
 * ---
 *
 * DIREÇÃO VISUAL (10/09/2026). Os anúncios da Meta rodaram em cima da Nexora
 * antiga (apps/app), e quem clica espera aquela cara: Geist, hero centralizado,
 * dourado com brilho. A página volta para aquele visual e para a ordem daquela
 * home — a dor, a conta, e onde os clientes aparecem. O conteúdo de baixo é o
 * desta base, porque é o que o código cumpre (tests/promessas-da-landing.test.ts).
 * As seções da antiga que prometiam o que não existe mais ficaram de fora.
 *
 * OFERTA (15/09/2026). Conta nova não tem mais o teste de 30 dias: é grátis para
 * descobrir e paga para recuperar, com a Garantia Dinheiro Recuperado no lugar do teste.
 * Todo número da garantia e dos planos sai das constantes do código.
 *
 * Desenho: docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md
 */

const SELOS = [
  "1ª Onda por nossa conta",
  "Sem cartão para começar",
  "Sem integração",
  "Funciona com planilha",
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

const PASSOS = [
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
  "A primeira Onda por nossa conta, sem cartão",
  `Garantia Dinheiro Recuperado de ${GARANTIA_DIAS} dias`,
  "Sua lista importada do jeito que ela estiver",
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
        {/* HERO — o texto da Nexora antiga. */}
        <section className="px-6 pb-12 pt-16 sm:pt-20">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              Seus clientes não avisam que estão indo embora.
              <br className="hidden sm:block" />{" "}
              <span className="text-nx-gold">Eles simplesmente param de voltar.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-nx-secondary sm:text-xl">
              A Nexora mostra quem parou de comprar, quanto dinheiro isso representa e a
              mensagem exata pra trazer cada um de volta.{" "}
              <strong className="text-nx-primary">A primeira Onda é por nossa conta</strong>, sem cartão.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <CtaLink href="/cadastro" ctaName="hero" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                Começar minha primeira Onda grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <a
                href="#calculadora"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Calcular quanto estou perdendo
              </a>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs text-nx-muted">
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
        </section>

        {/* A CONTA — vem antes da lista de propósito: quanto mais cedo o visitante
            põe os números dele, mais o problema vira problema DELE. */}
        <section id="calculadora" className="scroll-mt-20 px-6 pb-20 pt-4">
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
        <section className="px-6 pb-20">
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
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Como funciona</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PASSOS.map((p, i) => (
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
                É mais devagar de propósito.
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

        <section id="preco" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Primeira Onda grátis, depois R$ 97/mês</h2>
              <p className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="whitespace-nowrap text-7xl font-bold tracking-tight">R$ 97</span>
                <span className="text-nx-secondary">/mês a partir da segunda Onda</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-nx-secondary">
                O diagnóstico é grátis e a primeira Onda também: até {TAMANHO_DA_ONDA} mensagens
                prontas para mandar do seu WhatsApp em até {DIAS_DA_PRIMEIRA_ONDA} dias, antes de
                pagar qualquer coisa — não pedimos cartão para começar.
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
                Começar minha primeira Onda grátis <span aria-hidden="true">→</span>
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
              Chame de volta seus primeiros clientes esta semana, por nossa conta.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Crie sua conta em 15 segundos, sem cartão de crédito. Suba sua lista, receba a
              primeira Onda pronta e mande do seu WhatsApp. Você só paga se quiser a próxima.
            </p>
            <CtaLink href="/cadastro" ctaName="final" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-lg`}>
              Começar minha primeira Onda grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* No celular o botão nunca sai da tela — veio da Nexora antiga. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="mobile_sticky" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Começar minha primeira Onda grátis <span aria-hidden="true">→</span>
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
