'use client';

import {
  UserPlus, Sparkles, MessageSquare, GitBranch,
  CheckCheck, Archive, Bot, SquarePen, FileText, Send, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useLeadTimeline } from '@/lib/hooks/activity-logs/useLeadTimeline';
import { formatRelativeTime } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  lead_created:     { icon: UserPlus,      color: 'text-status-success', label: 'Lead criado' },
  lead_classified:  { icon: Sparkles,      color: 'text-brand-amber',    label: 'Classificado pela IA' },
  note:             { icon: MessageSquare, color: 'text-text-muted',      label: 'Nota adicionada' },
  ai_response:      { icon: Bot,           color: 'text-brand-amber',    label: 'IA respondeu' },
  ai_follow_up:     { icon: Bot,           color: 'text-brand-amber',    label: 'IA fez follow-up' },
  stage_changed:    { icon: GitBranch,     color: 'text-status-info',    label: 'Estágio alterado' },
  task_created:     { icon: SquarePen,     color: 'text-text-secondary', label: 'Tarefa criada' },
  task_done:        { icon: CheckCheck,    color: 'text-status-success', label: 'Tarefa concluída' },
  lead_archived:    { icon: Archive,       color: 'text-text-muted',     label: 'Lead arquivado' },
  proposal_created: { icon: FileText,      color: 'text-text-secondary', label: 'Proposta criada' },
  proposal_sent:    { icon: Send,          color: 'text-status-info',    label: 'Proposta enviada' },
  proposal_accepted:{ icon: ThumbsUp,      color: 'text-status-success', label: 'Proposta aceita' },
  proposal_rejected:{ icon: ThumbsDown,    color: 'text-status-error',   label: 'Proposta recusada' },
};

interface LeadTimelineProps {
  leadId: string;
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const { data, isLoading } = useLeadTimeline(leadId);

  if (isLoading) {
    return (
      <div className="space-y-3 py-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-6 h-6 skeleton rounded-full shrink-0" />
            <div className="flex-1 pt-0.5">
              <div className="h-3 skeleton w-3/4 mb-1.5" />
              <div className="h-2.5 skeleton w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <p className="text-xs text-text-muted text-center py-4">Nenhuma atividade registrada.</p>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const cfg = TYPE_CONFIG[item.type] ?? { icon: SquarePen, color: 'text-text-muted', label: item.type };
        const Icon = cfg.icon;
        const isAi = item.userId === null;

        return (
          <div key={item.id} className="flex gap-3 py-2.5 relative">
            {/* Vertical line */}
            {idx < items.length - 1 && (
              <div className="absolute left-3 top-8 bottom-0 w-px bg-brand-border" />
            )}

            {/* Icon */}
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${isAi ? 'bg-brand-amber/10' : 'bg-brand-surface-2 border border-brand-border'}`}>
              <Icon size={11} className={cfg.color} />
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-primary">
                  {cfg.label}
                  {!isAi && item.userName && (
                    <span className="font-normal text-text-muted"> · {item.userName}</span>
                  )}
                  {isAi && (
                    <span className="font-normal text-brand-amber"> · IA</span>
                  )}
                </p>
                <span className="text-2xs text-text-muted shrink-0">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
              {item.content && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.content}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
