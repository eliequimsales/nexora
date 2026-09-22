import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { TETO_CONVERSAS_MES } from "@/lib/atendente/constantes";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import {
  MINUTOS_DA_CHAMADA,
  PRAZO_DA_IMPLANTACAO_DIAS,
  precoDaImplantacao,
  VAGAS_POR_SEMANA,
} from "@/lib/billing/implantacao";
import { PLANOS } from "@/lib/billing/planos";
import {
  emReais,
  PRECO_ANUAL_CENTS,
  PRECO_COMPLETO_CENTS,
  PRECO_IMPLANTACAO_CENTS,
  PRECO_MENSAL_CENTS,
} from "@/lib/billing/preco";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import { PERGUNTAS_DOS_PRECOS } from "@/lib/perguntas";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

export const metadata: Metadata = {
  title: "Preços da Nexora — a primeira Onda é por nossa conta, depois um preço só",
  description:
    "A primeira Onda é por nossa conta, sem cartão. Depois, um plano só, com a Garantia Dinheiro Recuperado. Nunca cobramos por mensagem, por cliente na lista nem porcentagem do que voltou.",
};

/**
 * A PÁGINA DE PREÇOS — A ESTEIRA EM UMA TELA.
 *
 * A arquitetura comercial aprovada pelo fundador (21/09/2026) diz que a entrada
 * mostra UMA oferta; a tabela existe para quem foi procurar. Por isso esta
 * página mora no rodapé e na seção da oferta da home, nunca no topo.
 *
 * Cada real aparece depois de uma prova: lista, diagnóstico e primeira Onda
 * custam zero, e a cobrança entra quando a primeira Onda já trabalhou.
 *
 * O que esta página NÃO faz, porque o código não faz:
 *   - não vende o Nexora Completo: não existe Price, nem plano, nem limite de
 *     profissionais no produto. Ele aparece como destino, com o preço decidido e
 *     a frase de que ainda não está à venda;
 *   - não anuncia a implantação quando o Price dela não está configurado — ela
 *     simplesmente não aparece no checkout, e prometer seria mentir no pagamento;
 *   - não promete Pix na assinatura mensal: no Brasil a Stripe só faz Pix avulso.
 *
 * Gerada a cada acesso (noStore): a implantação depende de variável do servidor,
 * que o build do Docker não enxerga.
 */

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

const CARTAO = "rounded-xl border border-nx-border bg-nx-surface p-6";

/** A esteira: três degraus de graça, e o primeiro real com a prova na tela. */
const ESTEIRA = [
  {
    titulo: "Traga sua lista",
    corpo: "Do jeito que ela estiver: planilha, lista de contatos ou caderno digitado.",
    preco: "R$ 0",
  },
  {
    titulo: "Veja quem parou de voltar",
    corpo: "Cada cliente no ritmo dele, com quanto costumava gastar no seu negócio.",
    preco: "R$ 0",
  },
  {
    titulo: "Mande a primeira Onda",
    corpo: `Até ${TAMANHO_DA_ONDA} mensagens prontas, em até ${DIAS_DA_PRIMEIRA_ONDA} dias, do seu WhatsApp.`,
    preco: "R$ 0",
  },
  {
    titulo: "Continue, se valer a pena",
    corpo: "A cobrança aparece na segunda Onda, com as respostas da primeira na tela.",
    preco: `${emReais(PRECO_MENSAL_CENTS)}/mês`,
  },
];

const INCLUI = [
  `A Onda da semana: ${TAMANHO_DA_ONDA} mensagens prontas, escritas para cada cliente`,
  "Dinheiro recuperado, com o nome de quem voltou e o que gastou",
  "Agenda com link próprio e a grade da equipe",
  `Atendente Virtual no seu WhatsApp, até ${TETO_CONVERSAS_MES} conversas por mês`,
  "Clientes na lista: sem limite",
  `Garantia Dinheiro Recuperado de ${GARANTIA_DIAS} dias na primeira contratação`,
  "Cancelamento pelo painel, sem falar com ninguém",
];

