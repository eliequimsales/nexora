'use client';

import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LeadsList } from '@/components/modules/leads/LeadsList';
import { CreateLeadForm } from '@/components/modules/leads/CreateLeadForm';
import { CanDo } from '@/components/shared/CanDo/CanDo';
import type { LeadStatus } from '@/types';

const STATUS_FILTERS: { label: string; value: LeadStatus | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Novos', value: 'new' },
  { label: 'Contactados', value: 'contacted' },
  { label: 'Qualificados', value: 'qualified' },
  { label: 'Ganhos', value: 'closed_won' },
  { label: 'Perdidos', value: 'closed_lost' },
];

export default function LeadsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<LeadStatus | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Leads</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Gerencie seus contatos e oportunidades.
          </p>
        </div>

        <CanDo permission="leads:create">
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Novo lead
          </Button>
        </CanDo>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          iconLeft={<Search size={14} />}
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setActiveStatus(filter.value)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeStatus === filter.value
                ? 'bg-brand-amber text-brand-bg'
                : 'text-text-muted hover:text-text-primary hover:bg-brand-surface-2',
            ].join(' ')}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <LeadsList search={search || undefined} status={activeStatus} />
      </div>

      {/* Create modal */}
      {showCreate && <CreateLeadForm onClose={() => setShowCreate(false)} />}
    </div>
  );
}
