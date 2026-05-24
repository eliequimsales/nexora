'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, TrendingDown, CheckCircle2, Mail } from 'lucide-react';

const INACTIVE_RATE = 0.3;
const RECOVERABLE_RATE = 0.2;
const NEXORA_PRICE = 97;

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

type Step = 1 | 2 | 3 | 4 | 'result';

export default function DiagnosticoPage() {
  const [step, setStep] = useState<Step>(1);
  const [clientsPerMonth, setClientsPerMonth] = useState(150);
  const [avgTicket, setAvgTicket] = useState(50);
  const [returnDays, setReturnDays] = useState(30);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const monthlyInactives = useMemo(
    () => Math.round(clientsPerMonth * INACTIVE_RATE),
    [clientsPerMonth],
  );

  const monthlyLoss = useMemo(
    () => monthlyInactives * avgTicket,
    [monthlyInactives, avgTicket],
  );

  const yearlyLoss = useMemo(() => monthlyLoss * 12, [monthlyLoss]);

  const monthlyRecoverableCustomers = useMemo(
    () => Math.round(monthlyInactives * RECOVERABLE_RATE),
    [monthlyInactives],
  );

  const monthlyRecoverableRevenue = useMemo(
    () => monthlyRecoverableCustomers * avgTicket,
    [monthlyRecoverableCustomers, avgTicket],
  );

  const roi = useMemo(
    () => Math.round(monthlyRecoverableRevenue / NEXORA_PRICE),
    [monthlyRecoverableRevenue],
  );

  const ctaUrl = `/register?niche=barbearia&utm_source=diagnostico&email=${encodeURIComponent(email)}&potencial=${monthlyRecoverableRevenue}`;

  function handleEmailSubmit() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Insira um email válido.');
      return;
    }
    setEmailError('');
    setStep('result');
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="border-b border-brand-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            <span className="text-brand-gold">N</span>
            <span className="text-text-primary">exora</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Entrar
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress — 3 steps + email = 4 */}
        {step !== 'result' && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded transition-colors ${
                    n <= (step === 4 ? 4 : Number(step)) ? 'bg-brand-gold' : 'bg-brand-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Passo {step} de 4
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 text-center">
          {step === 'result' ? (
            <>
              <div className="inline-flex w-12 h-12 rounded-full bg-status-warning-muted items-center justify-center mb-4">
                <TrendingDown size={20} className="text-status-warning" />
              </div>
              <h1 className="text-3xl font-bold text-text-primary">
                Sua barbearia está perdendo dinheiro
              </h1>
              <p className="text-text-muted mt-2">
                Veja o que encontramos com base nas suas informações:
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex w-12 h-12 rounded-full bg-brand-gold/10 items-center justify-center mb-4">
                <Calculator size={20} className="text-brand-gold" />
              </div>
              <h1 className="text-3xl font-bold text-text-primary">
                Diagnóstico de clientes perdidos
              </h1>
              <p className="text-text-muted mt-2">
                Em 1 minuto descubra quanto sua barbearia pode estar deixando na mesa.
              </p>
            </>
          )}
        </div>

        {/* Step 1 — clientes por mês */}
        {step === 1 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Quantos clientes sua barbearia atende por mês?
            </label>
            <input
              type="number"
              min="1"
              max="3000"
              value={clientsPerMonth}
              onChange={(e) => setClientsPerMonth(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-lg"
              autoFocus
            />
            <p className="text-xs text-text-muted mt-2">Conte cortes + serviços. Estimativa serve.</p>
            <button
              onClick={() => setStep(2)}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
            >
              Próximo <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2 — ticket médio */}
        {step === 2 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Qual o ticket médio (R$ por cliente)?
            </label>
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-lg">R$</span>
              <input
                type="number"
                min="10"
                max="500"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Math.max(1, parseInt(e.target.value) || 0))}
                className="flex-1 px-4 py-3 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-lg"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-3">
              {[35, 50, 80, 120].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAvgTicket(preset)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    avgTicket === preset
                      ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                      : 'border-brand-border hover:bg-brand-surface-2 text-text-secondary'
                  }`}
                >
                  R$ {preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(1)} className="px-4 py-3 border border-brand-border rounded-lg text-text-secondary hover:bg-brand-surface-2">
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
              >
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — frequência */}
        {step === 3 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <label className="block text-sm font-semibold text-text-primary mb-3">
              De quanto em quanto tempo o cliente costuma voltar?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 15, label: '15 dias' },
                { value: 21, label: '3 semanas' },
                { value: 30, label: '1 mês' },
                { value: 45, label: '45 dias' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReturnDays(opt.value)}
                  className={`px-4 py-3 rounded-lg border text-left transition-colors ${
                    returnDays === opt.value
                      ? 'border-brand-gold bg-brand-gold/10 text-brand-gold font-semibold'
                      : 'border-brand-border bg-brand-surface-2 text-text-secondary hover:bg-brand-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(2)} className="px-4 py-3 border border-brand-border rounded-lg text-text-secondary hover:bg-brand-surface-2">
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
              >
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — captura de email antes do resultado */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Teaser do número — blur leve, fonte grande: cérebro reconhece que é alto */}
            <div className="rounded-xl border border-status-error/30 bg-status-error-muted/10 p-5 text-center">
              <p className="text-xs text-status-error font-semibold uppercase tracking-widest mb-1">
                Resultado calculado
              </p>
              <p className="text-6xl font-bold text-status-error select-none" style={{filter:'blur(6px)'}}>
                {formatCurrency(monthlyLoss)}/mês
              </p>
              <p className="text-xs text-text-muted mt-2">desbloqueie o diagnóstico completo abaixo</p>
            </div>

            {/* Email */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              {/* Prova social — ancoragem no momento de maior intenção */}
              <p className="text-center text-xs text-text-muted mb-4">
                🔒 Seu diagnóstico é <strong className="text-text-secondary">gratuito e sem compromisso</strong>
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                  <Mail size={16} className="text-brand-gold" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">
                    Onde enviamos o diagnóstico completo?
                  </p>
                  <p className="text-xs text-text-muted">
                    Seu relatório completo + dicas de recuperação no email
                  </p>
                </div>
              </div>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                className={`w-full px-4 py-3 border rounded-lg bg-brand-surface-2 text-text-primary ${
                  emailError ? 'border-status-error' : 'border-brand-border'
                }`}
                autoFocus
              />
              {emailError && (
                <p className="text-xs text-status-error mt-1">{emailError}</p>
              )}
              <button
                onClick={handleEmailSubmit}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all"
              >
                Ver meu diagnóstico completo
                <ArrowRight size={16} />
              </button>
              <p className="text-center text-xs text-text-muted mt-2">
                Sem spam. Cancelamento em 1 clique.
              </p>
            </div>

            <button onClick={() => setStep(3)} className="text-sm text-text-muted hover:text-text-secondary underline w-full text-center">
              ← Voltar
            </button>
          </div>
        )}

        {/* Result */}
        {step === 'result' && (
          <div className="space-y-4">
            {/* Número mensal em destaque — mais palpável que o anual */}
            <div className="rounded-xl border-2 border-status-error/40 bg-status-error-muted/20 p-6 text-center">
              <p className="text-sm text-status-error font-semibold uppercase tracking-widest mb-1">
                Você pode estar perdendo
              </p>
              <p className="text-5xl font-bold text-status-error">
                {formatCurrency(monthlyLoss)}<span className="text-2xl">/mês</span>
              </p>
              <p className="text-sm text-text-muted mt-2">
                {formatCurrency(yearlyLoss)}/ano em clientes que somem sem avisar
              </p>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">
                💡 De onde vem esse número
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Clientes que somem por mês</span>
                  <span className="font-semibold text-text-primary">~{monthlyInactives} clientes</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Receita que some com eles</span>
                  <span className="font-semibold text-status-error">{formatCurrency(monthlyLoss)}/mês</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Clientes recuperáveis (estimativa)</span>
                  <span className="font-semibold text-text-primary">~{monthlyRecoverableCustomers}/mês</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary font-semibold">Você pode recuperar</span>
                  <span className="font-bold text-status-success text-lg">{formatCurrency(monthlyRecoverableRevenue)}/mês</span>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-4 italic">
                * Estimativa conservadora: 30% dos clientes deixam de voltar mensalmente; 20% desses
                respondem a uma campanha de reativação bem feita. Resultados reais variam.
              </p>
            </div>

            {/* ROI explícito — não deixa o usuário calcular sozinho */}
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
              <h2 className="text-sm font-semibold text-brand-gold mb-3 uppercase tracking-wide">
                📊 O que a Nexora custa vs. o que ela traz
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-text-muted text-xs mb-1">Custo mensal</p>
                  <p className="font-bold text-text-primary">{formatCurrency(NEXORA_PRICE)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs mb-1">Potencial recuperado</p>
                  <p className="font-bold text-status-success">{formatCurrency(monthlyRecoverableRevenue)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs mb-1">ROI estimado</p>
                  <p className="font-bold text-brand-gold">{roi}x</p>
                </div>
              </div>
              <p className="text-xs text-text-muted text-center mt-3">
                Se recuperar <strong className="text-text-secondary">1 cliente por mês</strong>, o plano já se pagou.
              </p>
            </div>

            {/* Como Nexora resolve — copy corrigido */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h2 className="text-base font-semibold text-text-primary mb-3">
                ✂️ Como a Nexora resolve isso
              </h2>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  Identifica automaticamente quem parou de voltar
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  IA gera mensagem personalizada com o nome do cliente
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  Você copia a mensagem e envia do seu próprio WhatsApp — sem integração
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  Registra quem voltou e quanto entrou no caixa
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Link
              href={ctaUrl}
              className="block w-full text-center bg-brand-gold text-brand-bg font-semibold px-6 py-4 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all text-lg"
            >
              Quero recuperar esses clientes — Teste grátis por 7 dias
            </Link>

            <p className="text-center text-xs text-text-muted">
              Sem cartão de crédito · Cancela quando quiser
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
