'use client';

import { useState } from 'react';
import { BarChart2, Users, FileText, Sparkles, GitBranch } from 'lucide-react';
import { PeriodSelector } from '@/components/modules/analytics/PeriodSelector';
import { MetricCard } from '@/components/modules/analytics/MetricCard';
import { FunnelBar } from '@/components/modules/analytics/FunnelBar';
import { AiInsightCard } from '@/components/modules/analytics/AiInsightCard';
import { ProposalStatsRow } from '@/components/modules/analytics/ProposalStatsRow';
import { AiStatsRow } from '@/components/modules/analytics/AiStatsRow';
import { useAnalyticsSummary } from '@/lib/hooks/analytics/useAnalyticsSummary';
import { useAnalyticsFunnel } from '@/lib/hooks/analytics/useAnalyticsFunnel';
import { useAnalyticsProposals } from '@/lib/hooks/analytics/useAnalyticsProposals';
import { useAnalyticsAi } from '@/lib/hooks/analytics/useAnalyticsAi';
import { useAiInsight } from '@/lib/hooks/analytics/useAiInsight';
import type { AnalyticsPeriod } from '@/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} className="text-text-muted" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');

  const { data: summary, isLoading: loadingSummary } = useAnalyticsSummary(period);
  const { data: funnel, isLoading: loadingFunnel } = useAnalyticsFunnel();
  const { data: proposalStats, isLoading: loadingProposals } = useAnalyticsProposals(period);
  const { data: aiStats, isLoading: loadingAi } = useAnalyticsAi(period);
  const { text: insightText, isLoading: loadingInsight, isError: insightError, errorMessage: insightErrorMessage, generate } = useAiInsight();

  const conversionRate =
    summary && summary.leads.total > 0
      ? Math.round((summary.leads.closedWon / summary.leads.total) * 100)
      : 0;

  function handleGenerateInsight() {
    generate({ period });
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Visão da operação por período.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* AI Insight */}
      <AiInsightCard
        text={insightText}
        isLoading={loadingInsight}
        isError={insightError}
        errorMessage={insightErrorMessage}
        onGenerate={handleGenerateInsight}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Leads no período"
          value={summary?.leads.total ?? 0}
          sub={`${summary?.leads.hot ?? 0} quentes`}
          loading={loadingSummary}
        />
        <MetricCard
          label="Taxa de conversão"
          value={`${conversionRate}%`}
          sub={`${summary?.leads.closedWon ?? 0} fechados`}
          trend={conversionRate >= 20 ? 'up' : conversionRate > 0 ? 'neutral' : undefined}
          loading={loadingSummary}
        />
        <MetricCard
          label="Propostas aceitas"
          value={summary?.proposals.accepted ?? 0}
          sub={`${summary?.proposals.acceptanceRate ?? 0}% de aceitação`}
          trend={
            (summary?.proposals.acceptanceRate ?? 0) >= 30
              ? 'up'
              : (summary?.proposals.acceptanceRate ?? 0) > 0
              ? 'neutral'
              : undefined
          }
          loading={loadingSummary}
        />
        <MetricCard
          label="Receita fechada"
          value={formatCurrency(summary?.proposals.totalAcceptedRevenue ?? 0)}
          sub={`${summary?.proposals.total ?? 0} propostas`}
          loading={loadingSummary}
        />
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pipeline funnel */}
        <div className="lg:col-span-3 rounded-xl border border-brand-border bg-brand-surface p-5">
          <SectionHeader icon={GitBranch} title="Funil do pipeline" />
          <FunnelBar stages={funnel ?? []} loading={loadingFunnel} />
        </div>

        {/* Lead breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-surface p-5">
          <SectionHeader icon={Users} title="Leads por classificação" />
          {loadingSummary ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 skeleton w-16" />
                  <div className="h-3 skeleton w-8" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: 'Quentes', value: summary?.leads.hot ?? 0, color: '#ef4444' },
                { label: 'Mornos', value: summary?.leads.warm ?? 0, color: '#f97316' },
                { label: 'Frios', value: summary?.leads.cold ?? 0, color: '#6b7280' },
                { label: 'Sem classificação', value: summary?.leads.unclassified ?? 0, color: '#9ca3af' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="text-xs text-text-secondary">{row.label}</span>
                  </div>
                  <span className="text-xs font-medium text-text-primary">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proposals + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <SectionHeader icon={FileText} title="Propostas" />
          <ProposalStatsRow data={proposalStats} loading={loadingProposals} />
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <SectionHeader icon={Sparkles} title="IA & Automação" />
          <AiStatsRow data={aiStats} loading={loadingAi} />
          {!loadingSummary && summary && (
            <div className="mt-4 pt-4 border-t border-brand-border flex gap-6">
              <div>
                <p className="text-2xs text-text-muted uppercase tracking-wider mb-0.5">Workflows executados</p>
                <p className="text-base font-semibold text-text-primary">{summary.workflows.executionsTotal}</p>
                <p className="text-xs text-text-muted">{summary.workflows.successRate}% sucesso</p>
              </div>
              <div>
                <p className="text-2xs text-text-muted uppercase tracking-wider mb-0.5">Execuções de IA</p>
                <p className="text-base font-semibold text-text-primary">{summary.ai.executionsTotal}</p>
                <p className="text-xs text-text-muted">{summary.ai.successRate}% sucesso</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
