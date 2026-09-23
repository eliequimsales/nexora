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
  description: `Cada cobrança aparece depois de uma prova tirada da sua lista: a primeira Onda é por nossa conta, o plano é ${emReais(PRECO_MENSAL_CENTS)} por mês com a Garantia Dinheiro Recuperado, e nunca cobramos por mensagem, por cliente na lista nem porcentagem do que voltou.`,
};

/**
 * A PÁGINA DE PREÇOS — A ESTEIRA, NÃO UMA TABELA.
 *
 * Desenho da arquitetura comercial aprovada pelo fundador (21/09/2026): três
 * degraus custam zero, o primeiro real é pedido depois que a lista do dono já
 * trabalhou, e o degrau de cima só aparece quando o dado pedir. A página
 * inteira é construída em volta disso: a linha da esteira fica cinza enquanto é
 * de graça e vira dourada no passo em que entra dinheiro.
 *
 * Na entrada (anúncio e landing) a oferta é uma só. Esta página existe para
 * quem foi procurar preço: mora no rodapé e na seção da oferta da home.
 *
 * O que o documento pede e o código NÃO cumpre, e por isso não está aqui:
 *   - o limite de 3 profissionais nasce junto com o Completo. Hoje o produto
 *     não limita, e a página diz isso em vez de anunciar uma trava que não
 *     existe;
 *   - o Completo não tem Price, nem plano em PLANOS: aparece como destino, com
 *     o preço decidido e sem nenhum botão;
 *   - a implantação some quando STRIPE_IMPLANTACAO_PRICE_ID não está
 *     configurado, porque aí ela não entra no checkout;
 *   - "várias unidades" fica fora, como o próprio documento manda, até existir
 *     o primeiro cliente assim;
 *   - preço de concorrente não entra: envelhece sem ninguém avisar.
 *
 * Gerada a cada acesso (noStore): a implantação depende de variável do
 * servidor, que o build do Docker não enxerga.
 */

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

/** `parede` é o passo em que entra dinheiro pela primeira vez: o único cheio de ouro. */
type Passo = { titulo: string; corpo: string; valor: string; pago?: boolean; parede?: boolean };

/** O caminho do dinheiro. Os três primeiros custam zero — é o argumento da página. */
function esteira(comImplantacao: boolean): Passo[] {
  return [
    {
      titulo: "Você traz sua lista",
      corpo: "Do jeito que ela estiver: planilha, lista de contatos ou caderno digitado. Ninguém pede cartão.",
      valor: "R$ 0",
    },
    {
      titulo: "Vê quem parou de voltar",
      corpo:
        "Cada cliente no ritmo dele — quem vinha toda semana e sumiu há um mês está mais atrasado que quem vinha de três em três meses.",
      valor: "R$ 0",
    },
    {
      titulo: "Manda a primeira Onda",
      corpo: `${TAMANHO_DA_ONDA} mensagens prontas, em até ${DIAS_DA_PRIMEIRA_ONDA} dias, do seu WhatsApp. A primeira resposta de um cliente sumido é onde a Nexora deixa de ser promessa.`,
      valor: "R$ 0",
    },
    {
      titulo: "A parede, com prova e garantia",
      corpo:
        "Na segunda Onda, a tela mostra o que a primeira fez e a próxima que já está pronta. É aqui, e só aqui, que aparece a cobrança.",
      valor: `${emReais(PRECO_MENSAL_CENTS)}/mês`,
      pago: true,
      parede: true,
    },
    ...(comImplantacao
      ? [
          {
            titulo: "No pagamento, a implantação",
            corpo:
              "Uma caixinha opcional na tela da Stripe: deixamos sua agenda pronta e montamos as próximas Ondas com você. Valor único — a mensalidade continua a mesma.",
            valor: `+ ${emReais(PRECO_IMPLANTACAO_CENTS)}, uma vez`,
            pago: true,
          },
        ]
      : []),
    {
      titulo: "Os degraus, quando o dado pedir",
      corpo: `A equipe crescendo, o Atendente batendo no teto, o recuperado passando de ${ONDAS_MINIMAS} mensalidades. Cada um abre uma porta — para o Completo ou para o anual.`,
      valor: `+ ${emReais(PRECO_COMPLETO_CENTS - PRECO_MENSAL_CENTS)}/mês`,
      pago: true,
    },
  ];
}

