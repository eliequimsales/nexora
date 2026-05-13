import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-brand-surface-2 text-text-secondary border border-brand-border',
        amber:
          'bg-brand-amber-muted text-brand-amber border border-brand-amber/20',
        success:
          'bg-status-success-muted text-status-success border border-status-success/20',
        error:
          'bg-status-error-muted text-status-error border border-status-error/20',
        info:
          'bg-status-info-muted text-status-info border border-status-info/20',
        warning:
          'bg-status-warning-muted text-status-warning border border-status-warning/20',
        ai:
          'bg-brand-amber-subtle text-brand-amber border border-brand-amber/20',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-2xs',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'ai' || variant === 'amber'
              ? 'bg-brand-amber animate-pulse-amber'
              : variant === 'success'
              ? 'bg-status-success'
              : variant === 'error'
              ? 'bg-status-error'
              : variant === 'warning'
              ? 'bg-status-warning'
              : variant === 'info'
              ? 'bg-status-info'
              : 'bg-text-muted'
          )}
        />
      )}
      {children}
    </span>
  );
}
