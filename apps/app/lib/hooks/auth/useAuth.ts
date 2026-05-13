'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth.api';
import { useToast } from '@/lib/providers/ToastProvider';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const register = useCallback(
    async (name: string, email: string, password: string, orgName: string, niche: string) => {
      const { data } = await authApi.register({ name, email, password, orgName, niche });
      store.setAuth({
        user: data.user,
        org: data.organization,
        accessToken: data.access_token,
      });
      router.push(`/${data.organization.slug}/dashboard`);
    },
    [store, router]
  );

  const login = useCallback(
    async (email: string, password: string, slug: string) => {
      const { data } = await authApi.login({ email, password, slug });
      store.setAuth({
        user: data.user,
        org: data.organization,
        accessToken: data.access_token,
      });
      router.push(`/${data.organization.slug}/dashboard`);
    },
    [store, router]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the API call fails, clear local state
    } finally {
      store.clearAuth();
      router.push('/login');
    }
  }, [store, router]);

  const hasRole = useCallback(
    (role: 'owner' | 'admin' | 'member') => {
      if (!store.user) return false;
      const hierarchy = { owner: 3, admin: 2, member: 1 };
      return hierarchy[store.user.role] >= hierarchy[role];
    },
    [store.user]
  );

  return {
    user: store.user,
    org: store.org,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    register,
    login,
    logout,
    hasRole,
  };
}
