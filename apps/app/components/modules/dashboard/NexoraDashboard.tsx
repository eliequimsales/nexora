'use client';

import Link from 'next/link';
import { TrendingUp, Users, BarChart3, DollarSign } from 'lucide-react';
import { StatCard } from './StatCard';
import { useNexoraMetrics } from '@/lib/hooks/dashboard/useNexoraMetrics';
import { ActivityFeed } from './ActivityFeed';
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
    <div className="p-6 max-w-6xl space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          🎯 Dashboard de Recuperação Nexora
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Acompanhe seus clientes perdidos e o potencial de recuperação em tempo real.
        </p>
      </div>

      {/* KPI Grid — 4 cards em destaque */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inativos */}
        <StatCard
          label="Clientes inativos"
          value={recovery?.inactiveCount ?? 0}
          sub="30+ dias sem contato"
          variant="warning"
          icon={<Users size={14} />}
          loading={isLoading}
        />

        {/* Recuperados hoje */}
        <StatCard
          label="Recuperados hoje"
          value={recovery?.recoveredToday ?? 0}
          sub="mensagens enviadas"
          variant="amber"
          icon={<TrendingUp size={14} />}
          loading={isLoading}
        />

        {/* Taxa de sucesso */}
        <StatCard
          label="Taxa de resposta"
          value={`${recovery?.successRate ?? 0}%`}
          sub="este mês"
          variant="ai"
          icon={<BarChart3 size={14} />}
          loading={isLoading}
        />

        {/* R$ Recuperável */}
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest text-text-muted font-medium">
                Receita em risco
              </p>
              <p
                className={cn(
                  'text-2xl font-bold mt-2',
                  isLoading ? 'animate-pulse bg-brand-surface-2 rounded w-24 h-7' : 'text-text-primary',
                )}
              >
                {!isLoading && (
                  <>
                    R${(recovery?.estimatedRevenue ?? 0).toLocaleString('pt-BR')}
                  </>
                )}
              </p>
              <p className="text-xs text-text-muted mt-2">
                Potencial de recuperação
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-status-success-muted/40 flex items-center justify-center shrink-0">
              <DollarSign size={16} className="text-status-success" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary row — Estatísticas do mês */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          📊 Resumo do mês
        </h3>
        <div className="grid grid-cols-3 gap-4 md:grid-cols-3">
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Tentativas</p>
            <p className="text-lg font-semibold text-text-primary">
              {recovery?.recoveredThisMonth ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">Taxa média</p>
            <p className="text-lg font-semibold text-text-primary">
              {recovery?.successRate ?? 0}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-brand-surface-2/40">
            <p className="text-2xs uppercase text-text-muted mb-1">CTA</p>
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
