'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth.api';

// Página de callback do Google OAuth.
// O backend redireciona aqui com ?token=ACCESS_TOKEN&slug=ORG_SLUG
// Guardamos o token e redirecionamos pro dashboard.
export default function GoogleSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const store = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const slug = params.get('slug');
    if (!token || !slug) { router.replace('/login'); return; }

    // Seta o access_token e busca o perfil completo
    store.setAuth({ accessToken: token, user: null as never, org: null as never });
    authApi.me().then(({ data }) => {
      store.setAuth({ accessToken: token, user: data.user, org: data.organization });
      router.replace(`/${slug}/dashboard`);
    }).catch(() => router.replace('/login'));
  }, [params, router, store]);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-text-muted text-sm">Entrando com Google...</p>
    </div>
  );
}
