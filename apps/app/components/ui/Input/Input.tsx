import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      label,
      helper,
      error,
      iconLeft,
      iconRight,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? React.useId();
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-text-secondary"
          >
            {label}
            {props.required && (
              <span className="text-status-error ml-0.5" aria-hidden>*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {iconLeft && (
            <span className="absolute left-3 text-text-muted pointer-events-none flex items-center">
              {iconLeft}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg bg-brand-surface-2 border text-sm text-text-primary placeholder:text-text-muted',
              'transition-colors duration-150',
              'focus:outline-none focus:border-brand-amber/60 focus:ring-2 focus:ring-brand-amber/15',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-status-warning/60 focus:border-status-warning/80 focus:ring-status-warning/10'
                : 'border-brand-border hover:border-brand-border-2',
              iconLeft ? 'pl-9' : 'pl-3',
              iconRight ? 'pr-9' : 'pr-3',
              'h-9',
              className
            )}
            aria-describedby={error ? errorId : helper ? helperId : undefined}
            aria-invalid={!!error}
            {...props}
          />

          {iconRight && (
            <span className="absolute right-3 text-text-muted pointer-events-none flex items-center">
              {iconRight}
            </span>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-status-warning flex items-center gap-1">
            <span aria-hidden>⚠</span> {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-xs text-text-muted">
            {helper}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
