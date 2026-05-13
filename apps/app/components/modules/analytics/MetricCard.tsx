'use client';

import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  className?: string;
}

export function MetricCard({ label, value, sub, trend, loading, className }: MetricCardProps) {
  return (
    <div className={cn('rounded-xl border border-brand-border bg-brand-surface p-4', className)}>
      {loading ? (
        <>
          <div className="h-3 skeleton w-1/2 mb-3" />
          <div className="h-7 skeleton w-2/3 mb-2" />
          <div className="h-2.5 skeleton w-1/3" />
        </>
      ) : (
        <>
          <p className="text-xs text-text-muted mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary leading-none">{value}</p>
          {sub && (
            <p
              className={cn(
                'text-xs mt-1.5',
                trend === 'up' && 'text-status-success',
                trend === 'down' && 'text-status-error',
                !trend && 'text-text-muted',
              )}
            >
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  );
}
