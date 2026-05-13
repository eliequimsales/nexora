'use client';

import { useAuthStore } from '@/lib/stores/auth.store';

/**
 * Provides tenant identifiers for building URLs and scoping API calls.
 *
 * slug  → used in URLs:  /<slug>/dashboard
 * orgId → used in API context (carried by the JWT, but useful for cache keys)
 */
export function useTenant() {
  const org = useAuthStore((s) => s.org);

  if (!org) {
    throw new Error('useTenant must be used inside an authenticated route');
  }

  return {
    slug: org.slug,
    orgId: org.id,
    /** Builds an app-internal URL: useTenant().url('leads') → '/acme/leads' */
    url: (path: string) => `/${org.slug}/${path}`,
  };
}
