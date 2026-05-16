'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Zap,
  FileText,
  BarChart2,
  Settings,
  UsersRound,
  Plug,
  ClipboardList,
  CreditCard,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { UserDropdown } from './UserDropdown';
import { useOrg } from '@/lib/hooks/org/useOrg';
import { useTenant } from '@/lib/hooks/org/useTenant';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  exact?: boolean;
}

// Top-level items — the Nexora core surface: Dashboard, Clientes (recovery), Tarefas, Settings.
const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: 'dashboard', exact: true },
  { label: 'Clientes', icon: Users, href: 'clientes' },
  { label: 'Tarefas', icon: ClipboardList, href: 'tasks' },
];

// Nexora-specific navigation (shown only for barbershop niche)
const NEXORA_NAV: NavItem[] = [
  { label: 'Analytics', icon: BarChart2, href: 'nexora/analytics' },
  { label: 'Respostas', icon: MessageSquare, href: 'nexora/responses' },
  { label: 'Configuração', icon: Settings, href: 'settings/nexora' },
];

// Collapsed under "Avançado" — power features kept available but out of the way.
const ADVANCED_NAV: NavItem[] = [
  { label: 'Pipeline', icon: GitBranch, href: 'pipeline' },
  { label: 'Workflows', icon: Zap, href: 'workflows' },
  { label: 'Propostas', icon: FileText, href: 'proposals' },
  { label: 'Analytics', icon: BarChart2, href: 'analytics' },
];

const MANAGE_NAV: NavItem[] = [
  { label: 'Configurações', icon: Settings, href: 'settings', exact: true },
  { label: 'Equipe', icon: UsersRound, href: 'settings/team' },
  { label: 'Integrações', icon: Plug, href: 'settings/integrations' },
  { label: 'Plano', icon: CreditCard, href: 'settings/billing' },
];

interface SidebarNavItemProps {
  item: NavItem;
  basePath: string;
  pathname: string;
}

function SidebarNavItem({ item, basePath, pathname }: SidebarNavItemProps) {
  const href = `${basePath}/${item.href}`;
  const isActive = item.exact ? pathname === href : pathname.startsWith(href);
  const Icon = item.icon;

  return (
    <Link href={href} className={cn('sidebar-item', isActive && 'active')}>
      <Icon size={16} strokeWidth={1.75} />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const org = useOrg();
  const { slug } = useTenant();
  const pathname = usePathname();
  const basePath = `/${slug}`;

  // Check if org is in Nexora mode (barbershop niche)
  const isNexoraMode = org.niche === 'barbearia';

  // Auto-expand "Nexora" section if currently viewing Nexora routes
  const isOnNexoraRoute = isNexoraMode && NEXORA_NAV.some((item) =>
    pathname.startsWith(`${basePath}/${item.href}`),
  );

  // Auto-expand "Avançado" if the user is currently inside one of its routes,
  // so they don't lose visual context after navigating.
  const isOnAdvancedRoute = ADVANCED_NAV.some((item) =>
    pathname.startsWith(`${basePath}/${item.href}`),
  );

  const [nexoraOpen, setNexoraOpen] = useState(isOnNexoraRoute);
  const [advancedOpen, setAdvancedOpen] = useState(isOnAdvancedRoute);

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col bg-sidebar-bg border-r border-sidebar-border z-30"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo + org */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg bg-brand-amber flex items-center justify-center shrink-0">
          <span className="text-brand-bg text-xs font-bold">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">Nexora</p>
          <p className="text-2xs text-text-muted truncate">{org.name}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 scroll-y space-y-0.5">
        {/* Main section */}
        <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest px-2 mb-2">
          Principal
        </p>
        {MAIN_NAV.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            basePath={basePath}
            pathname={pathname}
          />
        ))}

        {/* Nexora section — visible only for barbershop niche */}
        {isNexoraMode && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setNexoraOpen((v) => !v)}
              aria-expanded={nexoraOpen}
              className="w-full flex items-center justify-between px-2 mb-1 text-2xs font-semibold text-text-muted uppercase tracking-widest hover:text-text-secondary transition-colors"
            >
              <span>Nexora</span>
              <ChevronDown
                size={12}
                className={cn(
                  'transition-transform duration-150',
                  nexoraOpen && 'rotate-180',
                )}
              />
            </button>
            {nexoraOpen && (
              <div className="space-y-0.5 animate-fade-in">
                {NEXORA_NAV.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    basePath={basePath}
                    pathname={pathname}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Advanced — collapsible, closed by default */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="w-full flex items-center justify-between px-2 mb-1 text-2xs font-semibold text-text-muted uppercase tracking-widest hover:text-text-secondary transition-colors"
          >
            <span>Avançado</span>
            <ChevronDown
              size={12}
              className={cn(
                'transition-transform duration-150',
                advancedOpen && 'rotate-180',
              )}
            />
          </button>
          {advancedOpen && (
            <div className="space-y-0.5 animate-fade-in">
              {ADVANCED_NAV.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  basePath={basePath}
                  pathname={pathname}
                />
              ))}
            </div>
          )}
        </div>

        {/* Manage section */}
        <div className="pt-4">
          <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest px-2 mb-2">
            Gerenciar
          </p>
          {MANAGE_NAV.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              basePath={basePath}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <UserDropdown />
      </div>
    </aside>
  );
}
