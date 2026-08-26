'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/stores/auth.store';

// No piloto cada usuário tem 1 organização. Buscamos via /auth/me e
// redirecionamos direto para o início dessa organização.
// Multi-org no futuro: substituir por lista clicável.
export default function SelectOrgPage() {
  const router = useRouter();
  const store = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    // Fallback: se em 12s ainda não saiu, redireciona pro login.
    // Protege contra request pendurado sem resposta (mobile com sinal ruim).
    const fallback = setTimeout(() => {
      if (!cancelled) router.replace('/login');
    }, 12000);

    authApi.me()
      .then(({ data }) => {
        if (cancelled) return;
        store.setAuth({
          accessToken: useAuthStore.getState().accessToken ?? '',
          user: data.user,
          org: data.organization,
        });
        router.replace(`/${data.organization.slug}/inicio`);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace('/login');
      })
      .finally(() => {
        clearTimeout(fallback);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [router, store]);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-amber flex items-center justify-center">
            <span className="text-brand-bg text-sm font-bold">N</span>
          </div>
          <span className="text-text-primary font-semibold text-lg">Nexora</span>
        </div>
        <p className="text-center text-sm text-text-muted">Entrando...</p>
      </div>
    </div>
  );
}
