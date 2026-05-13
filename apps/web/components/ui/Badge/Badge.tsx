import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-surface border border-brand-border text-text-secondary',
        amber: 'bg-brand-amber-muted border border-brand-amber/30 text-brand-amber',
        success: 'bg-status-success/10 border border-status-success/20 text-status-success',
        info: 'bg-status-info/10 border border-status-info/20 text-status-info',
        ai: 'bg-gradient-to-r from-brand-amber/15 to-brand-gold/10 border border-brand-amber/25 text-brand-amber',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-xs',
        lg: 'px-3.5 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'amber' || variant === 'ai' ? 'bg-brand-amber' : 'bg-current',
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
