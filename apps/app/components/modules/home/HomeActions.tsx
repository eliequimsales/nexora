'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Sparkles, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CanDo } from '@/components/shared/CanDo/CanDo';
import { CreateLeadForm } from '@/components/modules/leads/CreateLeadForm';

interface HomeActionsProps {
  slug: string;
}

export function HomeActions({ slug }: HomeActionsProps) {
  const [isAddingClient, setIsAddingClient] = useState(false);

  return (
    <>
      <div className="p-4 sm:p-6 max-w-6xl space-y-4 sm:space-y-6">
        <section
          className="relative overflow-hidden rounded-2xl border border-brand-purple/30 p-6 sm:p-8 shadow-panel animate-fade-in-up"
          style={{
            background:
              'linear-gradient(135deg, #7C3AED 0%, #6D28D9 60%, #4C1D95 100%)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, #EAB308 0%, transparent 70%)' }}
          />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-2xs font-medium text-white/90 backdrop-blur-sm">
                <Sparkles size={11} className="text-brand-gold" />
                Nexora
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                Seus clientes começam aqui.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                Adicione uma pessoa ou traga sua lista atual. A Nexora organiza cada
                relacionamento para que ninguém fique esquecido.
              </p>
            </div>

            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm sm:flex">
              <Users size={34} className="text-brand-gold" />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-2xs font-semibold uppercase tracking-widest text-brand-amber">
              Comece por aqui
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">
              Como você quer trazer seus clientes?
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Escolha uma das duas formas. O restante acontece dentro de Clientes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CanDo permission="leads:create">
            <article className="group relative overflow-hidden rounded-xl border border-brand-amber/30 bg-brand-surface p-5 shadow-glow-amber-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-amber/50 hover:shadow-glow-amber animate-fade-in-up sm:p-6">
              <div
                aria-hidden
                className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-brand-amber/10 blur-3xl transition-opacity group-hover:opacity-100"
              />
              <div className="relative">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-amber/20 bg-brand-amber-muted">
                    <Plus size={20} className="text-brand-amber" />
                  </div>
                  <span className="rounded-full border border-brand-amber/20 bg-brand-amber-subtle px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-brand-amber">
                    Um por vez
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Adicionar cliente</h3>
                <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-text-muted">
                  Cadastre uma pessoa com os dados essenciais e comece a cuidar desse
                  relacionamento agora.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => setIsAddingClient(true)}
                >
                  Adicionar cliente
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Button>
              </div>
            </article>
          </CanDo>

          <CanDo permission="leads:create">
            <article
              className="group relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface p-5 shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-purple/40 animate-fade-in-up sm:p-6"
              style={{ animationDelay: '80ms', animationFillMode: 'both' }}
            >
              <div
                aria-hidden
                className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-brand-purple/10 blur-3xl"
              />
              <div className="relative">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-purple/20 bg-brand-purple/15">
                    <Upload size={20} className="text-brand-purple" />
                  </div>
                  <span className="rounded-full border border-brand-border bg-brand-surface-2 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
                    Lista completa
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Importar clientes</h3>
                <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-text-muted">
                  Envie sua planilha com segurança. A Nexora valida os dados e identifica
                  registros repetidos antes de importar.
                </p>
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/${slug}/clientes/importar`}>
                    Importar clientes
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </Button>
              </div>
            </article>
          </CanDo>
          </div>
        </section>
        </div>

      {isAddingClient && <CreateLeadForm onClose={() => setIsAddingClient(false)} />}
    </>
  );
}
