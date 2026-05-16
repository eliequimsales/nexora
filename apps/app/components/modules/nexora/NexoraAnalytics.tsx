'use client';

import { Sparkles, TrendingUp, MessageSquare, PhoneForwarded } from 'lucide-react';
import { useNexoraAnalytics } from '@/lib/hooks/analytics/useNexoraAnalytics';
import type { NexoraAnalyticsDto } from '@/types';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  return `${value}%`;
}

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ label, value, subtext, icon: Icon, trend }: KPICardProps) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase">{label}</span>
        <Icon size={14} className="text-text-muted" />
      </div>
      <p className="text-xl font-bold text-text-primary mb-1">{value}</p>
      {subtext && <p className="text-xs text-text-muted">{subtext}</p>}
      {trend && (
        <div className={`text-xs font-medium mt-1 ${trend === 'up' ? 'text-status-success' : 'text-text-muted'}`}>
          {trend === 'up' ? '↑ Crescimento' : '→ Estável'}
        </div>
      )}
    </div>
  );
}

interface ChannelBadgeProps {
  channel: 'whatsapp' | 'email';
  sent: number;
  responded: number;
  successRate: number;
}

function ChannelBadge({ channel, sent, responded, successRate }: ChannelBadgeProps) {
  const icon = channel === 'whatsapp' ? '💬' : '📧';
  const name = channel === 'whatsapp' ? 'WhatsApp' : 'Email';

  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-text-primary text-sm">
          {icon} {name}
        </span>
        <span className="text-xs font-semibold text-brand-gold">{formatPercent(successRate)}</span>
      </div>
      <div className="space-y-1 text-xs text-text-muted">
        <p>
          <span className="font-medium text-text-primary">{sent}</span> enviados
        </p>
        <p>
          <span className="font-medium text-text-primary">{responded}</span> respostas
        </p>
      </div>
    </div>
  );
}

interface InsightBoxProps {
  label: string;
  value: string;
  icon: React.ElementType;
}

function InsightBox({ label, value, icon: Icon }: InsightBoxProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface-2 p-3">
      <Icon size={16} className="text-brand-gold shrink-0" />
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export function NexoraAnalytics() {
  const { data, isLoading } = useNexoraAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-brand-surface rounded-lg skeleton" />
          ))}
        </div>
        <div className="h-64 bg-brand-surface rounded-lg skeleton" />
        <div className="h-64 bg-brand-surface rounded-lg skeleton" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted">Nenhum dado de analytics disponível.</p>
      </div>
    );
  }

  const { kpis, trends, channels, insights } = data as NexoraAnalyticsDto;

  return (
    <div className="space-y-6 p-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Analytics de Recuperação</h1>
        <p className="text-sm text-text-muted">
          Acompanhe o desempenho de suas campanhas de recuperação de clientes nos últimos 30 dias.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          label="Clientes Inativos"
          value={kpis.inactiveCount}
          subtext={`${formatCurrency(kpis.estimatedRevenue)} em potencial`}
          icon={PhoneForwarded}
          trend={kpis.inactiveCount > 0 ? 'up' : 'neutral'}
        />
        <KPICard
          label="Recuperações Este Mês"
          value={kpis.recoveredThisMonth}
          subtext="Tentativas de reativação"
          icon={TrendingUp}
        />
        <KPICard
          label="Taxa de Sucesso"
          value={formatPercent(kpis.successRate)}
          subtext="Clientes que responderam"
          icon={MessageSquare}
          trend={kpis.successRate >= 10 ? 'up' : 'neutral'}
        />
        <KPICard
          label="Receita Estimada"
          value={formatCurrency(kpis.estimatedRevenue)}
          subtext={`${kpis.inactiveCount} clientes × R$ 80`}
          icon={Sparkles}
        />
      </div>

      {/* Trends Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recuperações ao longo do tempo */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Recuperações por Dia</h2>
          </div>
          {trends.recoveries.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {trends.recoveries.map((point, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-brand-surface-2">
                  <span className="text-xs text-text-muted">{point.date}</span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    <div className="flex-1 bg-brand-border rounded h-2">
                      <div
                        className="bg-brand-gold h-2 rounded transition-all"
                        style={{
                          width: `${Math.min((point.value / Math.max(...trends.recoveries.map((p) => p.value), 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-text-primary min-w-fit">{point.value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">Sem dados para exibir</p>
          )}
        </div>

        {/* Receita ao longo do tempo */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Receita Estimada por Dia</h2>
          </div>
          {trends.revenue.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {trends.revenue.map((point, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-brand-surface-2">
                  <span className="text-xs text-text-muted">{point.date}</span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    <div className="flex-1 bg-brand-border rounded h-2">
                      <div
                        className="bg-brand-gold h-2 rounded transition-all"
                        style={{
                          width: `${Math.min((point.value / Math.max(...trends.revenue.map((p) => p.value), 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-text-primary min-w-fit">{formatCurrency(point.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">Sem dados para exibir</p>
          )}
        </div>
      </div>

      {/* Channels and Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels */}
        <div className="lg:col-span-1 rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={14} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Performance por Canal</h2>
          </div>
          <div className="space-y-3">
            {channels.length > 0 ? (
              channels.map((ch) => (
                <ChannelBadge
                  key={ch.channel}
                  channel={ch.channel}
                  sent={ch.sent}
                  responded={ch.responded}
                  successRate={ch.successRate}
                />
              ))
            ) : (
              <p className="text-xs text-text-muted">Sem dados de canais</p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Insights Principais</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InsightBox
              label="Melhor dia para recuperação"
              value={insights.bestDay}
              icon={TrendingUp}
            />
            <InsightBox
              label="Canal mais efetivo"
              value={insights.bestChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
              icon={MessageSquare}
            />
            <InsightBox
              label="Tempo médio até reativação"
              value={`~${insights.avgTimeToReactivation} dias`}
              icon={PhoneForwarded}
            />
            <InsightBox
              label="Mensagem mais efetiva"
              value={insights.topMessage || 'Em análise'}
              icon={Sparkles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
