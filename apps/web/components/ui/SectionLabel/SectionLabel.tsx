import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'amber';
}

export function SectionLabel({ children, className, variant = 'default' }: SectionLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase',
        variant === 'amber' ? 'text-brand-amber' : 'text-text-muted',
        className,
      )}
    >
      {variant === 'amber' && (
        <span className="w-1 h-1 rounded-full bg-brand-amber animate-pulse" />
      )}
      {children}
    </span>
  );
}
