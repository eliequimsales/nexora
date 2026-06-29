'use client';

import Link from 'next/link';
import { TrendingUp, Users, BarChart3, DollarSign } from 'lucide-react';
import { StatCard } from './StatCard';
import { useNexoraMetrics } from '@/lib/hooks/dashboard/useNexoraMetrics';
import { ActivityFeed } from './ActivityFeed';
import { PilotWelcomeBanner } from '@/components/modules/onboarding/PilotWelcomeBanner';
import { cn } from '@/lib/utils';

/**
 * Dashboard especializad para Nexora — foco total em recuperação de clientes.
 * Substitui o dashboard genérico quando em modo Nexora.
 *
 * Mostra:
 * - Clientes inativos (30+ dias)
 * - Recuperados hoje e este mês
 * - R$ estimado de receita recuperável
 * - Taxa de sucesso (% de resposta)
 */
export function NexoraDashboard({ slug }: { slug: string }) {
  const { data: metrics, isLoading } = useNexoraMetrics();
  const recovery = metrics?.recovery;

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-4 sm:space-y-6">
      <PilotWelcomeBanner />

      {/* Greeting */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
          🎯 Dashboard de Recuperação
        </h2>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          Acompanhe clientes perdidos e o potencial de recuperação em tempo real.
        </p>
      </div>

      {/* KPI Grid — 4 cards em destaque (Receita Recuperada é o KPI rei) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inativos */}
        <StatCard
          label="Clientes inativos"
          value={recovery?.inactiveCount ?? 0}
          sub="30+ dias sem contato"
          variant="warning"
          icon={<Users size={14} />}
          loading={isLoading}
        />

        {/* RECEITA RECUPERADA (real, este mês) — métrica que retém o cliente */}
        <div className="rounded-lg border-2 border-status-success/40 bg-status-success-muted/20 p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest text-status-success font-semibold">
                Receita recuperada
              </p>
              <p
                className={cn(
                  'text-2xl font-bold mt-2',
                  isLoading
                    ? 'animate-pulse bg-brand-surface-2 rounded w-24 h-7'
                    : 'text-status-success',
                )}
              >
                {!isLoading && (
                  <>R${(recovery?.realRecoveredRevenue ?? 0).toLocaleString('pt-BR')}</>
                )}
              </p>
              <p className="text-xs text-text-muted mt-2">
                {recovery?.confirmedRecoveriesThisMonth ?? 0} clientes voltaram este mês
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-status-success-muted flex items-center justify-center shrink-0">
              <DollarSign size={16} className="text-status-success" />
            </div>
          </div>
        </div>

        {/* Taxa de resposta */}
        <StatCard
          label="Taxa de resposta"
          value={`${recovery?.successRate ?? 0}%`}
          sub="este mês"
          variant="ai"
          icon={<BarChart3 size={14} />}
          loading={isLoading}
        />

        {/* Potencial em aberto (estimativa) */}
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest text-text-muted font-medium">
                Potencial em aberto
              </p>
              <p
                className={cn(
                  'text-2xl font-bold mt-2',
                  isLoading ? 'animate-pulse bg-brand-surface-2 rounded w-24 h-7' : 'text-text-primary',
                )}
              >
                {!isLoading && (
                  <>R${(recovery?.estimatedRevenue ?? 0).toLocaleString('pt-BR')}</>
                )}
              </p>
              <p className="text-xs text-text-muted mt-2">
                Estimativa baseada no ticket médio configurado
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-surface-2 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-text-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary row — Estatísticas do mês */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          📊 Resumo do mês
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Mensagens hoje</p>
            <p className="text-lg font-semibold text-text-primary">
              {recovery?.recoveredToday ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Tentativas mês</p>
            <p className="text-lg font-semibold text-text-primary">
              {recovery?.recoveredThisMonth ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Confirmados</p>
            <p className="text-lg font-semibold text-status-success">
              {recovery?.confirmedRecoveriesThisMonth ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Ação rápida</p>
            <Link
              href={`/${slug}/clientes`}
              className="inline-flex text-xs font-semibold text-brand-gold hover:text-brand-gold/80 transition-colors"
            >
              Ver clientes →
            </Link>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Atividade recente</h3>
          <span className="text-2xs text-text-muted">Atualiza a cada 30s</span>
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}
