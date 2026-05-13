import { Sparkles } from 'lucide-react';

interface AICardProps {
  metrics: {
    customersAnalyzed: number;
    suggestionsGiven: number;
    accuracyScore: number;
  };
}

export function AICard({ metrics }: AICardProps) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-brand-amber" />
        <h3 className="text-sm font-semibold text-text-primary">Performance da IA</h3>
      </div>

      <div className="space-y-3">
        {/* Stat 1: Customers Analyzed */}
        <div className="flex items-start justify-between p-3 rounded-lg bg-brand-surface-2 border border-brand-border">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-tight">Clientes Analisados</p>
            <p className="text-lg font-bold text-text-primary mt-1">{metrics.customersAnalyzed}</p>
          </div>
        </div>

        {/* Stat 2: Suggestions Given */}
        <div className="flex items-start justify-between p-3 rounded-lg bg-brand-surface-2 border border-brand-border">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-tight">Sugestões Dadas</p>
            <p className="text-lg font-bold text-text-primary mt-1">{metrics.suggestionsGiven}</p>
          </div>
        </div>

        {/* Stat 3: Accuracy Score */}
        <div className="flex items-start justify-between p-3 rounded-lg bg-brand-surface-2 border border-brand-border">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-tight">Acurácia do Modelo</p>
            <p className="text-lg font-bold text-status-success mt-1">
              {metrics.accuracyScore.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
