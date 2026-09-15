import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { TemaNexora } from "@/components/tema-nexora";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

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

const SELOS = ["Diagnóstico grátis", "Sem cartão", "Sem integração", "Funciona com planilha"];

/**
 * Exemplo, e a tela diz que é exemplo. Os ritmos são plausíveis para uma
 * barbearia; os nomes não são de ninguém.
 */
const ONDA_EXEMPLO = [
  { nome: "Marcos", ciclo: 28, dias: 64 },
  { nome: "Dona Cida", ciclo: 35, dias: 90 },
  { nome: "Júnior", ciclo: 21, dias: 45 },
];

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
            <Link href="/diagnostico" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Ver meus clientes <span aria-hidden="true">→</span>
            </Link>
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
              <span className="text-nx-gold">Eles só param de voltar.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-nx-secondary sm:text-xl">
              A Nexora mostra quem parou de comprar, quanto dinheiro isso representa e a
              mensagem exata pra trazer cada um de volta.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Link href="/diagnostico" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                Descobrir meus clientes <span aria-hidden="true">→</span>
              </Link>
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

        {/* ONDE ELES APARECEM — no lugar do painel de exemplo da antiga. */}
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
              E é aqui que esses clientes aparecem
            </h2>
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
                {ONDA_EXEMPLO.map((c) => (
                  <li
                    key={c.nome}
                    className="flex items-center justify-between gap-4 border-b border-nx-border py-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.nome}</p>
                      <p className="text-xs text-nx-secondary">
                        vinha a cada {c.ciclo} dias · sumiu há {c.dias}
                      </p>
                    </div>
                    {/* Etiqueta, não botão: numa lista de exemplo, nada finge ser clicável. */}
                    <span className="shrink-0 rounded-md border border-nx-gold/25 bg-nx-gold/10 px-3 py-1 text-xs font-semibold text-nx-gold">
                      Mandar
                    </span>
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

        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">
              Isso não é disparo em massa
            </h2>
            <div className="mt-8 grid gap-5 text-lg leading-relaxed text-nx-secondary">
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
          </div>
        </section>

        <section id="preco" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Um preço, sem pegadinha</h2>
              <p className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="whitespace-nowrap text-7xl font-bold tracking-tight">R$ 97</span>
                <span className="text-nx-secondary">/mês, impostos inclusos</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-nx-secondary">
                O diagnóstico é grátis e não pedimos cartão para começar. Sem cartão de
                crédito? {emReais(PLANOS.pix_30_dias.valorCents)} por {PLANOS.pix_30_dias.dias}{" "}
                dias no Pix, sem renovação automática, ou {emReais(PRECO_ANUAL_CENTS)} por 12
                meses à vista.
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
              <Link href="/diagnostico" className={`${BOTAO_DOURADO} mt-9 px-7 py-4`}>
                Começar pelo diagnóstico grátis <span aria-hidden="true">→</span>
              </Link>
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

        <section className="px-6 pb-24 pt-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-nx-gold/30 bg-nx-surface p-8 text-center sm:p-12">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Antes de decidir, veja o tamanho do buraco.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Cola a lista que você já tem e a Nexora te mostra, com nome e sobrenome, quem
              parou de voltar. Não precisa criar conta para ver, e a lista não fica com a
              gente.
            </p>
            <Link href="/diagnostico" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-lg`}>
              Ver quem sumiu da minha lista <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-nx-border px-6 pb-24 pt-10 sm:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-nx-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm">
            Nexora — recuperação de clientes inativos para pequenos negócios de serviço. A
            identificação completa de quem presta o serviço está nos Termos de Uso.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/termos" className="transition-colors hover:text-nx-primary">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="transition-colors hover:text-nx-primary">
              Privacidade
            </Link>
            <Link href="/login" className="transition-colors hover:text-nx-primary">
              Entrar
            </Link>
            <Link href="/diagnostico" className="transition-colors hover:text-nx-primary">
              Diagnóstico grátis
            </Link>
          </div>
        </div>
      </footer>

      {/* No celular o botão nunca sai da tela — veio da Nexora antiga. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <Link href="/diagnostico" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Descobrir meus clientes <span aria-hidden="true">→</span>
        </Link>
      </div>
    </TemaNexora>
  );
}