const PLANO_DA_ENTRADA = {
  rotulo: "a entrada",
  nome: "Nexora",
  valor: emReais(PRECO_MENSAL_CENTS),
  itens: [
    `A Onda da semana: ${TAMANHO_DA_ONDA} mensagens prontas, com o porquê de cada cliente`,
    "Dinheiro recuperado, com a prova de cada retorno",
    "Agenda com link próprio, grade da equipe e lembrete de confirmação",
    `Atendente Virtual no WhatsApp, até ${TETO_CONVERSAS_MES} conversas por mês`,
    "Clientes na lista sem limite",
    `Garantia Dinheiro Recuperado de ${GARANTIA_DIAS} dias na primeira contratação`,
  ],
  pagamento: `${PLANOS.pix_30_dias.dias} dias no Pix: ${emReais(PLANOS.pix_30_dias.valorCents)}, sem renovação automática. Anual à vista: ${emReais(PRECO_ANUAL_CENTS)} — paga 10 meses, usa 12.`,
};

const PLANO_DO_DEGRAU = {
  rotulo: "chega junto com o Plantão",
  nome: "Nexora Completo",
  valor: emReais(PRECO_COMPLETO_CENTS),
  itens: [
    "Tudo do Nexora",
    "Atendente Virtual sem teto de conversas",
    "Profissionais sem limite na agenda",
    "Primeiro da fila no suporte",
  ],
  aviso:
    "Preço decidido, ainda não está à venda: ninguém pode contratá-lo hoje. Ele nasce no dia em que o Plantão sem teto existir — e, até lá, o painel não vende o que não entrega.",
};

/** O que separa os planos, e o que nunca vai separar. Cada "nunca" com o motivo. */
const LIMITES = [
  {
    eixo: "Profissionais",
    decisao: "Limita",
    limita: true,
    porque:
      "Cresce junto com o faturamento do negócio e é difícil de burlar: cada profissional é uma coluna na agenda.",
  },
  {
    eixo: "Clientes na lista",
    decisao: "Nunca",
    limita: false,
    porque:
      "A lista é o que faz a recuperação funcionar. Cobrar por cliente ensinaria você a importar menos — e a recuperar menos.",
  },
  {
    eixo: "Mensagens ou Ondas",
    decisao: "Nunca",
    limita: false,
    porque:
      "A Onda é pequena para proteger o seu número, não para vender pacote. Cobrar por mensagem puxaria a conversa para quanto dá para mandar; a Nexora vende o contrário: poucas, certas.",
  },
  {
    eixo: "% do dinheiro recuperado",
    decisao: "Nunca",
    limita: false,
    porque:
      "O Dinheiro recuperado depende de você marcar quem voltou. Cobrando porcentagem, você pararia de marcar — e a prova que sustenta a renovação apodreceria.",
  },
];

const PORQUES = [
  {
    titulo: `Por que ${emReais(PRECO_MENSAL_CENTS)}`,
    corpo:
      "A mensalidade precisa caber em dois atendimentos. Num corte de R$ 45, dois clientes voltando já pagam o mês; num ticket de clínica, meio cliente paga. Preço de entrada que exige quatro retornos para se justificar vira dúvida todo mês — e dúvida todo mês vira cancelamento.",
  },
  {
    titulo: "Por que o degrau custa o dobro",
    corpo:
      "Porque subir precisa ser decisão, não dúvida. E a comparação que você faz não é com outro software: é com alguém atendendo o WhatsApp de madrugada, que custa mais de um salário por mês e ainda dorme.",
  },
];

