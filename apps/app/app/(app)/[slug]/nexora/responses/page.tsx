'use client';

import { useAuth } from '@/lib/hooks/auth/useAuth';
import { NexoraResponses } from '@/components/modules/nexora/NexoraResponses';

export default function NexoraResponsesPage() {
  const { org } = useAuth();

  // Verify organization is in Nexora mode
  if (org?.niche !== 'barbearia') {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted">Esta página é apenas para organizações em modo Nexora.</p>
      </div>
    );
  }

  return <NexoraResponses />;
}
