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
import { useUnreadResponses } from '@/lib/hooks/nexora/useUnreadResponses';
import { useMobileSidebar } from './MobileSidebarContext';
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
  badgeCount?: number;
  onNavigate?: () => void;
}

function SidebarNavItem({ item, basePath, pathname, badgeCount, onNavigate }: SidebarNavItemProps) {
  const href = `${basePath}/${item.href}`;
  const isActive = item.exact ? pathname === href : pathname.startsWith(href);
  const Icon = item.icon;

  return (
    <Link href={href} onClick={onNavigate} className={cn('sidebar-item', isActive && 'active')}>
      <Icon size={16} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {badgeCount && badgeCount > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-2xs font-bold rounded-full bg-brand-gold text-brand-bg">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const org = useOrg();
  const { slug } = useTenant();
  const pathname = usePathname();
  const basePath = `/${slug}`;
  const { isOpen, close } = useMobileSidebar();

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

  // Unread customer responses — only meaningful in Nexora mode.
  // The hook reads from React Query so it shares cache with the responses page.
  const { unreadCount } = useUnreadResponses();

  // Fecha o drawer ao navegar (mobile)
  const handleNavigate = () => close();

  return (
    <>
      {/* Overlay — visível só no mobile quando o drawer está aberto */}
      {isOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 flex flex-col bg-sidebar-bg border-r border-sidebar-border z-50 w-[240px] transition-transform duration-200',
          // Mobile: esconde por padrão, abre via drawer
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: sempre visível, sem translate
          'md:translate-x-0',
        )}
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
            onNavigate={handleNavigate}
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
                    badgeCount={item.href === 'nexora/responses' ? unreadCount : undefined}
                    onNavigate={handleNavigate}
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
                  onNavigate={handleNavigate}
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
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <UserDropdown />
      </div>
    </aside>
    </>
  );
}
