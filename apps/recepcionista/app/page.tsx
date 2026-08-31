import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nexora — ganhe dinheiro trazendo seus clientes sumidos de volta",
  description:
    "A Nexora descobre quais clientes pararam de voltar e te entrega a mensagem pronta para trazer cada um. Primeiro mês grátis, sem cartão.",
};

/**
 * A LANDING.
 *
 * Ela vendia o Nexora Atendente — recepcionista de IA no WhatsApp, em verde, a
 * R$ 149 e R$ 349. O tráfego do Instagram fala de cliente sumido, em amarelo, a
 * R$ 97. Trilha de cheiro quebrada entre o anúncio e a página é onde a
 * conversão morre sem aparecer em métrica nenhuma: o visitante não se reconhece
 * e sai em dois segundos.
 *
 * O CTA principal não é "criar conta" — é o Diagnóstico. Prova de primeira
 * pessoa sobre a base DELE converte muito mais que promessa sobre o produto, e
 * é a única prova que a gente tem enquanto não existe depoimento.
 */

const CARDS_DEMO = [
  {
    nome: "Marcos Andrade",
    esteira: "Prestes a sumir",
    dias: 31,
    porque: "Vinha a cada 24 dias. Está 7 além do ritmo normal.",
    valor: "R$ 50",
  },
  {
    nome: "Juliana Prado",
    esteira: "Atrasado",
    dias: 58,
    porque: "Vinha a cada 21 dias. Está 37 além do ritmo normal.",
    valor: "R$ 120",
  },
  {
    nome: "Rafael Nunes",
    esteira: "Sumido há muito",
    dias: 143,
    porque: "Vinha a cada 26 dias. Está 117 além do ritmo normal.",
    valor: "R$ 65",
  },
];

