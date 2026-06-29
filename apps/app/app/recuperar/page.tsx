'use client';

/**
 * Demo pública da recuperação de clientes — mesma experiência que a clínica vê
 * dentro da conta (componente RecoveryAnalyzer). Sobe CSV → recuperáveis money-first.
 */

import { RecoveryAnalyzer } from '@/components/modules/recovery/RecoveryAnalyzer';

export default function RecuperarPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-text-primary px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold">Recuperação de clientes</h1>
          <p className="mt-1 text-text-secondary">
            Suba o CSV dos seus clientes e veja quem vale a pena trazer de volta — e quanto isso vale.
          </p>
        </header>
        <RecoveryAnalyzer />
      </div>
    </main>
  );
}
