'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Settings, Users } from 'lucide-react';

// Piloto enxuto: só o essencial. IA/Templates/Integrações/Billing/Auditoria ficam
// fora da experiência da clínica (rotas seguem existindo, mas sem poluir o menu).
const NAV_ITEMS = [
  { label: 'Geral', href: '', icon: Settings },
  { label: 'Time', href: '/team', icon: Users },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/settings`;

  const navItems = NAV_ITEMS;

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-44 shrink-0 border-r border-brand-border bg-brand-surface px-3 py-5 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
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