const PASSOS = [
  {
    titulo: "Você manda sua lista do jeito que ela está",
    corpo:
      "Planilha do Excel, caderno digitado, conversa exportada do WhatsApp. A Nexora entende e diz em português o que não conseguiu ler.",
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
  "Primeiro mês grátis, sem pedir cartão",
  "Sua lista importada do jeito que ela estiver",
  "Doze mensagens prontas por semana, escritas para cada cliente",
  "Página de agendamento com seu link, para o cliente marcar sozinho",
  "O quanto você já recuperou, em reais, com nome de quem voltou",
  "Cancele quando quiser — você fica com o período que já pagou",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-night text-mist">
      <header className="sticky top-0 z-40 border-b border-night-line bg-night/85 backdrop-blur">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-display text-base font-bold text-night">
              N
            </span>
            <span className="font-display font-semibold">Nexora</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-mist/60 md:flex">
            <a href="#como-funciona" className="hover:text-mist">
              Como funciona
            </a>
            <a href="#preco" className="hover:text-mist">
              Preço
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm text-mist/70 hover:text-mist">
              Entrar
            </Link>
            <Link
              href="/diagnostico"
              className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-night transition hover:brightness-105"
            >
              Ver quem sumiu
            </Link>
          </div>
        </div>
      </header>

      {/* ATO 1 — o prejuízo que não faz barulho. */}
      <section className="mx-auto grid max-w-page items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber">
            Recuperação de clientes inativos
          </p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Sua agenda não está vazia. Sua base está parada.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist/70">
            Ninguém cancela nada. O cliente só vai espaçando — 20 dias, depois 40, depois
            some de vez. E como o movimento do dia continua, você não percebe. É o único
            prejuízo que não faz barulho.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/diagnostico"
              className="rounded-xl bg-amber px-7 py-4 text-center font-display font-bold text-night transition hover:brightness-105"
            >
              Descobrir quem sumiu da minha base
            </Link>
            <a
              href="#como-funciona"
              className="rounded-xl border border-night-line px-7 py-4 text-center text-sm text-mist/80 transition hover:border-amber/40"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-4 font-mono text-xs text-mist/40">
            De graça · sem cadastro · sua lista não é gravada
          </p>
        </div>

        {/* A demonstração é o produto de verdade: a Onda. */}
        <div className="rounded-2xl border border-night-line bg-night-soft/60 p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-display font-semibold">Onda de segunda</p>
            <span className="font-mono text-xs text-mist/40">12 clientes · ~9 min</span>
          </div>
          <div className="mt-4 grid gap-3">
            {CARDS_DEMO.map((c) => (
              <div key={c.nome} className="rounded-xl border border-night-line bg-night p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold">{c.nome}</span>
                  <span className="rounded-md bg-amber/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber">
                    {c.esteira}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-mist/55">{c.porque}</p>
                <div className="mt-3 flex items-center justify-between border-t border-night-line pt-3">
                  <span className="font-mono text-[11px] text-mist/40">
                    sem aparecer há {c.dias} dias · ticket {c.valor}
                  </span>
                  <span className="font-mono text-[11px] text-amber">copiar mensagem</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center font-mono text-[11px] text-mist/35">
            exemplo — a sua vem da sua própria lista
          </p>
        </div>
      </section>

      {/* ATO 2 — a conta que ele nunca fez. */}
      <section className="border-y border-night-line bg-night-soft/50">
        <div className="mx-auto max-w-page px-6 py-16">
          <p className="mx-auto max-w-3xl text-center font-display text-xl leading-relaxed sm:text-2xl">
            Faz a conta agora: quantos clientes te mandaram mensagem no ano passado e nunca
            mais voltaram? Multiplica pelo seu ticket médio.{" "}
            <span className="text-amber">Esse número já foi seu uma vez.</span>
          </p>
        </div>
      </section>

      {/* ATO 3 — o mecanismo. */}
      <section id="como-funciona" className="mx-auto max-w-page px-6 py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Como funciona
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {PASSOS.map((p, i) => (
            <div key={p.titulo}>
              <span className="font-mono text-xs text-amber">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist/65">{p.corpo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ATO 4 — separar do que ele já conhece e rejeita. */}
      <section className="border-t border-night-line bg-night-soft/40">
        <div className="mx-auto max-w-page px-6 py-20">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Isso não é disparo em massa
          </h2>
          <div className="mt-6 grid max-w-3xl gap-4 text-mist/70">
            <p className="leading-relaxed">
              Ferramenta de disparo manda a mesma mensagem para a lista inteira. Duas coisas
              acontecem: o WhatsApp bane o número — e o número da sua empresa é a sua agenda
              inteira — e quem esteve na sua loja ontem recebe uma mensagem de saudade e
              percebe que é robô.
            </p>
            <p className="leading-relaxed">
              A Nexora manda <strong className="text-mist">doze por semana</strong>,
              escolhidas pelo ritmo de cada um. Quem tem horário marcado nunca entra na
              lista. Quem já respondeu sai na hora. E você lê cada mensagem antes de mandar.
              É mais devagar de propósito.
            </p>
          </div>
        </div>
      </section>

      {/* ATO 5 — preço. */}
      <section id="preco" className="mx-auto max-w-page px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Um preço, sem pegadinha
            </h2>
            <p className="mt-6">
              <span className="font-display text-6xl font-bold">R$ 97</span>
              <span className="ml-2 text-mist/50">/mês, impostos inclusos</span>
            </p>
            <p className="mt-5 max-w-md leading-relaxed text-mist/70">
              O primeiro mês é grátis e não pedimos cartão para começar. Você decide se
              assina depois de ver, na tela, quem voltou e quanto pagou.
            </p>
            <Link
              href="/diagnostico"
              className="mt-8 inline-block rounded-xl bg-amber px-7 py-4 font-display font-bold text-night transition hover:brightness-105"
            >
              Começar pelo diagnóstico grátis
            </Link>
          </div>

          <ul className="grid gap-3 rounded-2xl border border-night-line bg-night-soft/50 p-8">
            {INCLUI.map((item) => (
              <li key={item} className="flex gap-3 text-mist/80">
                <span className="mt-0.5 text-amber">✓</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ATO 6 — fecho. */}
      <section className="mx-auto max-w-page px-6 pb-24">
        <div className="rounded-2xl border border-night-line bg-night-soft/60 p-10 text-center sm:p-14">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            Antes de decidir, veja o tamanho do buraco.
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-mist/65">
            Cola a lista que você já tem e a Nexora te mostra, com nome e sobrenome, quem
            parou de voltar. Não precisa criar conta para ver, e a lista não fica com a
            gente.
          </p>
          <Link
            href="/diagnostico"
            className="mt-8 inline-block rounded-xl bg-amber px-8 py-4 font-display text-lg font-bold text-night transition hover:brightness-105"
          >
            Ver quem sumiu da minha base
          </Link>
        </div>
      </section>

      <footer className="border-t border-night-line">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-6 py-10 text-sm text-mist/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Nexora — recuperação de clientes inativos para pequenos negócios de serviço.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-mist/70">
              Entrar
            </Link>
            <Link href="/diagnostico" className="hover:text-mist/70">
              Diagnóstico grátis
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
