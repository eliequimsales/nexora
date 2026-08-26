'use client';

import { useState } from 'react';
import {
  CalendarDays,
  History,
  Mail,
  Phone,
  StickyNote,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { LeadTimeline } from './LeadTimeline';
import { useCreateNote } from '@/lib/hooks/activity-logs/useCreateNote';
import { formatRelativeTime } from '@/lib/utils';
import type { Lead } from '@/types';

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
}

function ClientFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-4">
      <div className="mb-2 flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-2xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="truncate text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [note, setNote] = useState('');
  const createNote = useCreateNote(lead.id);

  async function handleCreateNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = note.trim();
    if (!content) return;
    await createNote.mutateAsync(content);
    setNote('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <article className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-2xl">
        <header className="relative shrink-0 overflow-hidden border-b border-brand-border px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-brand-purple/15 blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <Avatar name={lead.name} size="lg" />
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-widest text-brand-amber">
                  Cliente
                </p>
                <h2 className="truncate text-lg font-semibold text-text-primary">
                  {lead.name}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Na Nexora {formatRelativeTime(lead.createdAt)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-2 text-text-muted transition-colors hover:border-brand-border-2 hover:text-text-primary"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <ClientFact
              icon={<Phone size={13} />}
              label="Telefone"
              value={lead.phone ?? 'Não informado'}
            />
            <ClientFact
              icon={<Mail size={13} />}
              label="E-mail"
              value={lead.email ?? 'Não informado'}
            />
            <ClientFact
              icon={<CalendarDays size={13} />}
              label="Cadastrado"
              value={new Intl.DateTimeFormat('pt-BR').format(new Date(lead.createdAt))}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-xl border border-brand-border bg-brand-surface-2/40 p-4">
              <div className="mb-4 flex items-center gap-2">
                <History size={14} className="text-brand-amber" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    História do cliente
                  </h3>
                  <p className="text-xs text-text-muted">
                    Os acontecimentos importantes ficam reunidos aqui.
                  </p>
                </div>
              </div>
              <LeadTimeline leadId={lead.id} />
            </section>

            <form
              onSubmit={handleCreateNote}
              className="self-start rounded-xl border border-brand-border bg-brand-surface-2/40 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <StickyNote size={14} className="text-brand-purple" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Guardar uma anotação
                  </h3>
                  <p className="text-xs text-text-muted">
                    Registre algo que ajude no próximo cuidado.
                  </p>
                </div>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex.: prefere contato no período da manhã."
                className="min-h-28 w-full resize-none rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-amber"
              />

              <Button
                type="submit"
                variant="primary"
                className="mt-3 w-full"
                loading={createNote.isPending}
                disabled={!note.trim() || createNote.isPending}
              >
                Guardar anotação
              </Button>
            </form>
          </div>
        </div>
      </article>
    </div>
  );
}
