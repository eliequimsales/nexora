import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  variant?: 'default' | 'amber' | 'success' | 'warning' | 'ai';
  icon: React.ReactNode;
  loading?: boolean;
}

const VARIANT_STYLES = {
  default: {
    icon: 'text-text-muted bg-brand-surface-2',
    value: 'text-text-primary',
  },
  amber: {
    icon: 'text-brand-amber bg-brand-amber-subtle',
    value: 'text-brand-amber',
  },
  success: {
    icon: 'text-status-success bg-status-success-muted',
    value: 'text-status-success',
  },
  warning: {
    icon: 'text-status-warning bg-status-warning-muted',
    value: 'text-status-warning',
  },
  ai: {
    icon: 'text-brand-amber bg-brand-amber-subtle',
    value: 'text-text-primary',
  },
};

export function StatCard({ label, value, sub, variant = 'default', icon, loading }: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  if (loading) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <div className="h-3 w-20 skeleton mb-3" />
        <div className="h-8 w-16 skeleton mb-2" />
        <div className="h-3 w-24 skeleton" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-text-muted font-medium">{label}</span>
        <span className={cn('p-1.5 rounded-lg', styles.icon)}>{icon}</span>
      </div>
      <p className={cn('text-3xl font-bold tabular-nums', styles.value)}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}
