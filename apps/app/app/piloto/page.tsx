import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, CircleDot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Projeto Piloto — Nexora',
  description:
    'Estamos selecionando as primeiras empresas parceiras para construir a Nexora junto com elas. Acesso 100% gratuito durante a fase piloto, em troca de feedback.',
  robots: { index: true, follow: true },
};

const ROADMAP: { label: string; done: boolean }[] = [
  { label: 'Recuperação inteligente de clientes', done: true },
  { label: 'Importação por CSV', done: true },
  { label: 'Integração com sistemas de gestão', done: false },
  { label: 'WhatsApp automático', done: false },
  { label: 'IA para campanhas personalizadas', done: false },
  { label: 'Relatórios de retorno', done: false },
];

export default function PilotoPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="border-b border-brand-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            <span className="text-brand-gold">N</span>
            <span className="text-text-primary">exora</span>
          </Link>
          <Link href="/recuperar" className="text-sm font-medium text-brand-gold hover:text-brand-gold/80">
            Ver demonstração
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-sm font-medium text-brand-gold">
            🚀 Projeto Piloto
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-text-primary leading-tight">
            Construa a Nexora junto com a gente
          </h1>
          <p className="text-lg text-text-muted">
            Estamos selecionando as primeiras empresas parceiras para participar da primeira
            fase da Nexora. Acesso 100% gratuito — em troca, pedimos apenas o seu feedback.
          </p>
          <p className="text-sm text-brand-gold font-medium">
            Estamos acompanhando apenas 10 empresas nesta primeira fase, para garantir suporte
            próximo dos fundadores e evoluir a plataforma com base em feedback real.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-2 text-sm text-text-secondary">
            🏆 <span className="font-semibold text-brand-gold">Empresa Fundadora</span> — quem entra agora faz parte do começo
          </div>
        </div>
      </section>

      {/* Quem / Recebe / Esperamos */}
      <section className="px-6 pb-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h2 className="font-semibold text-text-primary mb-3">Quem pode participar?</h2>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-brand-gold shrink-0" /> Empresas com base de clientes
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-brand-gold shrink-0" /> Que conseguem exportar em CSV
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h2 className="font-semibold text-text-primary mb-3">O que você recebe?</h2>
            <ul className="space-y-2 text-sm text-text-secondary">
              {['Acesso gratuito', 'Suporte direto com os fundadores', 'Atualizações frequentes', 'Prioridade nas novas funcionalidades'].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={14} className="text-brand-gold shrink-0" /> {i}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h2 className="font-semibold text-text-primary mb-3">O que esperamos?</h2>
            <ul className="space-y-2 text-sm text-text-secondary">
              {['Utilizar a plataforma', 'Compartilhar feedback sincero', 'Uma conversa rápida após o uso'].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={14} className="text-brand-gold shrink-0" /> {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Roadmap público */}
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-2">🚧 Em desenvolvimento</h2>
          <p className="text-center text-text-muted mb-8 text-sm">
            Roadmap público — você acompanha (e influencia) o que vem a seguir.
          </p>
          <ul className="space-y-2">
            {ROADMAP.map(({ label, done }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm"
              >
                {done ? (
                  <Check size={16} className="text-status-success shrink-0" />
                ) : (
                  <CircleDot size={16} className="text-brand-amber shrink-0" />
                )}
                <span className={done ? 'text-text-primary' : 'text-text-secondary'}>{label}</span>
                <span className="ml-auto text-xs text-text-muted">{done ? 'pronto' : 'em breve'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Carta dos fundadores */}
      <section className="px-6 pb-4">
        <div className="max-w-2xl mx-auto rounded-xl border border-brand-border bg-brand-surface p-7">
          <h2 className="text-xl font-bold text-text-primary mb-4">Por que estamos fazendo isso?</h2>
          <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              Acreditamos que milhares de empresas perdem clientes todos os meses sem saber por
              onde começar para recuperá-los.
            </p>
            <p>
              Em vez de construir a Nexora sozinhos, decidimos convidar algumas empresas para
              desenvolver essa plataforma junto com a gente.
            </p>
            <p>
              Se você participar do Projeto Piloto, a sua opinião terá impacto direto nas próximas
              funcionalidades da Nexora.
            </p>
            <p className="text-text-muted pt-1">— Jherlil, fundador da Nexora</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 pt-12">
        <div className="max-w-xl mx-auto text-center space-y-5">
          <h2 className="text-2xl font-bold text-text-primary">Quer participar?</h2>
          <p className="text-text-muted">
            Sem cartão, sem compromisso de contratação. A demonstração leva cerca de 10 minutos.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand-gold text-brand-bg font-semibold px-6 py-3 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all"
            >
              Participar do Projeto Piloto
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/recuperar"
              className="px-6 py-3 border border-brand-border rounded-lg text-text-primary font-medium hover:bg-brand-surface transition-colors"
            >
              Ver demonstração
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-brand-border px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-text-muted flex-wrap gap-4">
          <p>© 2026 Nexora. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link href="/privacidade" className="hover:text-text-primary transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-text-primary transition-colors">Termos</Link>
            <Link href="/contato" className="hover:text-text-primary transition-colors">Contato</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
