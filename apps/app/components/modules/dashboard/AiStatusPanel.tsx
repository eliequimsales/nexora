'use client';

import React from 'react';
import { Sparkles, Zap, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useDashboardSummary } from '@/lib/hooks/dashboard/useDashboardSummary';

interface AiStatusRowProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
}

function AiStatusRow({ icon: Icon, label, active }: AiStatusRowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-brand-border last:border-0">
      <span className="w-7 h-7 rounded-lg bg-brand-amber-subtle flex items-center justify-center shrink-0">
        <Icon size={13} className="text-brand-amber" />
      </span>
      <span className="text-xs text-text-secondary flex-1">{label}</span>
      <Badge variant={active ? 'success' : 'default'} dot={active}>
        {active ? 'Ativo' : 'Inativo'}
      </Badge>
    </div>
  );
}

export function AiStatusPanel() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-3 w-24 skeleton" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-7 h-7 skeleton rounded-lg shrink-0" />
            <div className="h-3 skeleton flex-1" />
            <div className="h-5 w-12 skeleton rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  const ai = data?.ai;
  const hasActivity = (ai?.executionsToday ?? 0) > 0;

  return (
    <div>
      {/* Header metric */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {ai?.executionsToday ?? 0}
          </p>
          <p className="text-xs text-text-muted">execuções hoje</p>
        </div>
        {hasActivity && (
          <div className="text-right">
            <p className="text-lg font-semibold text-status-success tabular-nums">
              {ai?.successRate ?? 0}%
            </p>
            <p className="text-xs text-text-muted">taxa de sucesso</p>
          </div>
        )}
      </div>

      {/* Status rows */}
      <div>
        <AiStatusRow icon={Sparkles} label="Classificação de leads" active={hasActivity} />
        <AiStatusRow icon={MessageSquare} label="Resposta automática" active={false} />
        <AiStatusRow icon={Zap} label="Follow-up inteligente" active={false} />
      </div>

      {!hasActivity && (
        <p className="text-2xs text-text-muted mt-3 leading-relaxed">
          A IA entra em ação quando novos leads chegam. Configure os prompts em Configurações.
        </p>
      )}
    </div>
  );
}
