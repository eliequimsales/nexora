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
 *
 * ---
 *
 * DIREÇÃO VISUAL (31/08/2026). A página era verde-escura de ponta a ponta e
 * lia como clone de WhatsApp — associação barata, e ainda por cima confusa,
 * porque o argumento central é justamente que a Nexora NÃO é disparador. Agora
 * ela usa o mesmo sistema dos carrosséis: preto neutro, papel quente, âmbar.
 *
 * A página alterna faixa ESCURA e faixa PAPEL, do jeito que os slides alternam.
 * A alternância é o que dá hierarquia sem precisar de mais nenhuma cor: escuro
 * onde se argumenta, papel onde se explica e onde se cobra.
 *
 * A ousadia está concentrada em UM lugar — a Régua de Ritmo. O resto é
 * disciplina: uma cor de destaque, três pesos de tipo, e respiro.
 */

// ---------------------------------------------------------------------------
// A RÉGUA DE RITMO — a assinatura da página.
//
// Todo concorrente diz "clientes inativos". A Nexora diz outra coisa: que
// inatividade é RELATIVA ao ritmo de cada pessoa. Isso é difícil de explicar em
// texto e óbvio em um desenho: batidas regulares, a batida que era esperada e
// não veio, e o silêncio depois.
//
// É informação, não enfeite — cada marca é uma visita real, e o comprimento do
// vão é o tamanho do prejuízo. Por isso ela aparece dentro do card do cliente,
// no lugar onde antes havia só uma frase.
// ---------------------------------------------------------------------------
function ReguaDeRitmo({ ciclo, dias }: { ciclo: number; dias: number }) {
  const VISITAS = 8;
  const ultima = (VISITAS - 1) * ciclo;
  const total = ultima + dias;
  const pct = (d: number) => (d / total) * 100;

  const esperada = ultima + ciclo;
  const cabeEsperada = esperada < total;

  return (
    <div
      className="relative mt-3 h-7"
      role="img"
      aria-label={`Vinha a cada ${ciclo} dias e está há ${dias} dias sem aparecer.`}
    >
      {/* linha de base */}
      <div className="absolute inset-x-0 top-3 h-px bg-white/10" />

      {/* o vão: onde deixou de vir */}
      <div
        className="absolute top-3 h-px"
        style={{
          left: `${pct(ultima)}%`,
          right: 0,
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(234,179,8,.55) 0 3px, transparent 3px 7px)",
        }}
      />

      {/* as visitas que aconteceram */}
      {Array.from({ length: VISITAS }, (_, i) => (
        <span
          key={i}
          className="absolute top-1 h-5 w-[2px] rounded-full bg-mist/45"
          style={{ left: `${pct(i * ciclo)}%` }}
        />
      ))}

      {/* a visita que era esperada e não veio — o produto inteiro em um traço */}
      {cabeEsperada && (
        <span
          className="absolute top-0 h-7 w-[2px] rounded-full bg-amber"
          style={{ left: `${pct(esperada)}%` }}
        />
      )}
    </div>
  );
}

