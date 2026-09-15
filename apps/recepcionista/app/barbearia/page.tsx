import type { Metadata } from "next";
import Link from "next/link";
import { Calculadora } from "@/components/calculadora";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
import { MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

export const metadata: Metadata = {
  title: "Nexora para barbearia — traga de volta o cliente que parou de vir",
  description:
    "Para barbearia: descubra quais clientes pararam de voltar e receba toda segunda a mensagem pronta para chamar cada um. Diagnóstico grátis, sem cartão.",
};

/**
 * A PÁGINA DA BARBEARIA.
 *
 * Mesma cara da home, com a conversa do barbeiro. Página de nicho é onde a
 * tentação de inventar prova social é maior — "mais de N barbearias usam",
 * depoimento de barbeiro que não existe. Esta usa o que o produto tem: o ritmo de
 * referência de barbearia que o motor aplica, a conta com os números dele e a
 * mesma oferta e as mesmas respostas da home (lib/perguntas.ts).
 *
 * A calculadora recebe o ramo e o botão leva o ramo ao diagnóstico: a conta que
 * aparece aqui é a mesma que o diagnóstico vai repetir com a lista dele.
 */

const RAMO = "barbearia";
const RITMO_DA_BARBEARIA = MEDIANA_POR_SEGMENTO.barbearia;
const DIAGNOSTICO = "/diagnostico?ramo=barbearia";

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

const PASSOS = [
  {
    titulo: "Você manda a lista de clientes da barbearia",
    corpo:
      "Do jeito que ela estiver: planilha, lista de contatos ou caderno digitado. A Nexora diz em português o que não conseguiu ler.",
  },
  {
    titulo: "Ela acha o ritmo de cada cliente",
    corpo: `Tem quem corta a cada duas semanas e quem aparece de mês em mês. Para quem tem poucas visitas anotadas, a conta usa o ritmo de referência de barbearia, de ${RITMO_DA_BARBEARIA} dias, e avisa que é palpite.`,
  },
  {
    titulo: "Toda segunda, a mensagem pronta",
    corpo: `${TAMANHO_DA_ONDA} clientes que passaram do próprio ritmo, com a mensagem escrita para cada um. Você lê e manda do WhatsApp da barbearia.`,
  },
];

export default function PaginaBarbearia() {
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
            <Link href={DIAGNOSTICO} className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Ver meus clientes <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-6 pb-12 pt-16 sm:pt-20">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              Para barbearia
            </p>
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Barbeiro: seu cliente não avisa quando para de vir.
              <br className="hidden sm:block" />{" "}
              <span className="text-nx-gold">Ele simplesmente some da agenda.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-nx-secondary sm:text-xl">
              A Nexora lê a lista de clientes da sua barbearia, descobre de quanto em quanto
              tempo cada um costuma voltar e mostra quem passou do ritmo, com a mensagem pronta
              para chamar de volta.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Link href={DIAGNOSTICO} className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                Ver quem sumiu da minha barbearia <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#calculadora"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Calcular quanto estou perdendo
              </a>
            </div>
          </div>
        </section>

        <section id="calculadora" className="scroll-mt-20 px-6 pb-20 pt-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold leading-tight sm:text-4xl">
              Quanto dinheiro está parado na lista da sua barbearia?
            </h2>
            <p className="mx-auto mb-10 mt-4 max-w-xl text-center text-nx-muted">
              Três números seus. A conta usa o ritmo de referência de barbearia, de{" "}
              {RITMO_DA_BARBEARIA} dias.
            </p>
            <Calculadora ramo="barbearia" />
          </div>
        </section>

        <section className="bg-nx-surface-2/30 px-6 py-20">
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

        <section id="preco" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Quanto custa</h2>
            <p className="mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-nx-secondary">
              {emReais(PRECO_MENSAL_CENTS)} por mês no cartão, ou{" "}
              {emReais(PLANOS.pix_30_dias.valorCents)} por {PLANOS.pix_30_dias.dias} dias no Pix,
              sem renovação automática, ou {emReais(PRECO_ANUAL_CENTS)} por 12 meses. O
              diagnóstico é grátis e não pede cartão.
            </p>
            <p className="mx-auto mt-6 max-w-2xl rounded-lg border border-nx-gold/30 bg-nx-gold/5 p-5 text-sm leading-relaxed text-nx-secondary">
              <strong className="font-semibold text-nx-primary">
                Garantia Dinheiro Recuperado.
              </strong>{" "}
              Se em {GARANTIA_DIAS} dias você mandar as mensagens de {ONDAS_MINIMAS} ondas e o
              dinheiro que voltou não chegar a {emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que
              você pagou. Vale uma vez por negócio, para lista com pelo menos {MIN_SUMIDOS}{" "}
              clientes sumidos; as regras completas estão nos{" "}
              <Link href="/termos" className="underline underline-offset-4">
                Termos de Uso
              </Link>
              .
            </p>
            <div className="mt-9 text-center">
              <Link href={DIAGNOSTICO} className={`${BOTAO_DOURADO} px-7 py-4`}>
                Começar pelo diagnóstico grátis <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Perguntas de barbeiro</h2>
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
      </main>

      <RodapeFunil />

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <Link href={DIAGNOSTICO} className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Ver quem sumiu da minha {RAMO} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </TemaNexora>
  );
}
