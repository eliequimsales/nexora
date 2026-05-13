'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProposalsList } from '@/components/modules/proposals/ProposalsList';
import { CreateProposalModal } from '@/components/modules/proposals/CreateProposalModal';
import { CanDo } from '@/components/shared/CanDo/CanDo';

export default function ProposalsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Propostas</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Crie e acompanhe propostas comerciais dos seus leads.
          </p>
        </div>

        <CanDo permission="proposals:manage">
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Nova proposta
          </Button>
        </CanDo>
      </div>

      {/* List */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <ProposalsList />
      </div>

      {/* Create modal */}
      {showCreate && <CreateProposalModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
