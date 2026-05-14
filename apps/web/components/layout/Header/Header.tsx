'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const NAV_LINKS = [
  { label: 'Produto', href: '/produto' },
  { label: 'Preços', href: '/precos' },
  { label: 'Nichos', href: '/nichos' },
  { label: 'Sobre', href: '/sobre' },
  { label: 'Blog', href: '/blog' },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'glass border-b border-brand-border/60 py-3'
          : 'py-5',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            onClick={() => setMobileOpen(false)}
          >
            <span className="w-7 h-7 rounded-lg bg-brand-amber flex items-center justify-center text-text-inverse font-bold text-sm transition-all duration-200 group-hover:shadow-glow-amber-sm">
              N
            </span>
            <span className="font-semibold text-text-primary tracking-tight">
              Nexora
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-brand-surface transition-all duration-150"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTAs desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/cadastro">Começar grátis</Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] bg-brand-bg z-40 flex flex-col p-6 gap-2 animate-fade-in">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-3 text-base text-text-secondary hover:text-text-primary rounded-xl hover:bg-brand-surface transition-all"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 pt-4 border-t border-brand-border flex flex-col gap-2">
            <Button variant="secondary" size="lg" className="w-full" asChild>
              <Link href="/login" onClick={() => setMobileOpen(false)}>Entrar</Link>
            </Button>
            <Button variant="primary" size="lg" className="w-full" asChild>
              <Link href="/cadastro" onClick={() => setMobileOpen(false)}>Começar grátis</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
