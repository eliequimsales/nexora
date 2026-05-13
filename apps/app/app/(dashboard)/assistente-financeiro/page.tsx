'use client';

import { useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { HealthCard } from '@/components/AssisteFinanceiro/HealthCard';
import { ChurnCard } from '@/components/AssisteFinanceiro/ChurnCard';
import { AICard } from '@/components/AssisteFinanceiro/AICard';
import { RecoveryCard } from '@/components/AssisteFinanceiro/RecoveryCard';
import { ActionPanel } from '@/components/AssisteFinanceiro/ActionPanel';
import { useAssisteFinanceiro } from '@/hooks/useAssisteFinanceiro';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import type { ChurnedCustomerResponse } from '@/lib/api/dashboard.api';

function LoadingState() {
  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-xl font-semibold text-text-primary mb-6">Assistente Financeiro</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-brand-border bg-brand-surface p-5 h-40 skeleton" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-xl font-semibold text-text-primary mb-6">Assistente Financeiro</h1>
      <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3">
        <AlertTriangle size={16} className="text-status-warning mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-status-warning">Erro ao carregar dados</p>
          <p className="text-xs text-text-muted mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  );
}

function NotActivatedState() {
  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-xl font-semibold text-text-primary mb-6">Assistente Financeiro</h1>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-8 text-center">
        <Sparkles size={32} className="text-brand-amber mx-auto mb-3 opacity-50" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Ative o Assistente Financeiro
        </h2>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          O Assistente Financeiro analisa o risco de churn dos seus clientes e sugere ações de recuperação baseadas em IA.
        </p>
        <p className="text-xs text-text-muted mt-3">
          Vá até Configurações para ativar essa funcionalidade.
        </p>
      </div>
    </div>
  );
}

export default function AssisteFinanceiroPage() {
  const { data: org } = useOrgQuery();
  const subscriptionId = org?.id;

  const { dashboard, churned, loading, error } = useAssisteFinanceiro(subscriptionId ?? '');

  const [selectedCustomer, setSelectedCustomer] = useState<ChurnedCustomerResponse | null>(null);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error instanceof Error ? error.message : 'Tente novamente mais tarde.'} />;
  }

  // Not activated state
  if (!dashboard) {
    return <NotActivatedState />;
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Assistente Financeiro</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Acompanhe a saúde financeira e recupere clientes em risco.
        </p>
      </div>

      {/* Action Panel (if customer selected) */}
      {selectedCustomer && (
        <div className="mb-6">
          <ActionPanel
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
          />
        </div>
      )}

      {/* Main Grid - Row 1: Health + Recovery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* HealthCard */}
        <div className="lg:col-span-2">
          <HealthCard
            goalAmount={dashboard.goalAmount}
            revenueActual={dashboard.revenueActual}
            revenueProjected={dashboard.revenueProjected}
            goalAchievementPercent={dashboard.goalAchievementPercent}
          />
        </div>

        {/* RecoveryCard */}
        <div>
          <RecoveryCard
            recoveredThisMonth={dashboard.recoveredCustomersThisMonth}
            successRate={dashboard.recoverySuccessRate}
          />
        </div>
      </div>

      {/* Main Grid - Row 2: Churn + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ChurnCard */}
        <div className="lg:col-span-2">
          <ChurnCard
            customers={churned}
            onSelectCustomer={setSelectedCustomer}
          />
        </div>

        {/* AICard */}
        <div>
          <AICard
            metrics={dashboard.aiMetrics}
          />
        </div>
      </div>
    </div>
  );
}
