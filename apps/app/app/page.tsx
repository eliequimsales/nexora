import type { Metadata } from 'next';
import { ArrowRight, Check, MessageSquare, Upload, Eye, Copy } from 'lucide-react';
import Link from 'next/link';
import { DashboardMockup } from '@/components/landing/DashboardMockup';

export const metadata: Metadata = {
  title: 'Nexora — Recupere clientes inativos do seu negócio',
  description:
    'A Nexora analisa sua lista de clientes, identifica quem sumiu há 30+ dias e escreve a mensagem pronta pra você copiar no WhatsApp. Setup em menos de 1 hora.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Nexora — Recupere clientes inativos do seu negócio',
    description: 'Descubra agora quantos clientes seu negócio perdeu e quanto isso custa por mês.',
    type: 'website',
  },
};

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
          <div className="flex items-center gap-5">
            <Link
              href="/diagnostico"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Diagnóstico grátis
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-brand-gold hover:text-brand-gold/80 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl lg:text-6xl font-bold text-text-primary leading-tight">
            Quantos clientes você perdeu{' '}
            <span className="text-brand-gold">nos últimos 30 dias sem perceber?</span>
          </h1>
          <p className="text-xl text-text-muted max-w-2xl mx-auto">
            A Nexora analisa sua lista, identifica quem sumiu há 30+ dias e escreve a mensagem
            pronta pra você copiar no WhatsApp — sem sistema de agendamento, sem integração.
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
              href="/register"
              className="px-6 py-3 border border-brand-border rounded-lg text-text-primary font-medium hover:bg-brand-surface transition-colors"
            >
              Criar conta grátis
            </Link>
          </div>
          <p className="text-xs text-text-muted pt-2">
            Sem cartão. Cancela quando quiser. Trial gratuito por 7 dias.
          </p>
        </div>
      </section>

      {/* Product Mockup — prévia visual do dashboard */}
      <section className="px-6 pb-12 -mt-2">
        <div className="max-w-4xl mx-auto">
          <DashboardMockup />
        </div>
      </section>

      {/* Stats Section — métricas defensáveis */}
      <section className="px-6 py-12 bg-brand-surface-2/30">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-brand-gold">30s</p>
            <p className="text-sm text-text-muted mt-1">Mensagem gerada pela IA</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-gold">&lt; 1h</p>
            <p className="text-sm text-text-muted mt-1">Setup completo</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-gold">0</p>
            <p className="text-sm text-text-muted mt-1">Integrações necessárias</p>
          </div>
        </div>
      </section>

      {/* Como funciona — 3 passos */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">
            Como funciona
          </h2>
          <p className="text-center text-text-muted mb-12">3 passos. Sem complicação.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center mx-auto">
                <Upload size={24} className="text-brand-gold" />
              </div>
              <div>
                <p className="text-brand-gold font-bold text-sm mb-1">PASSO 1</p>
                <h3 className="font-semibold text-text-primary mb-2">Sobe sua lista</h3>
                <p className="text-sm text-text-muted">
                  Exporta do seu sistema, planilha ou anota no Excel. Qualquer formato.
                  Importa em 1 clique.
                </p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center mx-auto">
                <Eye size={24} className="text-brand-purple" />
              </div>
              <div>
                <p className="text-brand-purple font-bold text-sm mb-1">PASSO 2</p>
                <h3 className="font-semibold text-text-primary mb-2">Nexora identifica quem sumiu</h3>
                <p className="text-sm text-text-muted">
                  A IA varre a lista e aponta quem não volta há 30+ dias, com o tempo exato de
                  ausência.
                </p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-status-success-muted border border-status-success/30 flex items-center justify-center mx-auto">
                <Copy size={24} className="text-status-success" />
              </div>
              <div>
                <p className="text-status-success font-bold text-sm mb-1">PASSO 3</p>
                <h3 className="font-semibold text-text-primary mb-2">Copia e manda no WhatsApp</h3>
                <p className="text-sm text-text-muted">
                  A mensagem já está escrita, com o nome do cliente. Você copia e envia do seu
                  próprio número. Simples.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Exemplo de mensagem real — o diferencial */}
      <section className="px-6 py-16 bg-brand-surface-2/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">
            Essa é a mensagem que a IA escreve
          </h2>
          <p className="text-center text-text-muted mb-10">
            Personalizada com o nome real do cliente e o tempo de ausência. Você só copia.
          </p>
          {/* Mock do WhatsApp */}
          <div className="max-w-sm mx-auto">
            <div className="rounded-2xl bg-[#111B21] p-4 shadow-xl border border-white/5">
              {/* Header do chat */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-sm">
                  J
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">João Silva</p>
                  <p className="text-white/40 text-xs">cliente</p>
                </div>
              </div>
              {/* Bolha de mensagem */}
              <div className="flex justify-end">
                <div className="bg-[#005C4B] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow">
                  <p className="text-white text-sm leading-relaxed">
                    Oi João, tudo bem? 😊
                    <br /><br />
                    Faz 47 dias que você não aparece por aqui. Tô à disposição pra te
                    atender quando você quiser!
                    <br /><br />
                    Quer marcar um horário essa semana?
                  </p>
                  <p className="text-white/40 text-[10px] text-right mt-1">✓✓</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-text-muted mt-6">
            Enviada do <strong className="text-text-secondary">seu</strong> número de WhatsApp.{' '}
            Nenhuma integração ou API necessária.
          </p>
        </div>
      </section>

      {/* Por que funciona */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            Por que Nexora funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-purple/15 flex items-center justify-center mb-4">
                <MessageSquare size={20} className="text-brand-purple" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Mensagem com nome real do cliente
              </h3>
              <p className="text-sm text-text-muted">
                Não é template genérico. A IA usa o nome, o tempo de ausência e o tom certo pra
                cada situação. Parece que você escreveu.
              </p>
            </div>

            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/15 flex items-center justify-center mb-4">
                <Eye size={20} className="text-brand-gold" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Você vê antes de enviar
              </h3>
              <p className="text-sm text-text-muted">
                A mensagem aparece na tela. Você lê, aprova ou edita. Depois copia e manda do
                seu próprio WhatsApp. Controle total.
              </p>
            </div>

            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-amber/15 flex items-center justify-center mb-4">
                <Upload size={20} className="text-brand-amber" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Funciona com qualquer lista
              </h3>
              <p className="text-sm text-text-muted">
                Excel, planilha, exportação do seu sistema ou digitado na mão. Aceita CSV ou
                XLSX. Sem integração, sem API.
              </p>
            </div>

            <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
              <div className="w-10 h-10 rounded-lg bg-status-success-muted flex items-center justify-center mb-4">
                <Check size={20} className="text-status-success" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">
                Você corta. A Nexora faz o cliente lembrar que está com saudade.
              </h3>
              <p className="text-sm text-text-muted">
                Foca no que você faz de melhor. A Nexora descobre quem sumiu e prepara a
                abordagem certa pra cada cliente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plano único — sem confusão */}
      <section className="px-6 py-20 bg-brand-surface-2/30">
        <div className="max-w-lg mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">
            Um plano. Sem pegadinha.
          </h2>
          <p className="text-center text-text-muted mb-10">
            7 dias grátis. Depois R$ 97/mês.
          </p>
          <div className="rounded-xl border border-brand-gold/50 bg-brand-surface p-8 shadow-lg">
            <div className="text-center mb-6">
              <p className="text-4xl font-bold text-brand-gold">
                R$ 97<span className="text-lg text-text-muted font-normal">/mês</span>
              </p>
              <p className="text-text-muted text-sm mt-1">
                R$ 3,20 por dia — menos que um café
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                'Clientes ilimitados',
                'Mensagens geradas pela IA',
                'Import CSV e XLSX',
                'Detecção de inativos (30+ dias)',
                'Dashboard com métricas',
                'Suporte por email',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-text-secondary">
                  <Check size={14} className="text-brand-gold shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            {/* Argumento de ROI */}
            <div className="rounded-lg bg-brand-gold/10 border border-brand-gold/20 p-4 mb-6 text-center">
              <p className="text-sm text-brand-gold font-medium">
                Se recuperar 1 cliente por mês, o plano já se paga.
              </p>
              <p className="text-xs text-text-muted mt-1">
                Dependendo do seu ticket, um cliente recuperado já cobre o mês.
              </p>
            </div>
            <Link
              href="/register"
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90 transition-colors"
            >
              Começar 7 dias grátis
              <ArrowRight size={16} />
            </Link>
            <p className="text-center text-xs text-text-muted mt-3">
              Sem cartão de crédito. Cancela quando quiser.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-center text-text-muted mb-10">As dúvidas que todo dono de negócio tem antes de começar.</p>
          <div className="space-y-3">
            {[
              {
                q: 'Preciso ter sistema de agendamento?',
                a: 'Não. A Nexora funciona com qualquer lista de clientes — Excel, planilha do Google, exportação do seu sistema ou até digitado na mão. Se você tem os nomes e números, já dá pra começar.',
              },
              {
                q: 'Como importo meus clientes?',
                a: 'Você sobe um arquivo CSV ou XLSX com nome, telefone e data do último atendimento. Em 1 clique a Nexora já identifica quem está inativo.',
              },
              {
                q: 'E se o cliente pedir pra parar de receber mensagem?',
                a: 'Você simplesmente não manda mais. Como você envia pelo seu próprio WhatsApp, tem controle total. Nenhuma mensagem sai sem você ver e aprovar primeiro.',
              },
              {
                q: 'A Nexora envia as mensagens automaticamente?',
                a: 'Não. A IA escreve a mensagem pronta pra você — você lê, aprova e envia do seu próprio número. Zero integração, zero risco de spam.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-medium text-text-primary text-sm gap-4">
                  {q}
                  <span className="text-brand-gold shrink-0 group-open:rotate-45 transition-transform duration-150 text-lg font-light">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-text-primary">
            Descubra agora quanto seu negócio está perdendo
          </h2>
          <p className="text-lg text-text-muted">
            Faça o diagnóstico grátis. Em 1 minuto você vê quantos clientes sumiram e quanto
            isso representa em receita.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/diagnostico"
              className="inline-flex items-center gap-2 bg-brand-gold text-brand-bg font-semibold px-8 py-4 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all text-lg"
            >
              Fazer diagnóstico grátis
              <ArrowRight size={18} />
            </Link>
          </div>
          <p className="text-sm text-text-muted">
            Ou{' '}
            <Link href="/register" className="text-brand-gold hover:underline">
              crie sua conta e importe sua lista agora
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-text-muted flex-wrap gap-4">
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
