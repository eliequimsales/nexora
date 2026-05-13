'use client';

import { TemplateCard } from './TemplateCard';
import { useTemplatesQuery } from '@/lib/hooks/templates/useTemplatesQuery';
import type { OrgSettings } from '@/types';

interface TemplateGridProps {
  orgSettings?: OrgSettings;
}

export function TemplateGrid({ orgSettings }: TemplateGridProps) {
  const { data: templates, isLoading } = useTemplatesQuery();

  const appliedTemplateId =
    (orgSettings?.appliedTemplate as { id?: string } | undefined)?.id;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-brand-border bg-brand-surface p-5 h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <p className="text-sm text-text-muted">Nenhum template disponível.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          alreadyApplied={appliedTemplateId === template.id}
        />
      ))}
    </div>
  );
}
