'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-40 select-none shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-amber text-brand-bg hover:bg-brand-amber/90 active:scale-[0.98] shadow-glow-amber-sm',
        secondary:
          'bg-brand-surface-2 text-text-primary border border-brand-border hover:bg-brand-surface-3 hover:border-brand-border-2 active:scale-[0.98]',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-brand-surface-2 active:scale-[0.98]',
        outline:
          'border border-brand-border text-text-primary hover:bg-brand-surface-2 hover:border-brand-border-2 active:scale-[0.98]',
        link:
          'text-brand-amber underline-offset-4 hover:underline p-0 h-auto font-normal',
        destructive:
          'border border-status-error/40 text-status-error hover:bg-status-error/10 active:scale-[0.98]',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-9 px-4 text-sm',
        xl: 'h-10 px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { buttonVariants };
