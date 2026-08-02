import type { Metadata } from 'next';
import {
  ArrowRight,
  Bell,
  Check,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardMockup } from '@/components/landing/DashboardMockup';
import { RecoveryCalculator } from '@/components/landing/RecoveryCalculator';
import { TrackView } from '@/components/analytics/TrackView';

export const metadata: Metadata = {
  title: 'Nexora — Descubra quais clientes pararam de comprar de você',
  description:
    'Seus clientes não avisam que estão indo embora, só param de voltar. A Nexora mostra quem parou, quanto dinheiro isso representa e a mensagem pronta pra trazer cada um de volta.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Seus clientes não cancelam. Eles só param de voltar.',
    description:
      'Descubra quanto dinheiro está parado na sua própria base de clientes — e o que fazer hoje pra recuperar.',
    type: 'website',
  },
};

const PAINS = [
  {
    title: 'Compravam todo mês e sumiram',
    text: 'Eram presença certa. Um dia pararam — e ninguém percebeu a tempo.',
  },
  {
    title: 'Esquecidos no WhatsApp',
    text: 'A conversa está lá, parada há meses, soterrada por centenas de outras.',
  },
  {
    title: 'Queriam voltar, mas ninguém chamou',
    text: 'Bastava uma mensagem. Ela nunca saiu — e o cliente foi pro concorrente.',
  },
  {
    title: 'Dinheiro parado no seu cadastro',
    text: 'A receita já está na sua base. Só não está sendo enxergada.',
  },
];

const STEPS = [
  {
    n: 'PASSO 1',
    title: 'Coloque seus clientes',
    text: 'Suba uma planilha, importe um CSV ou cadastre um por um. Leva minutos.',
    icon: Upload,
    tone: 'text-brand-gold',
    ring: 'bg-brand-gold/15 border-brand-gold/30',
  },
  {
    n: 'PASSO 2',
    title: 'A Nexora organiza tudo',
    text: 'Sua base inteira num lugar só, com o histórico de cada pessoa à mão.',
    icon: Users,
    tone: 'text-brand-purple',
    ring: 'bg-brand-purple/15 border-brand-purple/30',
  },
  {
    n: 'PASSO 3',
    title: 'Ela aponta quem está sumindo',
    text: 'Em ordem de prioridade: quem vale mais e está há mais tempo em silêncio.',
    icon: Search,
    tone: 'text-brand-amber',
    ring: 'bg-brand-amber/15 border-brand-amber/30',
  },
  {
    n: 'PASSO 4',
    title: 'Você recebe a próxima ação',
    text: 'A abordagem certa já vem escrita. Você lê, ajusta e manda pelo seu WhatsApp.',
    icon: Bell,
    tone: 'text-status-success',
    ring: 'bg-status-success-muted border-status-success/30',
  },
];

const COMPARISON = [
  {
    before: 'Você descobre que o cliente sumiu quando esbarra com ele na rua',
    after: 'Você vê no dia em que ele cruza a linha do silêncio',
  },
  {
    before: 'A base de clientes é uma planilha que ninguém abre',
    after: 'A base vira uma fila de quem contatar primeiro',
  },
  {
    before: 'Você gasta com anúncio pra buscar cliente novo',
    after: 'Você fatura de novo com quem já comprou e já confia em você',
  },
  {
    before: '“Preciso mandar mensagem pra ela” — e o dia acaba',
    after: 'A mensagem já está escrita, com o nome dela. Só copiar e mandar',
  },
];

/**
 * CTA de meio de página. Aparece nos picos de dor — quando o problema acabou
 * de ficar concreto, a saída tem que estar a um clique.
 */
