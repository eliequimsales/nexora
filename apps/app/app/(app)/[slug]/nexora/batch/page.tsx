'use client';

import { useAuth } from '@/lib/hooks/auth/useAuth';
import { NexoraBatchRecovery } from '@/components/modules/nexora/NexoraBatchRecovery';

export default function NexoraBatchPage() {
  const { org } = useAuth();

  if (org?.niche !== 'barbearia') {
    return (
      <div className="p-6 text-center">
        <p className="text-text-muted">Esta página é apenas para organizações em modo Nexora.</p>
      </div>
    );
  }

  return <NexoraBatchRecovery />;
}
