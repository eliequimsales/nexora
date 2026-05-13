import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  'rounded-full border-2 border-t-transparent animate-spin shrink-0',
  {
    variants: {
      variant: {
        default: 'border-text-muted border-t-transparent',
        amber: 'border-brand-amber/30 border-t-brand-amber',
        white: 'border-white/30 border-t-white',
      },
      size: {
        sm: 'w-3.5 h-3.5',
        md: 'w-5 h-5',
        lg: 'w-7 h-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

export function Spinner({ className, variant, size, label = 'Carregando...', ...props }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)} {...props}>
      <span className={spinnerVariants({ variant, size })} />
    </span>
  );
}