function CtaBlock({ label, note }: { label: string; note: string }) {
  return (
    <div className="mt-12 text-center">
      <Link
        href="/register"
        className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-7 py-4 text-base font-semibold text-brand-bg shadow-glow-amber-sm transition-all hover:bg-brand-gold/90 active:scale-[0.98]"
      >
        {label}
        <ArrowRight size={17} />
      </Link>
      <p className="mt-3 text-xs text-text-muted">{note}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <TrackView name="landing_view" />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-brand-border bg-brand-bg/85 px-6 py-3.5 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-lg font-bold">
            <span className="text-brand-gold">N</span>
            <span className="text-text-primary">exora</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-bg transition-all hover:bg-brand-gold/90 active:scale-[0.98]"
            >
              Ver meus clientes
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-12 sm:pt-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold text-text-primary leading-[1.06] tracking-tight">
            Seus clientes não avisam que estão indo embora.
            <br className="hidden sm:block" />{' '}
            <span className="text-brand-gold">Eles só param de voltar.</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
            A Nexora mostra quem parou de comprar, quanto dinheiro isso representa e a
            mensagem exata pra trazer cada um de volta.
          </p>

          <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-7 py-4 text-base font-semibold text-brand-bg shadow-glow-amber-sm transition-all hover:bg-brand-gold/90 active:scale-[0.98]"
            >
              Descobrir meus clientes
              <ArrowRight size={17} />
            </Link>
            <Link
              href="#calculadora"
              className="rounded-lg border border-brand-border px-6 py-4 text-base font-medium text-text-primary transition-colors hover:bg-brand-surface"
            >
              Calcular quanto estou perdendo
            </Link>
          </div>

          <div className="flex items-center justify-center gap-x-6 gap-y-2 pt-3 flex-wrap text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-status-success" /> Grátis pra começar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-status-success" /> Sem cartão
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-status-success" /> Sem integração
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-status-success" /> Funciona com planilha
            </span>
          </div>
        </div>
      </section>

      {/* ── A CONTA QUE NINGUÉM FAZ ─────────────────────────────────────── */}
      {/* Vem antes da prova visual de propósito: quanto mais cedo o visitante
          põe os números dele, mais o problema vira problema DELE. */}
      <section id="calculadora" className="scroll-mt-20 px-6 pb-20 pt-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-2xs font-semibold uppercase tracking-widest text-brand-gold">
            A conta que ninguém faz
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-text-primary text-center leading-tight">
            Quanto dinheiro está parado na sua base?
          </h2>
          <p className="mt-4 mb-10 text-center text-text-muted max-w-xl mx-auto">
            Dois números seus. A resposta aparece na hora — e costuma assustar.
          </p>

          <RecoveryCalculator />
        </div>
      </section>

      {/* Prévia do produto */}
      <section className="px-6 pb-20 pt-4 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto pt-16">
          <h2 className="mb-10 text-center text-2xl sm:text-3xl font-bold text-text-primary">
            E é aqui que esses clientes aparecem
          </h2>
          <DashboardMockup />
        </div>
      </section>

      {/* ── POR QUE VOCÊ NÃO PERCEBE ────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
            Ninguém cancela. Simplesmente para de aparecer.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            É por isso que dói tanto: <strong className="text-text-primary">não existe
            aviso</strong>. Não chega e-mail de cancelamento, ninguém pede pra sair. O
            cliente só vai espaçando — some um mês, depois dois — e quando você lembra
            dele, já faz meio ano.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-text-secondary">
            Enquanto isso, a conta continua correndo. Todo mês um pouco mais da sua base
            cruza a linha do silêncio, calada.
          </p>
          <p className="mt-6 text-xl font-semibold text-brand-gold">
            A Nexora existe para fazer esse alarme tocar.
          </p>
        </div>
      </section>

      {/* ── DOR REAL ────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center leading-tight">
            Você sabe quantos clientes deixaram de comprar?
          </h2>
          <p className="mt-4 mb-12 text-center text-text-muted max-w-xl mx-auto">
            Quase ninguém sabe. E é exatamente aí que o dinheiro escapa.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PAINS.map((pain) => (
              <div
                key={pain.title}
                className="flex items-start gap-4 rounded-xl border border-brand-border bg-brand-surface p-5 transition-colors hover:border-brand-border-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-status-error/25 bg-status-error-muted/60">
                  <X size={15} className="text-status-error" />
                </span>
                <div>
                  <p className="font-semibold text-text-primary">{pain.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">{pain.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-6 text-center">
            <p className="text-lg sm:text-xl font-semibold leading-relaxed text-text-primary">
              O problema não é falta de clientes.{' '}
              <span className="text-brand-gold">
                É perder os clientes que você já conquistou.
              </span>
            </p>
          </div>

          <CtaBlock
            label="Ver quem sumiu da minha lista"
            note="Grátis · sem cartão · você vê a lista antes de decidir qualquer coisa"
          />
        </div>
      </section>

      {/* ── COMO FUNCIONA ───────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center">
            Como funciona
          </h2>
          <p className="mt-4 mb-12 text-center text-text-muted">
            Quatro passos. Sem instalar nada, sem integrar nada.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map(({ n, title, text, icon: Icon, tone, ring }) => (
              <div key={n} className="text-center space-y-4">
                <div
                  className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${ring}`}
                >
                  <Icon size={22} className={tone} />
                </div>
                <div>
                  <p className={`font-bold text-xs mb-1 ${tone}`}>{n}</p>
                  <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed text-text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O PRODUTO POR DENTRO ────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center">
            É assim que você vê seus clientes
          </h2>
          <p className="mt-4 mb-12 text-center text-text-muted">
            Quem sumiu aparece primeiro, com o motivo e a ação recomendada.
          </p>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] items-start">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-panel">
              <div className="flex items-center justify-between gap-3 border-b border-brand-border pb-4">
                <p className="text-sm font-semibold text-text-primary">
                  Precisam de atenção
                </p>
                <span className="rounded-full border border-brand-border bg-brand-surface-2 px-2 py-0.5 text-2xs font-medium text-text-muted">
                  exemplo
                </span>
              </div>

              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple/25 text-sm font-semibold text-brand-purple">
                  MS
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text-primary">Maria Souza</p>
                    <span className="rounded-full border border-status-warning/20 bg-status-warning-muted px-2 py-0.5 text-2xs font-semibold text-status-warning">
                      Alta prioridade
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    Última compra:{' '}
                    <strong className="text-text-secondary">5 meses atrás</strong>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    Cliente que costumava comprar todo mês e parou.
                  </p>

                  <div className="mt-4 rounded-lg border border-brand-border bg-brand-surface-2/60 p-3">
                    <p className="text-2xs uppercase tracking-wider text-text-muted">
                      Ação recomendada
                    </p>
                    <p className="mt-1 text-sm font-medium text-text-primary">
                      Entrar em contato — convite cordial, sem desconto
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-status-success/30 bg-status-success-muted/15 p-6 text-center">
              <p className="text-2xs font-semibold uppercase tracking-widest text-status-success">
                Exemplo — hoje você poderia recuperar
              </p>
              <p className="mt-2 text-4xl font-bold text-text-primary">R$ 2.400</p>
              <p className="mt-1 text-sm text-text-muted">12 clientes parados na base</p>

              <div className="mt-5 border-t border-status-success/20 pt-4">
                <p className="text-xs leading-relaxed text-text-muted">
                  Números ilustrativos. Na sua conta, o cálculo usa a{' '}
                  <strong className="text-text-secondary">sua</strong> base e o{' '}
                  <strong className="text-text-secondary">seu</strong> ticket médio.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <h3 className="text-2xl font-bold text-text-primary text-center">
              E a mensagem já vem escrita
            </h3>
            <p className="mt-3 mb-8 text-center text-text-muted">
              Com o nome do cliente e o tempo de ausência. Você lê, ajusta e manda.
            </p>

            <div className="max-w-sm mx-auto">
              <div className="rounded-2xl bg-[#111B21] p-4 shadow-xl border border-white/5">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-sm">
                    M
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Maria Souza</p>
                    <p className="text-white/40 text-xs">cliente</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#005C4B] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow">
                    <p className="text-white text-sm leading-relaxed">
                      Oi Maria, tudo bem? 🙂
                      <br />
                      <br />
                      Faz um tempo que a gente não se vê. Queria saber se está tudo certo
                      e se posso te ajudar com algo por aqui.
                    </p>
                    <p className="text-white/40 text-[10px] text-right mt-1">✓✓</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-text-muted">
              Enviada do <strong className="text-text-secondary">seu</strong> número.
              Nenhuma integração ou API necessária.
            </p>
          </div>

          <CtaBlock
            label="Quero minhas mensagens prontas"
            note="Você lê e aprova cada uma. Nada é enviado sem você."
          />
        </div>
      </section>

      {/* ── ANTES / DEPOIS ──────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center">
            O que muda na prática
          </h2>
          <p className="mt-4 mb-12 text-center text-text-muted">
            Mesma base de clientes. Duas realidades diferentes.
          </p>

          <div className="overflow-hidden rounded-xl border border-brand-border">
            <div className="grid grid-cols-2 border-b border-brand-border bg-brand-surface-2">
              <p className="px-5 py-3 text-sm font-semibold text-text-muted">Hoje</p>
              <p className="border-l border-brand-border px-5 py-3 text-sm font-semibold text-brand-gold">
                Com a Nexora
              </p>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.before}
                className="grid grid-cols-2 border-b border-brand-border last:border-b-0"
              >
                <div className="flex items-start gap-2.5 bg-brand-surface/50 px-5 py-4">
                  <X size={14} className="mt-0.5 shrink-0 text-status-error" />
                  <p className="text-sm leading-relaxed text-text-muted">{row.before}</p>
                </div>
                <div className="flex items-start gap-2.5 border-l border-brand-border bg-brand-surface px-5 py-4">
                  <Check size={14} className="mt-0.5 shrink-0 text-status-success" />
                  <p className="text-sm leading-relaxed text-text-secondary">{row.after}</p>
                </div>
              </div>
            ))}
          </div>

          <CtaBlock
            label="Quero minha base assim"
            note="Leva alguns minutos. Se não fizer sentido, é só fechar a aba."
          />
        </div>
      </section>

      {/* ── PARA QUEM É ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center">
            A Nexora é pra você?
          </h2>
          <p className="mt-4 mb-12 text-center text-text-muted">
            Preferimos ser diretos do que fazer você perder tempo.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-status-success/30 bg-brand-surface p-6">
              <p className="font-semibold text-status-success">Faz muito sentido se…</p>
              <ul className="mt-4 space-y-3">
                {[
                  'Você tem clientes que compram mais de uma vez',
                  'Já passaram dezenas ou centenas de pessoas pelo seu negócio',
                  'Seus contatos vivem no WhatsApp ou numa planilha',
                  'Você sente que perde gente sem saber por quê',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <Check size={14} className="mt-0.5 shrink-0 text-status-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <p className="font-semibold text-text-muted">Não vale a pena se…</p>
              <ul className="mt-4 space-y-3">
                {[
                  'Seu negócio é de venda única, sem recompra',
                  'Você não guarda nome nem contato de quem compra',
                  'Você está começando agora e ainda não tem base',
                  'Você quer um CRM completo com pipeline e relatórios',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <X size={14} className="mt-0.5 shrink-0 text-text-muted" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center">
            As dúvidas que todo mundo tem
          </h2>
          <p className="mt-4 mb-10 text-center text-text-muted">
            Se ficar alguma, é só perguntar depois de entrar.
          </p>
          <div className="space-y-3">
            {[
              {
                q: 'Preciso ter um sistema instalado?',
                a: 'Não. A Nexora funciona com qualquer lista — Excel, planilha do Google, exportação do seu sistema ou digitado na mão. Se você tem nome e telefone, já dá pra começar.',
              },
              {
                q: 'Quanto tempo leva pra ver algo útil?',
                a: 'O tempo de subir sua lista. Assim que o arquivo entra, a Nexora já mostra quem está parado e há quanto tempo — não precisa configurar nada antes.',
              },
              {
                q: 'A Nexora manda mensagem sozinha?',
                a: 'Não. Ela escreve a mensagem pronta pra você — você lê, ajusta se quiser e envia do seu próprio número. Nada sai sem a sua aprovação.',
              },
              {
                q: 'E se o cliente pedir pra parar de receber?',
                a: 'Você simplesmente não manda mais. Como o envio é pelo seu próprio WhatsApp, o controle é inteiramente seu.',
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
              <details
                key={q}
                className="group rounded-xl border border-brand-border bg-brand-surface overflow-hidden"
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-medium text-text-primary text-sm gap-4">
                  {q}
                  <span className="text-brand-gold shrink-0 group-open:rotate-45 transition-transform duration-150 text-lg font-light">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL + RISCO ───────────────────────────────────────────── */}
      <section className="px-6 pb-24 pt-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-brand-gold/30 bg-brand-surface p-8 text-center sm:p-12">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10">
              <ShieldCheck size={22} className="text-brand-gold" />
            </span>

            <h2 className="mt-6 text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
              Você não precisa acreditar em nada.
              <br />
              <span className="text-brand-gold">Veja seus próprios clientes.</span>
            </h2>

            <p className="mt-5 text-lg leading-relaxed text-text-secondary max-w-xl mx-auto">
              Suba sua lista e descubra, com os seus dados, quem parou de comprar e
              quanto isso vale. Se não fizer sentido, é só fechar a aba — não tem cartão,
              não tem contrato, não tem cobrança.
            </p>

            <div className="mt-8">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-8 py-4 text-lg font-semibold text-brand-bg shadow-glow-amber-sm transition-all hover:bg-brand-gold/90 active:scale-[0.98]"
              >
                Ver meus clientes
                <ArrowRight size={18} />
              </Link>
              <p className="mt-3 text-sm text-text-muted">
                Grátis pra começar · Sem cartão · Leva alguns minutos
              </p>
            </div>

            <p className="mt-8 border-t border-brand-border pt-6 text-base text-text-secondary">
              Enquanto você lê isso, mais um cliente seu está completando 90 dias sem
              voltar.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border px-6 py-8 pb-24 sm:pb-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-text-muted flex-wrap gap-4">
          <p>© 2026 Nexora. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link href="/privacidade" className="hover:text-text-primary transition-colors">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-text-primary transition-colors">
              Termos
            </Link>
            <Link href="/contato" className="hover:text-text-primary transition-colors">
              Contato
            </Link>
          </div>
        </div>
      </footer>

      {/* CTA fixo no mobile — o botão nunca sai da tela */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-border bg-brand-bg/95 p-3 backdrop-blur-md sm:hidden">
        <Link
          href="/register"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 py-3.5 font-semibold text-brand-bg active:scale-[0.98]"
        >
          Descobrir meus clientes
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
