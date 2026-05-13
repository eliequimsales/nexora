import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Selecionar organização' };

export default function SelectOrgPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-amber flex items-center justify-center">
            <span className="text-brand-bg text-sm font-bold">B</span>
          </div>
          <span className="text-text-primary font-semibold text-lg">
            B&apos;reshit
          </span>
        </div>

        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <h1 className="text-lg font-semibold text-text-primary mb-1">
            Suas organizações
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Selecione a organização que deseja acessar
          </p>
          {/* OrgList — implementado no Bloco 2 */}
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-brand-border bg-brand-surface-2"
              >
                <div className="w-8 h-8 skeleton rounded-lg" />
                <div className="flex-1">
                  <div className="h-3.5 w-32 skeleton mb-1.5" />
                  <div className="h-3 w-20 skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
