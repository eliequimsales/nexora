import { ArrowRight, Check, Users, TrendingUp, BarChart3, Zap } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Navigation */}
      <nav className="border-b border-brand-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-lg font-bold">
            <span className="text-brand-gold">N</span>
            <span className="text-text-primary">exora</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl lg:text-6xl font-bold text-text-primary leading-tight">
            Quantos clientes você perdeu <span className="text-brand-gold">esse mês?</span>
          </h1>
          <p className="text-xl text-text-muted max-w-2xl mx-auto">
            A Nexora descobre quem parou de voltar pra sua barbearia e prepara
            a mensagem pronta pra você chamar cada um no WhatsApp.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
            <Link
              href="/diagnostico"
              className="inline-flex items-center gap-2 bg-brand-gold text-brand-bg font-semibold px-6 py-3 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all"
            >
              Fazer diagnóstico grátis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/register?niche=barbearia"
              className="px-6 py-3 border border-brand-border rounded-lg text-text-primary font-medium hover:bg-brand-surface transition-colors"
            >
              Começar trial direto
            </Link>
          </div>
          <p className="text-xs text-text-muted pt-2">
            Em 1 minuto descubra quanto sua barbearia pode estar deixando de ganhar
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-12 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-brand-gold">92%</p>
            <p className="text-sm text-text-muted mt-1">Taxa de retenção</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-gold">45 min</p>
            <p className="text-sm text-text-muted mt-1">Tempo de setup</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-gold">R$ 80</p>
            <p className="text-sm text-text-muted mt-1">Ticket médio</p>
          </div>
        </div>
      </section>

      {/* Why Nexora Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            Por que Nexora funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Feature 1: Aversão à perda */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-purple/15 flex items-center justify-center mb-4">
                <Zap size={20} className="text-brand-purple" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Psicologia de aversão à perda
              </h3>
              <p className="text-sm text-text-muted">
                "Você perdeu R$ 2.400 em receita de clientes inativos" → urgência imediata de agir.
              </p>
            </div>

            {/* Feature 2: IA personalizada */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-amber/15 flex items-center justify-center mb-4">
                <BarChart3 size={20} className="text-brand-amber" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                IA adapta cada mensagem
              </h3>
              <p className="text-sm text-text-muted">
                Cada cliente recebe uma mensagem única, gerada pela IA, baseada em seu histórico.
              </p>
            </div>

            {/* Feature 3: Automação total */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/15 flex items-center justify-center mb-4">
                <TrendingUp size={20} className="text-brand-gold" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Sem trabalho manual
              </h3>
              <p className="text-sm text-text-muted">
                Detecta automaticamente clientes perdidos, gera mensagens e envia. Você só confirma.
              </p>
            </div>

            {/* Feature 4: Multi-canal */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-status-success-muted flex items-center justify-center mb-4">
                <Users size={20} className="text-status-success" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                WhatsApp e Email
              </h3>
              <p className="text-sm text-text-muted">
                Envia pelo canal que o cliente mais usa. Taxa de resposta +30% vs email puro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-6 py-20 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            O que nossos clientes dizem
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-brand-gold">★</span>
                ))}
              </div>
              <p className="text-sm text-text-muted mb-4">
                "Recuperei 12 clientes em uma semana. Agora uso a Nexora toda segunda."
              </p>
              <p className="font-semibold text-sm text-text-primary">
                João, Barbearia SP
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-brand-gold">★</span>
                ))}
              </div>
              <p className="text-sm text-text-muted mb-4">
                "Não acreditava que IA personalizada funcionaria, mas as respostas foram ótimas."
              </p>
              <p className="font-semibold text-sm text-text-primary">
                Carlos, Barbearia RJ
              </p>
            </div>

            {/* Testimonial 3 */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-brand-gold">★</span>
                ))}
              </div>
              <p className="text-sm text-text-muted mb-4">
                "Paguei a assinatura anual e recuperei em 2 semanas. ROI sensacional."
              </p>
              <p className="font-semibold text-sm text-text-primary">
                Miguel, Barbearia MG
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            Planos simples e diretos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-8">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Starter</h3>
              <p className="text-sm text-text-muted mb-6">Para donos iniciais</p>
              <p className="text-3xl font-bold text-brand-gold mb-6">
                R$ 97<span className="text-sm text-text-muted">/mês</span>
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Até 100 clientes
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  WhatsApp + Email
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  IA personalizada
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Suporte por email
                </li>
              </ul>
              <Link
                href="/register?niche=barbearia&plan=starter"
                className="w-full inline-flex items-center justify-center bg-brand-surface-2 text-text-primary font-medium px-4 py-2.5 rounded-lg hover:bg-brand-surface-3 transition-colors"
              >
                Começar grátis
              </Link>
            </div>

            {/* Profissional — Destaque */}
            <div className="rounded-lg border-2 border-brand-gold bg-brand-surface p-8 relative lg:-translate-y-2">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-gold text-brand-bg text-xs font-bold px-3 py-1 rounded-full">
                MAIS POPULAR
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Profissional</h3>
              <p className="text-sm text-text-muted mb-6">Para donos que crescem</p>
              <p className="text-3xl font-bold text-brand-gold mb-6">
                R$ 197<span className="text-sm text-text-muted">/mês</span>
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Até 500 clientes
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  WhatsApp + Email
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  IA avançada
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Analytics detalhado
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Suporte prioritário
                </li>
              </ul>
              <Link
                href="/register?niche=barbearia&plan=profissional"
                className="w-full inline-flex items-center justify-center bg-brand-gold text-brand-bg font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-gold/90 transition-colors"
              >
                Começar grátis
              </Link>
            </div>

            {/* Premium */}
            <div className="rounded-lg border border-brand-border bg-brand-surface p-8">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Premium</h3>
              <p className="text-sm text-text-muted mb-6">Para redes e franquias</p>
              <p className="text-3xl font-bold text-brand-gold mb-6">
                R$ 397<span className="text-sm text-text-muted">/mês</span>
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Clientes ilimitados
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Multi-unidade
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  IA enterprise
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  API customizada
                </li>
                <li className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold" />
                  Suporte 24/7
                </li>
              </ul>
              <Link
                href="/register?niche=barbearia&plan=premium"
                className="w-full inline-flex items-center justify-center bg-brand-surface-2 text-text-primary font-medium px-4 py-2.5 rounded-lg hover:bg-brand-surface-3 transition-colors"
              >
                Começar grátis
              </Link>
            </div>
          </div>
          <p className="text-center text-sm text-text-muted mt-8">
            Todos os planos incluem <strong>7 dias grátis</strong>. Sem cartão de crédito.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-brand-surface-2/40">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-text-primary">
            Pronto para recuperar seus clientes?
          </h2>
          <p className="text-lg text-text-muted">
            Começa grátis. Sem surpresas. Setup em 5 minutos.
          </p>
          <Link
            href="/register?niche=barbearia"
            className="inline-flex items-center gap-2 bg-brand-gold text-brand-bg font-semibold px-8 py-4 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all text-lg"
          >
            Criar conta gratuita
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-text-muted">
          <p>© 2026 Nexora. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-text-primary transition-colors">
              Privacidade
            </a>
            <a href="#" className="hover:text-text-primary transition-colors">
              Termos
            </a>
            <a href="#" className="hover:text-text-primary transition-colors">
              Contato
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
