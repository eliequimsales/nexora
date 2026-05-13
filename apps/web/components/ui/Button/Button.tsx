'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-amber text-text-inverse rounded-xl hover:bg-brand-gold hover:shadow-glow-amber-sm active:scale-[0.98]',
        secondary:
          'bg-brand-surface border border-brand-border text-text-primary rounded-xl hover:border-brand-amber/40 hover:bg-brand-surface-2 active:scale-[0.98]',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-brand-surface rounded-xl active:scale-[0.98]',
        outline:
          'border border-brand-border text-text-primary rounded-xl hover:border-brand-amber/50 hover:text-brand-amber active:scale-[0.98]',
        link:
          'text-brand-amber underline-offset-4 hover:underline p-0 h-auto rounded-none',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
        xl: 'h-14 px-9 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