export default function Precos() {
  noStore();
  const temImplantacao = precoDaImplantacao(process.env) !== null;
  const passos = esteira(temImplantacao);

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
        {/* O NÚMERO QUE A PESSOA VEIO BUSCAR, E A TESE AO LADO DELE. */}
        <section className="border-b border-nx-border px-6 py-16 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            <div>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight [text-wrap:balance] sm:text-5xl">
                Uma porta grátis, um preço, um degrau.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-nx-secondary">
                A Nexora não vende uma tabela. Vende um caminho em que cada cobrança aparece depois de uma
                prova — e a prova sai da sua própria lista de clientes.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <CtaLink href="/cadastro" ctaName="precos_hero" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                  Começar grátis <span aria-hidden="true">→</span>
                </CtaLink>
                <Link href="/#como-funciona" className="text-sm font-semibold text-nx-secondary hover:text-nx-primary">
                  Ver como a recuperação funciona
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-nx-gold/30 bg-nx-surface p-7 shadow-nx-panel">
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight tabular-nums">
                  {emReais(PRECO_MENSAL_CENTS)}
                </span>
                <span className="text-nx-secondary">/mês</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-nx-secondary">
                Um plano só, com tudo dentro. A primeira Onda vem antes dele e é por nossa conta — até{" "}
                {TAMANHO_DA_ONDA} mensagens em até {DIAS_DA_PRIMEIRA_ONDA} dias, sem cartão.
              </p>
              <p className="mt-4 border-t border-nx-border pt-4 text-sm text-nx-secondary">
                Não recuperou em {GARANTIA_DIAS} dias? Devolvemos.
              </p>
            </div>
          </div>
        </section>

        {/* A ESTEIRA — a linha só fica dourada onde entra dinheiro. */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Onde entra o primeiro real</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-nx-secondary">
              Três etapas custam zero. O primeiro real só é pedido depois que a sua lista já trabalhou.
            </p>

            <ol className="mt-12">
              {passos.map((passo, i) => (
                <li key={passo.titulo} className="relative grid grid-cols-[auto_1fr] gap-x-5 pb-10 last:pb-0">
                  {/* A linha da esteira, com a cor do dinheiro a partir da parede. */}
                  {i < passos.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[11px] top-6 h-full w-px ${
                        passo.pago ? "bg-nx-gold/30" : "bg-nx-border-2"
                      }`}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      passo.parede
                        ? "bg-nx-gold text-nx-bg shadow-nx-glow-sm"
                        : passo.pago
                          ? "border border-nx-gold/50 bg-nx-bg text-nx-gold"
                          : "border border-nx-border-2 bg-nx-surface text-nx-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold">{passo.titulo}</h3>
                      <p className="mt-1.5 max-w-xl leading-relaxed text-nx-secondary">{passo.corpo}</p>
                    </div>
                    <span
                      className={`shrink-0 tabular-nums ${
                        passo.parede
                          ? "text-xl font-bold text-nx-gold"
                          : passo.pago
                            ? "text-sm font-semibold text-nx-gold/70"
                            : "text-sm font-medium text-nx-muted"
                      }`}
                    >
                      {passo.valor}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* OS DOIS PLANOS — um para contratar, um para onde subir. */}
        <section id="planos" className="scroll-mt-20 border-y border-nx-border bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Dois planos, um só lugar para subir</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-nx-secondary">
              Na entrada, a oferta é uma só. O Completo é o destino de todos os gatilhos — e o painel avisa
              com o seu número na tela, não com banner.
            </p>

            <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-nx-gold/40 bg-nx-surface p-7 shadow-nx-panel">
                <p className="text-sm font-medium text-nx-gold">{PLANO_DA_ENTRADA.rotulo}</p>
                <h3 className="mt-2 text-2xl font-bold">{PLANO_DA_ENTRADA.nome}</h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight tabular-nums">{PLANO_DA_ENTRADA.valor}</span>
                  <span className="text-nx-secondary">/mês</span>
                </p>
                <ul className="mt-7 grid gap-3 border-t border-nx-border pt-7">
                  {PLANO_DA_ENTRADA.itens.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-nx-secondary">
                      <span aria-hidden="true" className="mt-1 text-nx-success">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <CtaLink href="/cadastro" ctaName="precos_plano" className={`${BOTAO_DOURADO} mt-7 w-full px-6 py-3.5`}>
                  Começar grátis <span aria-hidden="true">→</span>
                </CtaLink>
                <p className="mt-4 text-sm leading-relaxed text-nx-muted">{PLANO_DA_ENTRADA.pagamento}</p>
              </div>

              <div className="rounded-2xl border border-dashed border-nx-border-2 bg-nx-bg/40 p-7">
                <p className="text-sm font-medium text-nx-muted">{PLANO_DO_DEGRAU.rotulo}</p>
                <h3 className="mt-2 text-2xl font-bold text-nx-secondary">{PLANO_DO_DEGRAU.nome}</h3>
                <p className="mt-4 flex items-baseline gap-2 text-nx-secondary">
                  <span className="text-5xl font-bold tracking-tight tabular-nums">{PLANO_DO_DEGRAU.valor}</span>
                  <span>/mês</span>
                </p>
                <ul className="mt-7 grid gap-3 border-t border-nx-border pt-7">
                  {PLANO_DO_DEGRAU.itens.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-nx-muted">
                      <span aria-hidden="true" className="mt-1">
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-7 rounded-lg border border-nx-border bg-nx-surface/60 p-4 text-sm leading-relaxed text-nx-secondary">
                  {PLANO_DO_DEGRAU.aviso}
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-3xl leading-relaxed text-nx-secondary">
              Hoje a Nexora não limita profissionais: o limite de 3 passa a valer para contas novas quando o
              Completo existir, e quem já assina mantém o que tem.
            </p>
          </div>
        </section>

        {/* LIMITES — o que separa os planos, e o que nunca vai separar. */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              O que separa os planos — e o que nunca vai separar
            </h2>
            <table className="mt-10 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-nx-border-2 text-sm text-nx-muted">
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Eixo
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Decisão
                  </th>
                  <th scope="col" className="hidden py-3 font-medium sm:table-cell">
                    Por quê
                  </th>
                </tr>
              </thead>
              <tbody>
                {LIMITES.map((linha) => (
                  <tr key={linha.eixo} className="border-b border-nx-border align-top">
                    <th scope="row" className="py-5 pr-4 font-semibold">
                      {linha.eixo}
                      <span className="mt-2 block text-sm font-normal leading-relaxed text-nx-secondary sm:hidden">
                        {linha.porque}
                      </span>
                    </th>
                    <td className="py-5 pr-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          linha.limita
                            ? "bg-nx-gold/15 text-nx-gold"
                            : "bg-nx-success-muted text-nx-success"
                        }`}
                      >
                        {linha.decisao}
                      </span>
                    </td>
                    <td className="hidden py-5 leading-relaxed text-nx-secondary sm:table-cell">{linha.porque}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* OS PORQUÊS — argumento em prosa, sem cartão nenhum. */}
        <section className="border-y border-nx-border bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-2">
            {PORQUES.map((p) => (
              <div key={p.titulo}>
                <h2 className="text-xl font-bold">{p.titulo}</h2>
                <p className="mt-3 leading-relaxed text-nx-secondary">{p.corpo}</p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <h2 className="text-xl font-bold">A agenda não se vende. Ela alimenta.</h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-nx-secondary">
                Agenda com link e confirmação é commodity: existe de graça por aí. E ela é o combustível da
                recuperação — cada horário atendido vira visita, e é a visita que mantém o ritmo de cada
                cliente atualizado. Por isso a agenda entra no preço, e nunca como um a mais no checkout.
                Quem já usa outra continua nela e só importa a lista.
              </p>
            </div>
          </div>
        </section>

        {temImplantacao && (
          <section className="px-6 py-20">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">No pagamento, uma caixinha só</h2>
              <p className="mt-4 leading-relaxed text-nx-secondary">
                A implantação é a única coisa que sobe o primeiro pagamento — e ela não mexe na mensalidade
                que você revê todo mês.
              </p>
              <div className="mt-8 rounded-xl border border-nx-border bg-nx-surface p-6">
                <div className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-nx-gold/60 text-[11px] font-bold text-nx-gold"
                  >
                    ✓
                  </span>
                  <div>
                    <p className="flex flex-wrap items-baseline justify-between gap-x-4 font-semibold">
                      Implantação feita por nós
                      <span className="tabular-nums text-nx-gold">
                        {emReais(PRECO_IMPLANTACAO_CENTS)}, uma vez
                      </span>
                    </p>
                    <p className="mt-2 leading-relaxed text-nx-secondary">
                      Numa chamada de até {MINUTOS_DA_CHAMADA} minutos deixamos sua agenda pronta, conferimos
                      a lista e montamos as próximas Ondas com você.
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-nx-muted">
                São {VAGAS_POR_SEMANA} vagas por semana, de verdade: lotou, a caixinha some da tela. Se não
                acontecer em {PRAZO_DA_IMPLANTACAO_DIAS} dias por falta de horário nosso, devolvemos o valor.
              </p>
            </div>
          </section>
        )}

        {/* A GARANTIA — a reversão de risco, com as condições à vista. */}
        <section className="border-y border-nx-border bg-nx-surface-2/30 px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Garantia Dinheiro Recuperado</h2>
            <p className="mt-5 text-lg leading-relaxed text-nx-secondary">
              Se em {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas, marcar quem
              voltou e o dinheiro que voltou não chegar a {emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o
              que você pagou.
            </p>
            <p className="mt-4 leading-relaxed text-nx-muted">
              Vale uma vez por negócio, para lista com pelo menos {MIN_SUMIDOS} clientes sumidos. As regras
              completas estão nos{" "}
              <Link href="/termos" className="underline underline-offset-4 hover:text-nx-secondary">
                Termos de Uso
              </Link>
              .
            </p>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Sobre o dinheiro</h2>
            <dl className="mt-10">
              {PERGUNTAS_DOS_PRECOS.map((p) => (
                <div key={p.pergunta} className="border-t border-nx-border py-6 last:border-b">
                  <dt className="font-semibold">{p.pergunta}</dt>
                  <dd className="mt-2 leading-relaxed text-nx-secondary">{p.resposta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl border-t border-nx-border pt-14 text-center">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Comece pela primeira Onda, por nossa conta.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Traga sua lista, veja quem parou de voltar e mande as primeiras {TAMANHO_DA_ONDA} mensagens.
              Você decide o resto com as respostas na tela.
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