const CARDS_DEMO = [
  {
    nome: "Marcos Andrade",
    esteira: "Prestes a sumir",
    dias: 31,
    ciclo: 24,
    porque: "Vinha a cada 24 dias. Está 7 além do ritmo normal.",
    valor: "R$ 50",
  },
  {
    nome: "Juliana Prado",
    esteira: "Atrasado",
    dias: 58,
    ciclo: 21,
    porque: "Vinha a cada 21 dias. Está 37 além do ritmo normal.",
    valor: "R$ 120",
  },
  {
    nome: "Rafael Nunes",
    esteira: "Sumido há muito",
    dias: 143,
    ciclo: 26,
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
            <a href="#como-funciona" className="transition hover:text-mist">
              Como funciona
            </a>
            <a href="#preco" className="transition hover:text-mist">
              Preço
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm text-mist/70 transition hover:text-mist">
              Entrar
            </Link>
            <Link
              href="/diagnostico"
              className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-night transition hover:brightness-105"
            >
              Ver quem sumiu
            </Link>
          </div>
        </div>
      </header>

      {/* ATO 1 — o prejuízo que não faz barulho. */}
      <section className="mx-auto grid max-w-page items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber">
            Recuperação de clientes inativos
          </p>
          <h1 className="mt-6 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem]">
            Sua agenda não está vazia.
            <br />
            <span className="text-mist/45">Sua base está parada.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-mist/65">
            Ninguém cancela nada. O cliente só vai espaçando — 20 dias, depois 40, depois
            some de vez. E como o movimento do dia continua, você não percebe. É o único
            prejuízo que não faz barulho.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/diagnostico"
              className="rounded-lg bg-amber px-7 py-4 text-center font-display font-bold text-night transition hover:brightness-105"
            >
              Descobrir quem sumiu da minha base
            </Link>
            <a
              href="#como-funciona"
              className="rounded-lg border border-night-line px-7 py-4 text-center text-sm text-mist/75 transition hover:border-mist/30 hover:text-mist"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-mist/35">
            De graça · sem cadastro · sua lista não é gravada
          </p>
        </div>

        {/* A demonstração é o produto de verdade: a Onda. */}
        <div className="rounded-xl border border-night-line bg-night-soft/70 p-5">
          <div className="flex items-baseline justify-between border-b border-night-line pb-3">
            <p className="font-display font-semibold">Onda de segunda</p>
            <span className="font-mono text-[11px] text-mist/40">12 clientes · ~9 min</span>
          </div>
          <div className="mt-4 grid gap-3">
            {CARDS_DEMO.map((c) => (
              <div key={c.nome} className="rounded-lg border border-night-line bg-night p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold">{c.nome}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-mist/40">
                    {c.esteira}
                  </span>
                </div>

                <ReguaDeRitmo ciclo={c.ciclo} dias={c.dias} />

                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-mist/40">
                    a cada {c.ciclo} dias
                  </span>
                  <span className="font-mono text-[11px] text-amber">
                    {c.dias} dias sem vir
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-night-line pt-3">
                  <span className="font-mono text-[11px] text-mist/40">ticket {c.valor}</span>
                  <span className="font-mono text-[11px] text-amber">copiar mensagem</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] text-mist/30">
            <span className="inline-block h-3 w-[2px] rounded-full bg-amber align-middle" />
            a batida que era esperada e não veio
          </p>
        </div>
      </section>

      {/* ATO 2 — a conta que ele nunca fez. */}
      <section className="border-y border-night-line">
        <div className="mx-auto max-w-page px-6 py-20">
          <p className="mx-auto max-w-3xl text-center font-display text-2xl leading-[1.4] tracking-[-0.01em] sm:text-3xl">
            Faz a conta agora: quantos clientes te mandaram mensagem no ano passado e nunca
            mais voltaram? Multiplica pelo seu ticket médio.{" "}
            <span className="text-amber">Esse número já foi seu uma vez.</span>
          </p>
        </div>
      </section>

      {/* ATO 3 — o mecanismo. Papel: aqui se explica, e explicação pede luz. */}
      <section id="como-funciona" className="bg-paper text-paper-ink">
        <div className="mx-auto max-w-page px-6 py-24">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Como funciona
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <div key={p.titulo} className="border-t border-paper-line pt-5">
                <span className="font-mono text-[11px] tracking-[0.14em] text-amber-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold leading-snug">
                  {p.titulo}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-paper-sub">{p.corpo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ATO 4 — separar do que ele já conhece e rejeita. */}
      <section className="border-t border-night-line">
        <div className="mx-auto max-w-page px-6 py-24">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            Isso não é disparo em massa
          </h2>
          <div className="mt-8 grid max-w-3xl gap-5 text-mist/65">
            <p className="leading-relaxed">
              Ferramenta de disparo manda a mesma mensagem para a lista inteira. Duas coisas
              acontecem: o WhatsApp bane o número — e o número da sua empresa é a sua agenda
              inteira — e quem esteve na sua loja ontem recebe uma mensagem de saudade e
              percebe que é robô.
            </p>
            <p className="leading-relaxed">
              A Nexora manda <strong className="font-semibold text-mist">doze por semana</strong>,
              escolhidas pelo ritmo de cada um. Quem tem horário marcado nunca entra na
              lista. Quem já respondeu sai na hora. E você lê cada mensagem antes de mandar.
              É mais devagar de propósito.
            </p>
          </div>
        </div>
      </section>

      {/* ATO 5 — preço. Papel de novo: o preço é o momento de mais luz da página. */}
      <section id="preco" className="bg-paper text-paper-ink">
        <div className="mx-auto max-w-page px-6 py-24">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                Um preço, sem pegadinha
              </h2>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-7xl font-bold tracking-[-0.04em]">
                  R$ 97
                </span>
                <span className="text-paper-sub">/mês, impostos inclusos</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-paper-sub">
                O primeiro mês é grátis e não pedimos cartão para começar. Você decide se
                assina depois de ver, na tela, quem voltou e quanto pagou.
              </p>
              <Link
                href="/diagnostico"
                className="mt-9 inline-block rounded-lg bg-night px-7 py-4 font-display font-bold text-mist transition hover:brightness-150"
              >
                Começar pelo diagnóstico grátis
              </Link>
            </div>

            <ul className="grid gap-0 border-t border-paper-line">
              {INCLUI.map((item) => (
                <li
                  key={item}
                  className="flex gap-4 border-b border-paper-line py-4 text-[15px] leading-relaxed"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ATO 6 — fecho. */}
      <section className="mx-auto max-w-page px-6 py-28">
        <div className="text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
            Antes de decidir, veja o tamanho do buraco.
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-mist/60">
            Cola a lista que você já tem e a Nexora te mostra, com nome e sobrenome, quem
            parou de voltar. Não precisa criar conta para ver, e a lista não fica com a
            gente.
          </p>
          <Link
            href="/diagnostico"
            className="mt-10 inline-block rounded-lg bg-amber px-9 py-4 font-display text-lg font-bold text-night transition hover:brightness-105"
          >
            Ver quem sumiu da minha base
          </Link>
        </div>
      </section>

      <footer className="border-t border-night-line">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-6 py-10 text-sm text-mist/40 sm:flex-row sm:items-center sm:justify-between">
          <p>Nexora — recuperação de clientes inativos para pequenos negócios de serviço.</p>
          <div className="flex gap-5">
            <Link href="/login" className="transition hover:text-mist/70">
              Entrar
            </Link>
            <Link href="/diagnostico" className="transition hover:text-mist/70">
              Diagnóstico grátis
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
