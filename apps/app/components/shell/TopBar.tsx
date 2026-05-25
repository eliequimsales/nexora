'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useTenant } from '@/lib/hooks/org/useTenant';
import { useOrg } from '@/lib/hooks/org/useOrg';
import { useMobileSidebar } from './MobileSidebarContext';

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  leads: 'Leads',
  pipeline: 'Pipeline',
  workflows: 'Workflows',
  proposals: 'Propostas',
  analytics: 'Analytics',
  settings: 'Configurações',
  profile: 'Meu perfil',
  nexora: 'Nexora',
  tasks: 'Tarefas',
};

function getSection(pathname: string, slug: string): string {
  const relative = pathname.replace(`/${slug}/`, '').split('/')[0];
  return SECTION_TITLES[relative] ?? 'Nexora';
}

export function TopBar() {
  const pathname = usePathname();
  const { slug } = useTenant();
  const org = useOrg();
  const section = getSection(pathname, slug);
  const { toggle } = useMobileSidebar();

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center gap-3 px-4 bg-brand-surface border-b border-brand-border"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
      }}
    >
      {/* Hamburger — só no mobile */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Abrir menu"
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
      >
        <Menu size={18} />
      </button>

      <h1 className="text-sm font-semibold text-text-primary flex-1">{section}</h1>

      <span className="text-xs text-text-muted truncate max-w-[140px] hidden sm:block">{org.name}</span>
    </header>
  );
}
