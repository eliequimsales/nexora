'use client';

import { X, CheckCircle, AlertTriangle, XCircle, Info, Sparkles } from 'lucide-react';
import { useToast, type ToastVariant } from '@/lib/providers/ToastProvider';
import { cn } from '@/lib/utils';

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: React.ReactNode; bar: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle size={16} />,
    bar: 'bg-status-success',
    iconColor: 'text-status-success',
  },
  error: {
    icon: <XCircle size={16} />,
    bar: 'bg-status-error',
    iconColor: 'text-status-error',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    bar: 'bg-status-warning',
    iconColor: 'text-status-warning',
  },
  info: {
    icon: <Info size={16} />,
    bar: 'bg-status-info',
    iconColor: 'text-status-info',
  },
  ai: {
    icon: <Sparkles size={16} />,
    bar: 'bg-brand-amber',
    iconColor: 'text-brand-amber',
  },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80"
    >
      {toasts.map((toast) => {
        const config = VARIANT_CONFIG[toast.variant];

        return (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              'relative flex items-start gap-3 rounded-xl overflow-hidden',
              'bg-brand-surface border border-brand-border shadow-panel',
              'p-3.5 pr-9 animate-slide-in-right'
            )}
          >
            {/* colored left bar */}
            <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', config.bar)} />

            {/* icon */}
            <span className={cn('shrink-0 mt-0.5', config.iconColor)}>
              {config.icon}
            </span>

            {/* content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-snug">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-xs text-text-secondary mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
              {toast.action && (
                <button
                  onClick={toast.action.onClick}
                  className="mt-1.5 text-xs text-brand-amber hover:underline font-medium"
                >
                  {toast.action.label}
                </button>
              )}
            </div>

            {/* dismiss */}
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Fechar notificação"
              className="absolute top-3 right-3 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
