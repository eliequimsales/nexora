'use client';

import { useSearchParams } from 'next/navigation';
import { CreditCard, ExternalLink, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { PlanCard } from '@/components/modules/billing/PlanCard';
import { UsageMeter } from '@/components/modules/billing/UsageMeter';
import { useBillingSummary } from '@/lib/hooks/billing/useBillingSummary';
import { useCreateCheckoutSession } from '@/lib/hooks/billing/useCreateCheckoutSession';
import { useCreatePortalSession } from '@/lib/hooks/billing/useCreatePortalSession';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '',
    monthlyPrice: 'R$ 97',
    limits: { leadsPerMonth: 200, aiExecPerMonth: 500, maxUsers: 3 },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
    monthlyPrice: 'R$ 297',
    limits: { leadsPerMonth: 2000, aiExecPerMonth: 10000, maxUsers: 10 },
  },
  {
    id: 'business',
    name: 'Business',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? '',
    monthlyPrice: 'R$ 697',
    limits: { leadsPerMonth: 20000, aiExecPerMonth: 100000, maxUsers: 50 },
  },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Trial',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
};

export default function BillingPage() {
  const { data, isLoading, isError } = useBillingSummary();
  const checkout = useCreateCheckoutSession();
  const portal = useCreatePortalSession();
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === '1';
  const canceled = searchParams.get('canceled') === '1';

  // Pilot mode: Stripe not configured yet
  const isStripeConfigured = !!(
    process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER &&
    process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER !== ''
  );

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner variant="amber" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-status-error">Erro ao carregar informações de billing.</p>
      </div>
    );
  }

  const currentPlan = data?.plan ?? null;
  const limits = data?.limits;
  const usage = data?.usage;

  return (
    <div className="p-6 max-w-2xl">
      {/* Pilot period banner — shown when Stripe is not yet configured */}
      {!isStripeConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-gold/40 bg-brand-gold/5 p-4 mb-5">
          <Sparkles size={16} className="text-brand-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-gold">Período de piloto — acesso gratuito</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Durante o piloto você tem acesso completo à Nexora sem custo. Quando lançarmos a cobrança, você receberá um aviso com antecedência mínima de 15 dias.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 mb-5 text-sm text-green-400">
          <CheckCircle size={15} />
          Assinatura ativada com sucesso! Obrigado.
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-2.5 rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-3 mb-5 text-sm text-text-secondary">
          <XCircle size={15} />
          Checkout cancelado. Seu plano não foi alterado.
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-6">
        <CreditCard size={18} className="text-text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Plano e cobrança</h1>
          <p className="text-xs text-text-muted">Gerencie sua assinatura e veja o uso do mês</p>
        </div>
      </div>

      {/* Current subscription status */}
      {data?.status && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted mb-0.5">Status da assinatura</p>
              <p className="text-sm font-medium text-text-primary capitalize">
                {STATUS_LABELS[data.status] ?? data.status}
              </p>
            </div>
            {data.currentPeriodEnd && (
              <div className="text-right">
                <p className="text-xs text-text-muted mb-0.5">Próxima cobrança</p>
                <p className="text-xs text-text-secondary">
                  {new Date(data.currentPeriodEnd).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {data.plan !== null && data.status !== 'canceled' && (
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
                className="flex items-center gap-1.5 text-xs text-brand-amber hover:underline"
              >
                <ExternalLink size={12} />
                Gerenciar assinatura no portal
              </button>
              <button
                onClick={() => {
                  if (confirm('Cancelar sua assinatura? O acesso continua até o fim do período pago.')) {
                    portal.mutate();
                  }
                }}
                disabled={portal.isPending}
                className="text-xs text-status-error hover:underline"
              >
                Cancelar plano
              </button>
            </div>
          )}
        </div>
      )}

      {/* Usage this month */}
      {usage && limits && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mb-4">
          <h2 className="text-sm font-medium text-text-primary mb-4">Uso este mês</h2>
          <div className="space-y-4">
            <UsageMeter
              label="Clientes adicionados"
              current={usage.leadsThisMonth}
              max={limits.leadsPerMonth}
            />
            <UsageMeter
              label="Execuções de IA"
              current={usage.aiExecThisMonth}
              max={limits.aiExecPerMonth}
            />
            <UsageMeter
              label="Usuários ativos"
              current={usage.usersCount}
              max={limits.maxUsers}
            />
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-medium text-text-primary mb-3">Planos disponíveis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              {...plan}
              isActive={currentPlan === plan.id}
              onUpgrade={(priceId) => checkout.mutate(priceId)}
              isLoading={checkout.isPending}
            />
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Pagamentos processados com segurança pelo Stripe. Cancele a qualquer momento.
        </p>
      </div>
    </div>
  );
}
