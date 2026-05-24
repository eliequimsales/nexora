'use client';

import { Layout } from 'lucide-react';
import { TemplateGrid } from '@/components/modules/templates/TemplateGrid';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import { CanDo } from '@/components/shared/CanDo/CanDo';

export default function TemplatesSettingsPage() {
  const { data: org } = useOrgQuery();

  return (
    <CanDo
      permission="org:update"
      fallback={
        <div className="p-6">
          <p className="text-sm text-status-error">Acesso restrito a administradores.</p>
        </div>
      }
    >
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2.5 mb-2">
          <Layout size={18} className="text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Templates</h1>
        </div>
        <p className="text-xs text-text-muted mb-6">
          Aplique um template para configurar os estágios do pipeline, automações e prompts de IA do seu nicho.
          Ao aplicar, os prompts de IA são atualizados automaticamente.
        </p>

        {/* Info box for barbershop users */}
        {org?.niche === 'barbearia' && (
          <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 mb-6">
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong className="text-brand-gold">Dica:</strong> Se sua conta foi criada antes de maio de 2026,
              aplique o template <strong>Barbearia — Recuperação de Clientes</strong> para atualizar os
              prompts de IA com mensagens otimizadas para barbearia.
            </p>
          </div>
        )}

        <TemplateGrid orgSettings={org?.settings} />
      </div>
    </CanDo>
  );
}
