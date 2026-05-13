'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Settings, Users, Sparkles, Plug, CreditCard, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Geral', href: '', icon: Settings },
  { label: 'Time', href: '/team', icon: Users },
  { label: 'IA', href: '/ai', icon: Sparkles },
  { label: 'Integrações', href: '/integrations', icon: Plug },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Auditoria', href: '/audit', icon: Shield },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/settings`;

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-44 shrink-0 border-r border-brand-border bg-brand-surface px-3 py-5 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const fullHref = `${base}${href}`;
          const isActive = href === ''
            ? pathname === base
            : pathname.startsWith(fullHref);

          return (
            <Link
              key={label}
              href={fullHref}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-amber/10 text-brand-amber font-medium'
                  : 'text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
