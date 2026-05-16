'use client';

import { useAuth } from '@/lib/hooks/auth/useAuth';
import { NexoraRecoverySettings } from '@/components/modules/settings/NexoraRecoverySettings';

export default function NexoraSettingsPage() {
  const { org } = useAuth();

  // Verify organization is in Nexora mode
  if (org?.niche !== 'barbearia') {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted">Esta página é apenas para organizações em modo Nexora.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Nexora - Configurações de Recuperação</h1>
        <p className="text-sm text-text-muted mt-1">
          Personalize como sua barbearia recupera clientes inativos.
        </p>
      </div>
      <NexoraRecoverySettings />
    </div>
  );
}
