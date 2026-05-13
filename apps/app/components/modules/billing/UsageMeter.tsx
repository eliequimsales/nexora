'use client';

interface UsageMeterProps {
  label: string;
  current: number;
  max: number;
}

export function UsageMeter({ label, current, max }: UsageMeterProps) {
  const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const isHigh = pct >= 80;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className={`text-xs font-medium ${isHigh ? 'text-status-error' : 'text-text-primary'}`}>
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-status-error' : 'bg-brand-amber'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
