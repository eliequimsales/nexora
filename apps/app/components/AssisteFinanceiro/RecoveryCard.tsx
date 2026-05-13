interface RecoveryCardProps {
  recoveredThisMonth: number;
  successRate: number;
}

export function RecoveryCard({ recoveredThisMonth, successRate }: RecoveryCardProps) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Recuperações</h3>

      <div className="space-y-3">
        {/* Recovered count */}
        <div>
          <p className="text-xs text-text-muted mb-1">Clientes Recuperados</p>
          <p className="text-2xl font-bold text-status-success">
            {recoveredThisMonth}
          </p>
          <p className="text-2xs text-text-muted mt-1">{recoveredThisMonth} clientes recuperados este mês</p>
        </div>

        {/* Success rate */}
        <div className="pt-3 border-t border-brand-border">
          <p className="text-xs text-text-muted mb-1">Taxa de Sucesso</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-status-success">
              {successRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
