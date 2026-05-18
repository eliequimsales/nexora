'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Heurísticas conservadoras baseadas em médias do setor de barbearia:
// - INACTIVE_RATE: % de clientes que costumam parar de voltar mensalmente
// - RECOVERABLE_RATE: % desses inativos que respondem à reativação bem feita
// Esses números são intencionalmente conservadores para evitar promessa enganosa.
const INACTIVE_RATE = 0.3;
const RECOVERABLE_RATE = 0.2;

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
  const [hasWhatsappList, setHasWhatsappList] = useState<boolean | null>(null);

  // Cálculos
  const monthlyInactives = useMemo(
    () => Math.round(clientsPerMonth * INACTIVE_RATE),
    [clientsPerMonth],
  );

  const monthlyRecoverableCustomers = useMemo(
    () => Math.round(monthlyInactives * RECOVERABLE_RATE),
    [monthlyInactives],
  );

  const monthlyRecoverableRevenue = useMemo(
    () => monthlyRecoverableCustomers * avgTicket,
    [monthlyRecoverableCustomers, avgTicket],
  );

  const yearlyLoss = useMemo(
    () => monthlyInactives * avgTicket * 12,
    [monthlyInactives, avgTicket],
  );

  const ctaUrl = `/register?niche=barbearia&utm_source=diagnostico&potencial=${monthlyRecoverableRevenue}`;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Top bar */}
      <nav className="border-b border-brand-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-gold">N</span>
            <span className="text-lg font-bold text-text-primary">exora</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Entrar
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress */}
        {step !== 'result' && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded ${
                    n <= step ? 'bg-brand-gold' : 'bg-brand-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-text-muted">Passo {step} de 4</p>
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
                Veja o que descobrimos com base nas suas informações:
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

        {/* Step 1 */}
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
            <p className="text-xs text-text-muted mt-2">
              Conte cortes + serviços. Estimativa serve.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
            >
              Próximo
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2 */}
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
                  className="px-3 py-1 text-xs rounded-full border border-brand-border hover:bg-brand-surface-2 text-text-secondary"
                >
                  R$ {preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 border border-brand-border rounded-lg text-text-secondary hover:bg-brand-surface-2"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
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
                  className={`px-4 py-3 rounded-lg border text-left ${
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
              <button
                onClick={() => setStep(2)}
                className="px-4 py-3 border border-brand-border rounded-lg text-text-secondary hover:bg-brand-surface-2"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Você já tem o número de WhatsApp dos seus clientes?
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setHasWhatsappList(true)}
                className={`w-full px-4 py-3 rounded-lg border text-left ${
                  hasWhatsappList === true
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold font-semibold'
                    : 'border-brand-border bg-brand-surface-2 text-text-secondary hover:bg-brand-surface'
                }`}
              >
                Sim, tenho uma lista
              </button>
              <button
                onClick={() => setHasWhatsappList(false)}
                className={`w-full px-4 py-3 rounded-lg border text-left ${
                  hasWhatsappList === false
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold font-semibold'
                    : 'border-brand-border bg-brand-surface-2 text-text-secondary hover:bg-brand-surface'
                }`}
              >
                Ainda não tenho
              </button>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-3 border border-brand-border rounded-lg text-text-secondary hover:bg-brand-surface-2"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('result')}
                disabled={hasWhatsappList === null}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ver meu diagnóstico
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {step === 'result' && (
          <div className="space-y-4">
            {/* Big number */}
            <div className="rounded-xl border-2 border-status-error/40 bg-status-error-muted/20 p-6 text-center">
              <p className="text-sm text-status-error font-semibold uppercase tracking-widest mb-2">
                Você pode estar perdendo até
              </p>
              <p className="text-5xl font-bold text-status-error">
                {formatCurrency(yearlyLoss)}
              </p>
              <p className="text-sm text-text-muted mt-2">por ano em clientes que somem</p>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">
                💡 Onde tá esse dinheiro
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Clientes que somem por mês</span>
                  <span className="font-semibold text-text-primary">
                    ~{monthlyInactives} clientes
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Receita perdida por mês</span>
                  <span className="font-semibold text-status-error">
                    {formatCurrency(monthlyInactives * avgTicket)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                  <span className="text-text-secondary">Clientes recuperáveis (estimativa)</span>
                  <span className="font-semibold text-text-primary">
                    ~{monthlyRecoverableCustomers}/mês
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary font-semibold">Você pode recuperar</span>
                  <span className="font-bold text-status-success text-lg">
                    {formatCurrency(monthlyRecoverableRevenue)}/mês
                  </span>
                </div>
              </div>
              <p className="text-2xs text-text-muted mt-4 italic">
                * Estimativa conservadora: 30% dos clientes deixam de voltar mensalmente; 20% desses
                respondem positivamente a uma campanha de reativação bem feita. Resultados reais
                variam por barbearia.
              </p>
            </div>

            {/* Solution */}
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
                  Envia direto pelo WhatsApp da sua barbearia
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  Mostra exatamente quanto dinheiro voltou pro caixa
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Link
              href={ctaUrl}
              className="block w-full text-center bg-brand-gold text-brand-bg font-semibold px-6 py-4 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all"
            >
              Quero recuperar esses clientes — Teste grátis por 7 dias
            </Link>

            <p className="text-center text-xs text-text-muted">
              Sem cartão de crédito · Cancela quando quiser
            </p>

            {/* Whatsapp warning */}
            {hasWhatsappList === false && (
              <div className="rounded-lg border border-status-warning-border bg-status-warning-muted/30 p-4 flex gap-3">
                <AlertTriangle size={16} className="text-status-warning shrink-0 mt-0.5" />
                <div className="text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary mb-1">
                    Sem lista de WhatsApp? Sem problema.
                  </p>
                  <p>
                    A Nexora ajuda você a montar sua lista a partir dos atendimentos atuais. Em 30
                    dias você já tem clientes para reativar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