const JEITOS_DE_PAGAR = [
  {
    titulo: "Mensal no cartão",
    valor: `${emReais(PLANOS.mensal_cartao.valorCents)}/mês`,
    corpo: "Renova sozinho. Você cancela pelo painel e fica com o período que já pagou.",
  },
  {
    titulo: `${PLANOS.pix_30_dias.dias} dias no Pix`,
    valor: emReais(PLANOS.pix_30_dias.valorCents),
    corpo: "Pagamento avulso, sem renovação automática: acaba e você decide de novo.",
  },
  {
    titulo: "Anual à vista",
    valor: emReais(PRECO_ANUAL_CENTS),
    corpo: "Paga 10 meses e usa 12. Sem renovação automática — no fim do ano você escolhe outra vez.",
  },
];

/** O que nunca vira linha na fatura — e o motivo de cada um. */
const NUNCA_COBRAMOS = [
  {
    titulo: "Por mensagem enviada",
    corpo: `A Onda é de ${TAMANHO_DA_ONDA} por semana para proteger o seu número, não para vender pacote. Segurança não é produto.`,
  },
  {
    titulo: "Por cliente na lista",
    corpo: "A lista é o que faz a recuperação funcionar. Cobrar por ela ensinaria você a importar menos — e a recuperar menos.",
  },
  {
    titulo: "Porcentagem do que voltou",
    corpo: "Você marcaria menos retornos para pagar menos, e a prova que sustenta a renovação apodreceria.",
  },
  {
    titulo: "A agenda à parte",
    corpo: "Ela entra no preço: cada horário marcado ensina a Nexora quando aquele cliente costuma sumir.",
  },
];

/** O degrau. Sem Price, sem plano e sem limite no produto: aparece, não se vende. */
const O_COMPLETO = [
  "Atendente Virtual sem teto de conversas",
  "Profissionais sem limite na agenda",
  "Primeiro da fila no suporte",
];

