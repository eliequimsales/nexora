'use client';

import { useAuth } from '@/lib/hooks/auth/useAuth';
import { NexoraAnalytics } from '@/components/modules/nexora/NexoraAnalytics';

export default function NexoraAnalyticsPage() {
  const { org } = useAuth();

  // Verificar se a organização está em modo Nexora
  if (org?.niche !== 'barbearia') {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted">Esta página é só para o modo Nexora (Barbershop).</p>
      </div>
    );
  }

  return <NexoraAnalytics />;
}
