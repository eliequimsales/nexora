'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopilotDrawer } from './CopilotDrawer';
import { useCopilotSuggestions } from '@/lib/hooks/copilot/useCopilotSuggestions';

export function CopilotButton() {
  const [open, setOpen] = useState(false);
  const { data: suggestions = [] } = useCopilotSuggestions();

  const count = suggestions.length;
  const hasUrgent = suggestions.some((s) => s.priority === 1);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir Copilot"
        className={cn(
          'fixed bottom-6 right-6 z-30 flex items-center gap-2 h-11 pl-3.5 pr-4 rounded-full',
          'bg-brand-surface border border-brand-border shadow-lg',
          'text-text-primary hover:bg-brand-surface-2 hover:border-brand-border-2',
          'transition-all duration-200 active:scale-95 select-none',
          hasUrgent && 'border-brand-amber/40 shadow-glow-amber-sm',
        )}
      >
        <div className="relative">
          <Sparkles
            size={16}
            className={cn('text-brand-amber', hasUrgent && 'animate-pulse')}
          />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-brand-amber text-brand-bg text-[9px] font-bold flex items-center justify-center leading-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
        <span className="text-xs font-medium">Copilot</span>
      </button>

      {open && <CopilotDrawer onClose={() => setOpen(false)} />}
    </>
  );
}
