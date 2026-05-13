import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currency';

interface HealthCardProps {
  goalAmount: number;
  revenueActual: number;
  revenueProjected: number;
  goalAchievementPercent: number;
}

export function HealthCard({
  goalAmount,
  revenueActual,
  revenueProjected,
  goalAchievementPercent,
}: HealthCardProps) {
  const isOnTrack = goalAchievementPercent >= 100;
  const remaining = Math.max(0, goalAmount - revenueActual);
  const progressPercent = Math.min(goalAchievementPercent, 100);

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Meta de Receita</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {isOnTrack ? 'Você vai bater a meta!' : `Faltam ${formatCurrency(remaining)}`}
          </p>
        </div>
        <span className={cn(
          'text-2xl font-bold',
          isOnTrack ? 'text-status-success' : 'text-status-warning'
        )}>
          {goalAchievementPercent.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full h-2 rounded-full bg-brand-surface-2 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isOnTrack ? 'bg-status-success' : 'bg-status-warning'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Receita Atual</span>
          <span className="text-text-primary font-medium">{formatCurrency(revenueActual)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Meta</span>
          <span className="text-text-primary font-medium">{formatCurrency(goalAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Projeção</span>
          <span className="text-text-primary font-medium">{formatCurrency(revenueProjected)}</span>
        </div>
      </div>
    </div>
  );
}
