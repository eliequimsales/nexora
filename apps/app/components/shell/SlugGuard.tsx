'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';

interface SlugGuardProps {
  slug: string;
}

export function SlugGuard({ slug }: SlugGuardProps) {
  const org = useAuthStore((s) => s.org);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !org) return;
    if (org.slug !== slug) {
      router.replace(`/${org.slug}/inicio`);
    }
  }, [slug, org, isLoading, router]);

  return null;
}
