'use client';

/**
 * Recuperação — a tela central da empresa no piloto (Engine Universal money-first).
 *
 * Destino padrão pós-cadastro: sobe CSV → vê clientes recuperáveis, valor potencial,
 * Top 3 e a ação. Uma experiência só (o mesmo RecoveryAnalyzer da demo pública).
 */

import { RecoveryAnalyzer } from '@/components/modules/recovery/RecoveryAnalyzer';
import { useAuth } from '@/lib/hooks/auth/useAuth';

export default function RecuperarPage() {
  const { org } = useAuth();

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Bem-vindo ao Projeto Piloto! 🎉</h1>
        <p className="mt-1 text-text-secondary">
          Suba a base de clientes (CSV) e veja em segundos quem vale a pena recuperar primeiro.
        </p>
      </header>
      <RecoveryAnalyzer orgSlug={org?.slug} />
    </div>
  );
}
