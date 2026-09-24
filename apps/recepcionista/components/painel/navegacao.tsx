"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

function iconeParaRota(href: string) {
  if (href.includes("clientes")) {
    return (
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
  }
  if (href.includes("onda")) {
    return (
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    );
  }
  if (href.includes("atendente")) {
    return (
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    );
  }
  if (href.includes("livro-caixa")) {
    return (
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }
  if (href.includes("agenda")) {
    return (
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );
  }
  // Planos / Assinatura
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3z"
      />
    </svg>
  );
}

function estaAtivo(href: string, pathname: string): boolean {
  if (href === "/painel/clientes/importar") {
    return pathname.startsWith("/painel/clientes");
  }
  return pathname.startsWith(href);
}

export function PainelNavDesktop({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="hidden items-center sm:flex">
      <div className="flex items-center gap-1 rounded-xl border border-panel-line/70 bg-panel-bg/80 p-1">
        {items.map((item) => {
          const ativo = estaAtivo(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                ativo
                  ? "bg-amber text-night font-bold shadow-sm"
                  : "text-panel-sub hover:bg-white hover:text-panel-ink"
              }`}
            >
              <span className={ativo ? "text-night" : "text-panel-sub group-hover:text-panel-ink"}>
                {iconeParaRota(item.href)}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PainelNavMobile({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu principal para celular"
      className="border-b border-panel-line bg-panel-card px-3 py-2 sm:hidden"
    >
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-panel-line/80 bg-panel-bg p-1 shadow-inner">
        {items.map((item) => {
          const ativo = estaAtivo(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-center transition-all duration-200 active:scale-[0.93] ${
                ativo
                  ? "bg-amber text-night font-bold shadow-sm ring-1 ring-amber/50"
                  : "bg-panel-card/70 text-panel-sub border border-panel-line/40 hover:bg-panel-card hover:text-panel-ink"
              }`}
            >
              <span
                className={`transition-transform duration-200 ${
                  ativo ? "scale-110 text-night" : "text-panel-sub"
                }`}
              >
                {iconeParaRota(item.href)}
              </span>
              <span className="text-[11px] font-semibold leading-tight tracking-tight">
                {item.label}
              </span>
              {ativo && (
                <span
                  className="h-1 w-3 rounded-full bg-night/70 animate-pulse"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
