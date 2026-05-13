'use client';

import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceActionButtonProps {
  active?: boolean;
  onClick: () => void;
}

export function VoiceActionButton({ active = false, onClick }: VoiceActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200 select-none',
        active
          ? 'bg-brand-amber text-white shadow-md shadow-brand-amber/30'
          : 'border border-brand-border bg-brand-surface-2 text-text-secondary hover:text-text-primary hover:border-brand-border-2',
      )}
    >
      {active && (
        <>
          <span className="absolute inset-0 rounded-lg ring-2 ring-brand-amber/25 animate-ping" />
          <span className="absolute inset-0 rounded-lg ring-1 ring-brand-amber/50" />
        </>
      )}
      <Mic size={12} className={active ? 'text-white' : 'text-text-muted'} />
      <span>Comandos de voz</span>
    </button>
  );
}
