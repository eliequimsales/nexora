'use client';

import { useEffect } from 'react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/stores/auth.store';

/**
 * Bootstraps auth state on every page load.
 *
 * Flow:
 * 1. POST /auth/refresh (sends httpOnly cookie automatically)
 *    → success: stores new access_token in memory
 *    → failure (cookie expired/missing): clears auth → app redirects to login
 * 2. GET /auth/me with fresh token → hydrates user + org in store
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, accessToken } = useAuthStore();

  useEffect(() => {
    // Skip if already authenticated (in-memory token survived navigation)
    if (accessToken) {
      useAuthStore.getState().setLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        // Step 1: exchange cookie for a fresh access token
        const { data: refreshData } = await authApi.refresh();
        if (cancelled) return;

        const token = refreshData.access_token;
        // Put token in store so /me interceptor picks it up
        useAuthStore.getState().setAccessToken(token);

        // Step 2: fetch user + org profile
        const { data: meData } = await authApi.me();
        if (cancelled) return;

        setAuth({ user: meData.user, org: meData.organization, accessToken: token });
      } catch {
        if (!cancelled) clearAuth();
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
