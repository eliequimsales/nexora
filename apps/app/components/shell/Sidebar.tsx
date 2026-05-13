'use client';

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

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: 'dashboard', exact: true },
  { label: 'Leads', icon: Users, href: 'leads' },
  { label: 'Pipeline', icon: GitBranch, href: 'pipeline' },
  { label: 'Tarefas', icon: ClipboardList, href: 'tasks' },
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

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col bg-sidebar-bg border-r border-sidebar-border z-30"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo + org */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg bg-brand-amber flex items-center justify-center shrink-0">
          <span className="text-brand-bg text-xs font-bold">B</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">B&apos;reshit</p>
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
