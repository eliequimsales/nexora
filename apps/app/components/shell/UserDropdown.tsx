'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, UserCircle, Settings, ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { useTenant } from '@/lib/hooks/org/useTenant';
import { cn } from '@/lib/utils';

interface UserDropdownProps {
  collapsed?: boolean;
}

export function UserDropdown({ collapsed = false }: UserDropdownProps) {
  const { user, logout } = useAuth();
  const { url } = useTenant();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2.5 w-full rounded-lg px-2 py-2',
          'text-left transition-colors duration-150',
          'hover:bg-sidebar-item-active-bg',
          open && 'bg-sidebar-item-active-bg'
        )}
      >
        <Avatar name={user.name} src={user.avatarUrl ?? undefined} size="sm" />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-2xs text-text-muted truncate capitalize">{user.role}</p>
            </div>
            <ChevronDown
              size={13}
              className={cn(
                'text-text-muted shrink-0 transition-transform duration-150',
                open && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 w-52 rounded-xl border border-brand-border bg-brand-surface',
            'shadow-modal py-1 animate-scale-in',
            collapsed ? 'left-12 bottom-0' : 'bottom-full left-0 mb-1'
          )}
        >
          <div className="px-3 py-2 border-b border-brand-border mb-1">
            <p className="text-xs font-medium text-text-primary truncate">{user.name}</p>
            <p className="text-2xs text-text-muted truncate">{user.email}</p>
          </div>

          <button
            onClick={() => { router.push(url('profile')); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
          >
            <UserCircle size={14} />
            Meu perfil
          </button>

          <button
            onClick={() => { router.push(url('settings')); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
          >
            <Settings size={14} />
            Configurações
          </button>

          <div className="border-t border-brand-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-muted hover:text-status-error hover:bg-status-error-muted transition-colors"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
