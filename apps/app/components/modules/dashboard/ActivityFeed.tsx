'use client';

import {
  UserPlus, Sparkles, MessageSquare, GitBranch,
  CheckCheck, Archive, UserCheck, Bot, SquarePen,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useDashboardActivity } from '@/lib/hooks/dashboard/useDashboardActivity';
import { formatRelativeTime } from '@/lib/utils';
import type { ActivityItem } from '@/types';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  lead_created: { icon: UserPlus, color: 'text-status-success', label: 'criou lead' },
  lead_classified: { icon: Sparkles, color: 'text-brand-amber', label: 'classificou lead' },
  note: { icon: MessageSquare, color: 'text-text-muted', label: 'adicionou nota' },
  ai_response: { icon: Bot, color: 'text-brand-amber', label: 'respondeu' },
  ai_follow_up: { icon: Bot, color: 'text-brand-amber', label: 'fez follow-up' },
  stage_changed: { icon: GitBranch, color: 'text-status-info', label: 'moveu estágio' },
  task_created: { icon: SquarePen, color: 'text-text-secondary', label: 'criou tarefa' },
  task_done: { icon: CheckCheck, color: 'text-status-success', label: 'concluiu tarefa' },
  lead_archived: { icon: Archive, color: 'text-text-muted', label: 'arquivou lead' },
  lead_assigned: { icon: UserCheck, color: 'text-status-info', label: 'atribuiu lead' },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = TYPE_CONFIG[item.type] ?? { icon: SquarePen, color: 'text-text-muted', label: item.type };
  const Icon = config.icon;
  const isAi = item.userId === null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-brand-border last:border-0">
      {/* Actor */}
      {isAi ? (
        <span className="w-8 h-8 rounded-full bg-brand-amber-subtle border border-brand-amber/20 flex items-center justify-center shrink-0">
          <Bot size={14} className="text-brand-amber" />
        </span>
      ) : (
        <Avatar
          name={item.userName ?? '?'}
          src={item.userAvatarUrl}
          size="md"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">
            {isAi ? 'IA' : (item.userName ?? 'Usuário')}
          </span>
          {' '}
          <span className={config.color}>{config.label}</span>
          {' '}
          <span className="font-medium text-text-primary truncate">
            {item.leadName}
          </span>
        </p>
        <p className="text-2xs text-text-muted mt-0.5 truncate">{item.content}</p>
      </div>

      {/* Time */}
      <span className="text-2xs text-text-muted shrink-0 mt-0.5">
        {formatRelativeTime(item.createdAt)}
      </span>
    </div>
  );
}

export function ActivityFeed() {
  const { data, isLoading } = useDashboardActivity();

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 skeleton rounded-full shrink-0" />
            <div className="flex-1">
              <div className="h-3 skeleton w-3/4 mb-1.5" />
              <div className="h-2.5 skeleton w-1/2" />
            </div>
            <div className="h-2.5 w-8 skeleton shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-text-muted">Nenhuma atividade ainda.</p>
        <p className="text-xs text-text-muted mt-1">As ações aparecem aqui em tempo real.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  );
}
