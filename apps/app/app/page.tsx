import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { ArrowRight, Check, X } from 'lucide-react';
import Link from 'next/link';
import { DashboardMockup } from '@/components/landing/DashboardMockup';
import { RecoveryCalculator } from '@/components/landing/RecoveryCalculator';
import { SilenceWall } from '@/components/landing/SilenceWall';
import { TrackView } from '@/components/analytics/TrackView';

/** Display face — peso e largura pra headline soar como manchete, não como slogan. */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nexora — Descubra quais clientes pararam de comprar de você',
  description:
    'Seus clientes não cancelam, só param de aparecer. A Nexora mostra quem sumiu, quanto isso vale e a mensagem pronta pra trazer cada um de volta.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Eles não avisam que foram embora.',
    description:
      'Descubra quanto dinheiro está parado na sua própria base de clientes — e o que fazer hoje.',
    type: 'website',
  },
};

const INK = '#0B0A0C';
const CREAM = '#EFEDE6';

const STEPS = [
  {
    k: 'Você sobe',
    title: 'Sua lista, do jeito que ela está',
    text: 'Planilha, CSV, exportação do seu sistema ou digitado na mão. Nada pra instalar.',
  },
  {
    k: 'A Nexora lê',
    title: 'Quem parou e há quanto tempo',
    text: 'Cada pessoa da sua base ganha um histórico e um tempo de silêncio.',
  },
  {
    k: 'Ela ordena',
    title: 'Quem vale mais vem primeiro',
    text: 'Não é lista alfabética. É fila de prioridade: quem some há mais tempo e vale mais.',
  },
  {
    k: 'Você age',
    title: 'A mensagem já vem escrita',
    text: 'Com o nome da pessoa e o tom certo. Você lê, ajusta e manda do seu WhatsApp.',
  },
];

const COMPARISON = [
  {
    before: 'Você descobre que o cliente sumiu ao esbarrar com ele na rua',
    after: 'Você vê no dia em que ele cruza a linha do silêncio',
  },
  {
    before: 'A base de clientes é uma planilha que ninguém abre',
    after: 'A base vira uma fila de quem chamar primeiro',
  },
  {
    before: 'Pra faturar mais, você paga anúncio pra buscar gente nova',
    after: 'Você fatura de novo com quem já comprou e já confia em você',
  },
  {
    before: '“Preciso falar com a Maria” — e o dia acaba',
    after: 'A mensagem da Maria já está pronta. Só copiar e mandar',
  },
];

