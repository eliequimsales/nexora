'use client';

import { useState } from 'react';
import { Plus, Zap, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CanDo } from '@/components/shared/CanDo/CanDo';
import { WorkflowRow } from '@/components/modules/workflows/WorkflowRow';
import { CreateWorkflowModal } from '@/components/modules/workflows/CreateWorkflowModal';
import { useWorkflowsQuery } from '@/lib/hooks/workflows/useWorkflowsQuery';
import { useOrg } from '@/lib/hooks/org/useOrg';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import Link from 'next/link';

function WorkflowsSkeleton() {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton height="32px" width="32px" className="rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton height="12px" width="35%" />
            <Skeleton height="10px" width="20%" />
          </div>
          <Skeleton height="20px" width="52px" className="rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function WorkflowsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: workflows, isLoading, isError } = useWorkflowsQuery();
  const org = useOrg();
  const { data: orgData } = useOrgQuery();

  const active = workflows?.filter((w) => w.isActive) ?? [];
  const inactive = workflows?.filter((w) => !w.isActive) ?? [];

  const aiPrompts = orgData?.aiPrompts;
  const hasAiPrompts = aiPrompts != null && Object.values(aiPrompts).some(Boolean);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Workflows</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Automações que executam quando leads chegam ou mudam.
          </p>
        </div>
        <CanDo permission="workflows:manage">
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Novo workflow
          </Button>
        </CanDo>
      </div>

      {orgData && !hasAiPrompts && (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/8 px-4 py-3 mb-5">
          <AlertTriangle size={15} className="text-status-warning mt-0.5 shrink-0" />
          <p className="text-sm text-text-secondary flex-1">
            Configure os prompts de IA para que workflows de classificação funcionem.
          </p>
          <Link
            href={`/${org.slug}/settings/ai`}
            className="text-xs font-medium text-status-warning hover:underline shrink-0"
          >
            Configurar
          </Link>
        </div>
      )}

      {isLoading && <WorkflowsSkeleton />}

      {isError && (
        <div className="rounded-xl border-2 border-dashed border-status-error/20 p-12 text-center">
          <AlertCircle size={22} className="text-status-error mx-auto mb-3 opacity-70" />
          <p className="text-sm font-medium text-text-primary">Não foi possível carregar os workflows</p>
          <p className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1">
            <RefreshCw size={11} />
            Recarregue a página para tentar novamente
          </p>
        </div>
      )}

      {!isLoading && !isError && workflows?.length === 0 && (
        <CanDo permission="workflows:manage" fallback={
          <EmptyState
            icon={<Zap size={24} />}
            title="Nenhum workflow ainda"
            description="Workflows automatizam ações sobre seus leads."
          />
        }>
          <EmptyState
            icon={<Zap size={24} />}
            title="Nenhum workflow ainda"
            description="Crie automações para agir automaticamente sobre seus leads."
            action={{ label: '+ Criar primeiro workflow', onClick: () => setShowCreate(true) }}
          />
        </CanDo>
      )}

      {active.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mb-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            Ativos — {active.length}
          </p>
          {active.map((w) => (
            <WorkflowRow key={w.id} workflow={w} onClick={() => {}} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 opacity-70">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            Inativos — {inactive.length}
          </p>
          {inactive.map((w) => (
            <WorkflowRow key={w.id} workflow={w} onClick={() => {}} />
          ))}
        </div>
      )}

      {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
