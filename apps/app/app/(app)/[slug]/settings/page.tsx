'use client';

import { Settings } from 'lucide-react';
import { OrgSettingsForm } from '@/components/modules/org/OrgSettingsForm';
import { AssistantPersonaForm } from '@/components/modules/org/AssistantPersonaForm';
import { SecretarySettingsForm } from '@/components/modules/org/SecretarySettingsForm';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import { Spinner } from '@/components/ui/Spinner';

export default function SettingsPage() {
  const { data: org, isLoading, isError } = useOrgQuery();

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner variant="amber" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="p-6">
        <p className="text-sm text-status-error">Erro ao carregar configurações.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-2.5 mb-6">
        <Settings size={18} className="text-text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Configurações</h1>
          <p className="text-xs text-text-muted">{org.slug}</p>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <h2 className="text-sm font-medium text-text-primary mb-4">
          Informações da organização
        </h2>
        <OrgSettingsForm org={org} />
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mt-4">
        <h2 className="text-sm font-medium text-text-primary mb-1">
          Secretária operacional
        </h2>
        <p className="text-xs text-text-muted mb-4">
          Automação de sistema que age sobre novos leads sem configuração de workflows.
        </p>
        <SecretarySettingsForm org={org} />
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mt-4">
        <h2 className="text-sm font-medium text-text-primary mb-1">
          Persona da assistente
        </h2>
        <p className="text-xs text-text-muted mb-4">
          Define nome, tom e estilo das mensagens geradas pela IA.
        </p>
        <AssistantPersonaForm org={org} />
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5 mt-4">
        <h2 className="text-sm font-medium text-text-primary mb-1">
          Token de formulário
        </h2>
        <p className="text-xs text-text-muted mb-3">
          Use este token para integrar formulários externos com a Nexora.
        </p>
        <code className="block w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs font-mono text-text-secondary break-all select-all">
          {org.formToken}
        </code>
      </div>
    </div>
  );
}
