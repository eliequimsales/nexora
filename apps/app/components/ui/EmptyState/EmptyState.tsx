import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-brand-border p-12 text-center">
      <div className="flex justify-center mb-3 text-text-muted opacity-50">{icon}</div>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="text-xs text-text-muted mt-1 mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-medium text-brand-bg hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
