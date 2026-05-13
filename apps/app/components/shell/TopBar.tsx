'use client';

import { usePathname } from 'next/navigation';
import { useTenant } from '@/lib/hooks/org/useTenant';
import { useOrg } from '@/lib/hooks/org/useOrg';

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  pipeline: 'Pipeline',
  workflows: 'Workflows',
  proposals: 'Propostas',
  analytics: 'Analytics',
  settings: 'Configurações',
  profile: 'Meu perfil',
};

function getSection(pathname: string, slug: string): string {
  const relative = pathname.replace(`/${slug}/`, '').split('/')[0];
  return SECTION_TITLES[relative] ?? 'B\'reshit';
}

export function TopBar() {
  const pathname = usePathname();
  const { slug } = useTenant();
  const org = useOrg();
  const section = getSection(pathname, slug);

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between px-6 bg-brand-surface border-b border-brand-border"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
      }}
    >
      <h1 className="text-sm font-semibold text-text-primary">{section}</h1>

      <span className="text-xs text-text-muted truncate max-w-[180px]">{org.name}</span>
    </header>
  );
}