export default function Precos() {
  noStore();
  const temImplantacao = precoDaImplantacao(process.env) !== null;

  return (
    <TemaNexora>
      <TrackViewContent name="Precos" />
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
            <CtaLink href="/cadastro" ctaName="precos_header" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Começar grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </div>
      </header>

      <main>
        <section className="px-6 pb-14 pt-16 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">Preços</p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight [text-wrap:balance] sm:text-5xl">
              Uma porta grátis, um preço, um degrau.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-nx-secondary">
              Você não paga para descobrir quem sumiu. A primeira Onda é por nossa conta — até{" "}
              {TAMANHO_DA_ONDA} mensagens em até {DIAS_DA_PRIMEIRA_ONDA} dias. A cobrança só aparece
              depois dela, com as respostas na tela.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <CtaLink href="/cadastro" ctaName="precos_hero" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                Começar grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <Link
                href="/#como-funciona"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Ver como a recuperação funciona
              </Link>
            </div>
          </div>
        </section>

        {/* A ESTEIRA — onde cada real entra, e depois de qual prova. */}
        <section className="bg-nx-surface-2/30 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Onde entra o primeiro real</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {ESTEIRA.map((passo, i) => (
                <li key={passo.titulo} className={CARTAO}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">
                      {i + 1}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        passo.preco === "R$ 0" ? "text-nx-success" : "text-nx-gold"
                      }`}
                    >
                      {passo.preco}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold leading-snug">{passo.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{passo.corpo}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* O PLANO — um só, com tudo dentro. */}
        <section id="o-plano" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">O plano</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Nexora</h2>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="whitespace-nowrap text-6xl font-bold tracking-tight">
                  {emReais(PRECO_MENSAL_CENTS)}
                </span>
                <span className="text-nx-secondary">/mês, depois da primeira Onda</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-nx-secondary">
                Recuperação, agenda e Atendente Virtual no mesmo preço. Sem taxa de setup obrigatória, sem
                fidelidade e sem falar com vendedor.
              </p>
              <CtaLink href="/cadastro" ctaName="precos_plano" className={`${BOTAO_DOURADO} mt-8 px-7 py-4`}>
                Começar grátis <span aria-hidden="true">→</span>
              </CtaLink>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-nx-muted">
                A primeira Onda não pede cartão. Você só escolhe como pagar quando ela já tiver trabalhado.
              </p>
            </div>

            <div className="rounded-2xl border border-nx-gold/30 bg-nx-surface p-6 shadow-nx-panel sm:p-8">
              <p className="text-sm font-semibold text-nx-primary">O que está dentro</p>
              <ul className="mt-4 grid gap-3">
                {INCLUI.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-nx-secondary">
                    <span aria-hidden="true" className="mt-0.5 text-nx-success">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* OS TRÊS JEITOS DE PAGAR — os mesmos que o checkout aceita. */}
        <section className="bg-nx-surface-2/30 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Três jeitos de pagar o mesmo plano</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {JEITOS_DE_PAGAR.map((jeito) => (
                <div key={jeito.titulo} className={CARTAO}>
                  <h3 className="font-semibold">{jeito.titulo}</h3>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{jeito.valor}</p>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{jeito.corpo}</p>
                </div>
              ))}
            </div>

            {temImplantacao && (
              <div className="mt-6 rounded-xl border border-nx-border bg-nx-surface p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Implantação feita por nós</h3>
                  <span className="font-mono text-sm font-semibold text-nx-gold">
                    {emReais(PRECO_IMPLANTACAO_CENTS)}, uma vez
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-nx-secondary">
                  Uma chamada de até {MINUTOS_DA_CHAMADA} minutos: deixamos a agenda pronta, conferimos a
                  sua lista e montamos as próximas Ondas com você. É item opcional no pagamento, com{" "}
                  {VAGAS_POR_SEMANA} vagas por semana — lotou, ela some da tela. Se não acontecer em{" "}
                  {PRAZO_DA_IMPLANTACAO_DIAS} dias por falta de horário nosso, devolvemos esse valor.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* A GARANTIA — a reversão de risco, com as condições à vista. */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border border-nx-gold/30 bg-nx-gold/5 p-8 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Garantia Dinheiro Recuperado</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-nx-secondary">
              Se em {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas, marcar quem
              voltou e o dinheiro que voltou não chegar a {emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o
              que você pagou. Vale uma vez por negócio, para lista com pelo menos {MIN_SUMIDOS} clientes
              sumidos; as regras completas estão nos{" "}
              <Link href="/termos" className="underline underline-offset-4">
                Termos de Uso
              </Link>
              .
            </p>
          </div>
        </section>

        {/* O QUE NUNCA COBRAMOS — cada "nunca" com o motivo. */}
        <section className="bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">O que nunca vamos cobrar</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-nx-secondary">
              Não é generosidade: cada uma dessas cobranças ensinaria você a usar a Nexora de um jeito que
              recupera menos.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {NUNCA_COBRAMOS.map((item) => (
                <div key={item.titulo} className={CARTAO}>
                  <h3 className="font-semibold">
                    <span aria-hidden="true" className="mr-2 text-nx-error">
                      ✕
                    </span>
                    {item.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{item.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O DEGRAU — existe no papel, e a página diz exatamente isso. */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-nx-border-2 bg-nx-surface/60 p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-2xl font-bold">Nexora Completo</h2>
              <span className="rounded-full border border-nx-border bg-nx-surface-2 px-3 py-1 text-xs font-medium text-nx-muted">
                ainda não está à venda
              </span>
            </div>
            <p className="mt-4 leading-relaxed text-nx-secondary">
              O degrau de quem cresceu: {emReais(PRECO_COMPLETO_CENTS)}/mês, preço já decidido. Ele só
              passa a existir quando estiver pronto de verdade — e até lá ninguém pode contratá-lo.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {O_COMPLETO.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-nx-muted">
                  · {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-nx-secondary">
              Hoje o Atendente Virtual já está no plano de {emReais(PRECO_MENSAL_CENTS)}, com teto de{" "}
              {TETO_CONVERSAS_MES} conversas por mês. Quando o teto começar a apertar, o painel avisa com o
              seu número de conversas na tela — não com um banner.
            </p>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20 px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Sobre o dinheiro</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {PERGUNTAS_DOS_PRECOS.map((p) => (
                <div key={p.pergunta} className={CARTAO}>
                  <h3 className="font-semibold">{p.pergunta}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.resposta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl rounded-2xl border border-nx-gold/30 bg-nx-surface p-8 text-center sm:p-12">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Comece pela primeira Onda, por nossa conta.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Traga sua lista, veja quem parou de voltar e mande as primeiras {TAMANHO_DA_ONDA} mensagens.
              Você decide o resto depois — com as respostas na tela.
            </p>
            <CtaLink href="/cadastro" ctaName="precos_final" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-lg`}>
              Começar grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </section>
      </main>

      <RodapeFunil />

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="precos_mobile_sticky" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Começar grátis <span aria-hidden="true">→</span>
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
