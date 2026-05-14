'use client';

import { Flame, Thermometer, Snowflake, PartyPopper, Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { getInitials, cn } from '@/lib/utils';
import type { InactiveClient, LeadClassification } from '@/types';

const CLASSIFICATION_CONFIG: Record<
  LeadClassification,
  {
    label: string;
    icon: React.ElementType;
    variant: 'amber' | 'warning' | 'default';
  }
> = {
  hot: { label: 'Quente', icon: Flame, variant: 'amber' },
  warm: { label: 'Morno', icon: Thermometer, variant: 'warning' },
  cold: { label: 'Frio', icon: Snowflake, variant: 'default' },
};

// Stable color per name — picks a hue from the brand palette so the list feels alive
// without being random on every render.
const AVATAR_COLORS = [
  'bg-brand-purple/30 text-brand-purple',
  'bg-brand-amber-muted text-brand-amber',
  'bg-status-info-muted text-status-info',
  'bg-status-success-muted text-status-success',
  'bg-status-warning-muted text-status-warning',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ClientCardProps {
  client: InactiveClient;
  onRecover: (client: InactiveClient) => void;
}

function ClientCard({ client, onRecover }: ClientCardProps) {
  const classification = client.aiClassification
    ? CLASSIFICATION_CONFIG[client.aiClassification]
    : null;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-surface-2/60 hover:border-brand-border-2 transition-colors">
      {/* Avatar */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0',
          colorFor(client.name),
        )}
        aria-hidden
      >
        {getInitials(client.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{client.name}</p>
        <p className="text-xs text-text-muted truncate">
          Última atividade: há {client.daysSinceLastActivity}{' '}
          {client.daysSinceLastActivity === 1 ? 'dia' : 'dias'}
        </p>
      </div>

      {/* Classification (optional) */}
      {classification && (
        <Badge
          variant={classification.variant}
          size="sm"
          className="hidden sm:inline-flex shrink-0"
        >
          <classification.icon size={10} />
          {classification.label}
        </Badge>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => onRecover(client)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-xs font-semibold text-white hover:bg-brand-purpleHover active:scale-[0.98] transition-all shrink-0"
      >
        <Send size={12} />
        Recuperar agora
      </button>
    </div>
  );
}

interface InactiveClientsListProps {
  clients: InactiveClient[];
  onRecover: (client: InactiveClient) => void;
}

export function InactiveClientsList({ clients, onRecover }: InactiveClientsListProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-brand-border bg-brand-surface/40 p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-status-success-muted flex items-center justify-center">
            <PartyPopper size={26} className="text-status-success" />
          </div>
        </div>
        <p className="text-base font-semibold text-text-primary">
          Nenhum cliente perdido! Sua retenção está em dia.
        </p>
        <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
          A Nexora monitora seus clientes 24/7. Você será avisado assim que alguém
          ficar inativo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} onRecover={onRecover} />
      ))}
    </div>
  );
}
