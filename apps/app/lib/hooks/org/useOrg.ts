'use client';

import { useAuthStore } from '@/lib/stores/auth.store';

/**
 * Returns the current tenant's organization from the auth store.
 * Throws if called outside an authenticated context.
 */
export function useOrg() {
  const org = useAuthStore((s) => s.org);

  if (!org) {
    throw new Error('useOrg must be used inside an authenticated route');
  }

  return org;
}
