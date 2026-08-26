import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, helper, error, id, ...props }, ref) => {
    const textareaId = id ?? React.useId();
    const helperId = `${textareaId}-helper`;
    const errorId = `${textareaId}-error`;

    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-medium text-text-secondary"
          >
            {label}
            {props.required && (
              <span className="text-status-error ml-0.5" aria-hidden>*</span>
            )}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full rounded-lg bg-brand-surface-2 border text-sm text-text-primary placeholder:text-text-muted',
            'transition-colors duration-150 px-3 py-2 resize-none',
            'focus:outline-none focus:border-brand-amber/60 focus:ring-2 focus:ring-brand-amber/15',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-status-warning/60 focus:border-status-warning/80 focus:ring-status-warning/10'
              : 'border-brand-border hover:border-brand-border-2',
            className
          )}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          aria-invalid={!!error}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
