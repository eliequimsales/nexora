'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth.api';

// Página de callback do Google OAuth.
// O backend redireciona aqui com ?token=ACCESS_TOKEN&slug=ORG_SLUG
function GoogleSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const store = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const slug = params.get('slug');
    if (!token || !slug) { router.replace('/login'); return; }

    // Disponibiliza o token para o interceptor do axios sem ainda marcar
    // isAuthenticated=true (evita a aplicação renderizar com user/org null).
    useAuthStore.getState().setAccessToken(token);

    authApi.me().then(({ data }) => {
      store.setAuth({ accessToken: token, user: data.user, org: data.organization });
      router.replace(`/${slug}/inicio`);
    }).catch(() => {
      useAuthStore.getState().clearAuth();
      router.replace('/login');
    });
  }, [params, router, store]);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-text-muted text-sm">Entrando com Google...</p>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <p className="text-text-muted text-sm">Carregando...</p>
      </div>
    }>
      <GoogleSuccessInner />
    </Suspense>
  );
}
