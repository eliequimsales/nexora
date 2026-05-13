'use client';

import Link from 'next/link';
import { Users, CheckSquare, Sparkles, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/modules/dashboard/StatCard';
import { ActivityFeed } from '@/components/modules/dashboard/ActivityFeed';
import { AiStatusPanel } from '@/components/modules/dashboard/AiStatusPanel';
import { OnboardingChecklist } from '@/components/modules/onboarding/OnboardingChecklist';
import { useDashboardSummary } from '@/lib/hooks/dashboard/useDashboardSummary';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { useBillingSummary } from '@/lib/hooks/billing/useBillingSummary';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';

function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = name.split(' ')[0];

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-text-primary">
        {greeting}, {firstName}.
      </h2>
      <p className="text-sm text-text-muted mt-0.5">
        Aqui está o resumo de hoje da sua operação.
      </p>
    </div>
  );
}

function UsageBanner({ slug }: { slug: string }) {
  const { data } = useBillingSummary();
  if (!data?.limits || !data.usage) return null;

  const { limits, usage } = data;
  const pctLeads = limits.leadsPerMonth > 0 ? usage.leadsThisMonth / limits.leadsPerMonth : 0;
  const pctAi = limits.aiExecPerMonth > 0 ? usage.aiExecThisMonth / limits.aiExecPerMonth : 0;
  const pctUsers = limits.maxUsers > 0 ? usage.usersCount / limits.maxUsers : 0;

  const nearLimit = pctLeads >= 0.8 || pctAi >= 0.8 || pctUsers >= 0.8;
  if (!nearLimit) return null;

  const labels: string[] = [];
  if (pctLeads >= 0.8) labels.push('leads');
  if (pctAi >= 0.8) labels.push('execuções de IA');
  if (pctUsers >= 0.8) labels.push('usuários');

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-5 text-sm">
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle size={15} />
        <span>Você está próximo do limite de {labels.join(', ')} do seu plano.</span>
      </div>
      <Link
        href={`/${slug}/settings/billing`}
        className="shrink-0 text-xs font-semibold text-amber-400 hover:underline"
      >
        Ver planos
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: org } = useOrgQuery();

  return (
    <div className="p-6 max-w-6xl">
      <Greeting name={user?.name ?? 'você'} />

      {org && <UsageBanner slug={org.slug} />}

      <OnboardingChecklist />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total de leads"
          value={summary?.leads.total ?? 0}
          sub={`${summary?.leads.hot ?? 0} quentes`}
          variant="default"
          icon={<Users size={14} />}
          loading={isLoading}
        />
        <StatCard
          label="Leads novos"
          value={summary?.leads.new ?? 0}
          sub="aguardando contato"
          variant="amber"
          icon={<Users size={14} />}
          loading={isLoading}
        />
        <StatCard
          label="Tarefas pendentes"
          value={summary?.tasks.pending ?? 0}
          sub={
            (summary?.tasks.overdue ?? 0) > 0
              ? `${summary?.tasks.overdue} em atraso`
              : 'sem atraso'
          }
          variant={(summary?.tasks.overdue ?? 0) > 0 ? 'warning' : 'default'}
          icon={<CheckSquare size={14} />}
          loading={isLoading}
        />
        <StatCard
          label="IA hoje"
          value={summary?.ai.executionsToday ?? 0}
          sub={
            (summary?.ai.executionsToday ?? 0) > 0
              ? `${summary?.ai.successRate}% sucesso`
              : 'sem execuções'
          }
          variant="ai"
          icon={<Sparkles size={14} />}
          loading={isLoading}
        />
      </div>

      {/* Body: activity + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activity feed — wider */}
        <div className="lg:col-span-3 rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Atividade recente</h3>
            <span className="text-2xs text-text-muted">Atualiza a cada 30s</span>
          </div>
          <ActivityFeed />
        </div>

        {/* AI panel — narrower */}
        <div className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-brand-amber" />
            <h3 className="text-sm font-semibold text-text-primary">Status da IA</h3>
          </div>
          <AiStatusPanel />
        </div>
      </div>
    </div>
  );
}