export default function LandingPage() {
  return (
    <div className={`${archivo.variable} min-h-screen`} style={{ backgroundColor: INK }}>
      <TrackView name="landing_view" />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 border-b border-white/8 px-6 py-3.5 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(11,10,12,0.82)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-brand-gold">N</span>
            <span className="text-white">exora</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-5 py-2 text-sm font-semibold text-[#0B0A0C] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Ver meus clientes
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ ATO I — O SILÊNCIO ══════════════════════════════════════════ */}
      <section className="px-6 pt-20 pb-24 sm:pt-28">
        <div className="mx-auto max-w-3xl">
          <p className="nx-emerge text-center font-mono text-[11px] uppercase tracking-[0.28em] text-brand-gold">
            Perda silenciosa
          </p>

          <h1
            className="nx-emerge mt-7 text-center text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.4rem]"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '60ms' }}
          >
            Eles não avisam
            <br />
            que foram embora.
          </h1>

          <p
            className="nx-emerge mx-auto mt-8 max-w-xl text-center text-lg leading-relaxed text-white/65 sm:text-xl"
            style={{ animationDelay: '140ms' }}
          >
            Seus clientes não cancelam. Vão espaçando — um mês, dois — e quando você
            lembra, já faz meio ano.
          </p>
        </div>

        {/* ★ Assinatura: o mural */}
        <div className="mx-auto mt-20 max-w-2xl px-2">
          <SilenceWall />
        </div>

        <div className="mx-auto mt-14 max-w-2xl text-center">
          <p
            className="nx-emerge text-lg leading-relaxed text-white/75"
            style={{ animationDelay: '1100ms' }}
          >
            Cada nome apagando é alguém que{' '}
            <strong className="font-semibold text-white">já comprou de você</strong>.
            <br className="hidden sm:block" /> A Nexora existe pra fazer esse alarme
            tocar.
          </p>

          <div
            className="nx-emerge mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '1250ms' }}
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-8 py-4 text-base font-semibold text-[#0B0A0C] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Ver quem sumiu da minha lista
              <ArrowRight size={17} />
            </Link>
            <Link
              href="#a-conta"
              className="rounded-full border border-white/15 px-7 py-4 text-base font-medium text-white/80 transition-colors hover:bg-white/5"
            >
              Calcular quanto estou perdendo
            </Link>
          </div>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/30">
            Grátis · sem cartão · sem integração
          </p>
        </div>
      </section>

      {/* ══ A CONTA ═════════════════════════════════════════════════════ */}
      <section
        id="a-conta"
        className="scroll-mt-16 border-y border-white/8 px-6 py-24"
        style={{ backgroundColor: '#08070A' }}
      >
        <div className="mx-auto max-w-4xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.28em] text-brand-gold">
            A conta que ninguém faz
          </p>
          <h2
            className="mx-auto mt-6 max-w-2xl text-center text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Quanto dinheiro está parado na sua base?
          </h2>
          <p className="mx-auto mt-5 mb-12 max-w-lg text-center text-white/55">
            Dois números seus. A resposta aparece na hora — e costuma assustar.
          </p>

          <RecoveryCalculator />
        </div>
      </section>

      {/* ══ ATO II — A LUZ ACENDE ═══════════════════════════════════════ */}
      <div style={{ backgroundColor: CREAM }}>
        {/* Virada */}
        <section className="px-6 pt-24 pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#A67400]">
              A virada
            </p>
            <h2
              className="mt-6 text-3xl font-extrabold leading-[1.04] tracking-[-0.025em] text-[#14121A] sm:text-5xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              O problema nunca foi
              <br />
              falta de cliente.
            </h2>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#57514A]">
              Você já conquistou essas pessoas uma vez. Elas já confiaram em você, já
              pagaram, já voltaram. Trazer alguém assim de volta custa uma mensagem —
              não um anúncio.
            </p>
          </div>
        </section>

        {/* Como funciona */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h3
              className="text-center text-2xl font-bold tracking-[-0.02em] text-[#14121A] sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Como funciona
            </h3>

            <div className="mt-12 divide-y divide-[#DCD6C9] border-y border-[#DCD6C9]">
              {STEPS.map((s) => (
                <div
                  key={s.k}
                  className="grid gap-3 py-7 sm:grid-cols-[minmax(0,9rem)_1fr] sm:gap-10"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#A67400] sm:pt-1">
                    {s.k}
                  </p>
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-[#14121A]">
                      {s.title}
                    </p>
                    <p className="mt-1.5 leading-relaxed text-[#57514A]">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O produto */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h3
              className="text-center text-2xl font-bold tracking-[-0.02em] text-[#14121A] sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              É assim que você vê sua base
            </h3>
            <p className="mt-4 text-center text-[#57514A]">
              Quem sumiu aparece primeiro, com o motivo e a ação recomendada.
            </p>

            <div className="mt-12">
              <DashboardMockup />
            </div>

            <div className="mt-20 grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Card do cliente */}
              <div className="rounded-2xl border border-[#DCD6C9] bg-white p-6">
                <div className="flex items-center justify-between gap-3 border-b border-[#E7E2D7] pb-4">
                  <p className="text-sm font-semibold text-[#14121A]">
                    Precisam de atenção
                  </p>
                  <span className="rounded-full border border-[#DCD6C9] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8A837A]">
                    exemplo
                  </span>
                </div>

                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDE7FB] text-sm font-semibold text-[#6D28D9]">
                    MS
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#14121A]">Maria Souza</p>
                      <span className="rounded-full bg-[#FDF0D5] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8A5D00]">
                        Alta prioridade
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#8A837A]">
                      última compra · 5 meses atrás
                    </p>
                    <p className="mt-3 leading-relaxed text-[#57514A]">
                      Cliente que costumava comprar todo mês e parou.
                    </p>

                    <div className="mt-4 rounded-xl bg-[#F6F4EE] p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A837A]">
                        Ação recomendada
                      </p>
                      <p className="mt-1.5 font-medium text-[#14121A]">
                        Convite cordial, sem desconto
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <div className="rounded-2xl bg-[#111B21] p-4 shadow-lg">
                  <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold/20 text-sm font-bold text-brand-gold">
                      M
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Maria Souza</p>
                      <p className="font-mono text-[10px] text-white/40">online</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[86%] rounded-2xl rounded-tr-sm bg-[#005C4B] px-4 py-3">
                      <p className="text-sm leading-relaxed text-white">
                        Oi Maria, tudo bem? 🙂
                        <br />
                        <br />
                        Faz um tempo que a gente não se vê. Queria saber se está tudo
                        certo e se posso te ajudar com algo por aqui.
                      </p>
                      <p className="mt-1 text-right text-[10px] text-white/40">✓✓</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-[#57514A]">
                  Escrita pela Nexora, enviada do{' '}
                  <strong className="text-[#14121A]">seu</strong> número.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Antes / depois */}
        <section className="px-6 py-16 pb-24">
          <div className="mx-auto max-w-4xl">
            <h3
              className="text-center text-2xl font-bold tracking-[-0.02em] text-[#14121A] sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              O que muda na prática
            </h3>

            <div className="mt-10 space-y-px overflow-hidden rounded-2xl border border-[#DCD6C9]">
              {COMPARISON.map((row) => (
                <div key={row.before} className="grid sm:grid-cols-2">
                  <div className="flex items-start gap-3 bg-[#E8E4DA] px-5 py-5">
                    <X size={15} className="mt-0.5 shrink-0 text-[#B4483C]" />
                    <p className="text-sm leading-relaxed text-[#6B645B]">{row.before}</p>
                  </div>
                  <div className="flex items-start gap-3 bg-white px-5 py-5">
                    <Check size={15} className="mt-0.5 shrink-0 text-[#0F7A55]" />
                    <p className="text-sm leading-relaxed text-[#14121A]">{row.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ══ ATO III — DECISÃO ═══════════════════════════════════════════ */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2
            className="text-center text-3xl font-extrabold tracking-[-0.02em] text-white sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            A Nexora é pra você?
          </h2>
          <p className="mt-4 text-center text-white/50">
            Preferimos ser diretos do que fazer você perder tempo.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400">
                Faz muito sentido
              </p>
              <ul className="mt-5 space-y-3.5">
                {[
                  'Seus clientes compram mais de uma vez',
                  'Já passaram dezenas ou centenas de pessoas pelo seu negócio',
                  'Seus contatos vivem no WhatsApp ou numa planilha',
                  'Você sente que perde gente sem saber por quê',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/80">
                    <Check size={15} className="mt-1 shrink-0 text-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                Não vale a pena
              </p>
              <ul className="mt-5 space-y-3.5">
                {[
                  'Seu negócio é de venda única, sem recompra',
                  'Você não guarda nome nem contato de quem compra',
                  'Você está começando agora e ainda não tem base',
                  'Você quer um CRM completo, com pipeline e relatórios',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/45">
                    <X size={15} className="mt-1 shrink-0 text-white/30" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-2xl">
          <h2
            className="text-center text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            As dúvidas que todo mundo tem
          </h2>

          <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
            {[
              {
                q: 'Preciso instalar ou integrar alguma coisa?',
                a: 'Nada. A Nexora funciona com a lista que você já tem — Excel, planilha do Google, exportação do seu sistema ou digitada na mão. Se tem nome e telefone, dá pra começar.',
              },
              {
                q: 'Quanto tempo até ver algo útil?',
                a: 'O tempo de subir sua lista. Assim que o arquivo entra, a Nexora já mostra quem está parado e há quanto tempo. Não tem configuração antes.',
              },
              {
                q: 'A Nexora manda mensagem sozinha?',
                a: 'Não. Ela escreve a mensagem pronta — você lê, ajusta se quiser e envia do seu próprio número. Nada sai sem você aprovar.',
              },
              {
                q: 'E se o cliente pedir pra parar de receber?',
                a: 'Você simplesmente não manda mais. Como o envio sai do seu WhatsApp, o controle é inteiramente seu.',
              },
              {
                q: 'Meus dados de clientes ficam seguros?',
                a: 'Sua base é sua. Os dados ficam restritos à sua conta, não são compartilhados com outras empresas e você pode parar de usar quando quiser.',
              },
              {
                q: 'E se eu não gostar?',
                a: 'Você para de usar. Não tem cartão cadastrado, não tem fidelidade e não tem cobrança pra cancelar.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-white/90 transition-colors hover:text-white">
                  {q}
                  <span className="shrink-0 text-xl font-light text-brand-gold transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 leading-relaxed text-white/55">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Fechamento */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Alguém da sua lista
            <br />
            <span className="text-brand-gold">está esperando</span>
            <br />
            <span className="text-brand-gold">você chamar.</span>
          </h2>

          <p className="mx-auto mt-8 max-w-lg text-lg leading-relaxed text-white/60">
            Suba sua lista e descubra, com os seus dados, quem parou de comprar e quanto
            isso vale. Se não fizer sentido, é só fechar a aba.
          </p>

          <Link
            href="/register"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-gold px-10 py-5 text-lg font-semibold text-[#0B0A0C] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Ver meus clientes
            <ArrowRight size={19} />
          </Link>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/30">
            Grátis pra começar · sem cartão · leva minutos
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-6 py-10 pb-28 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-white/35">
          <p>© 2026 Nexora</p>
          <div className="flex gap-6">
            <Link href="/privacidade" className="transition-colors hover:text-white/70">
              Privacidade
            </Link>
            <Link href="/termos" className="transition-colors hover:text-white/70">
              Termos
            </Link>
            <Link href="/contato" className="transition-colors hover:text-white/70">
              Contato
            </Link>
          </div>
        </div>
      </footer>

      {/* CTA fixo no mobile */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 p-3 backdrop-blur-md sm:hidden"
        style={{ backgroundColor: 'rgba(11,10,12,0.94)' }}
      >
        <Link
          href="/register"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gold py-3.5 font-semibold text-[#0B0A0C] active:scale-[0.98]"
        >
          Ver meus clientes
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
