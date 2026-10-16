"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

function useTreinamentoBadge(initialBadge?: number) {
  const [count, setCount] = useState<number>(initialBadge ?? 0);
  const pathname = usePathname();

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      try {
        const res = await fetch("/api/training/count");
        if (!res.ok) return;
        const data = await res.json();
        if (ativo && typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {}
    }

    void atualizar();
    const timer = setInterval(() => void atualizar(), 8000);
    const handler = () => void atualizar();
    window.addEventListener("duvidas-atualizadas", handler);

    return () => {
      ativo = false;
      clearInterval(timer);
      window.removeEventListener("duvidas-atualizadas", handler);
    };
  }, [pathname]);

  return count;
}

function iconeParaRota(href: string) {
  // Ensinar Atendente (Ícone Livro / Conhecimento)
  if (href.includes("treinamento")) {
    return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    );
  }
  // Meus Clientes (Ícone Contatos / Clientes)
  if (href.includes("clientes")) {
    return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    );
  }
  // Atendente / Conversas (Ícone Balão de Conversa oficial do WhatsApp com linhas de texto)
  if (href.includes("atendente") || href.includes("conversas")) {
    return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    );
  }
  // Agenda (Ícone Calendário de Marcações)
  if (href.includes("agenda")) {
    return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );
  }
  // Planos / Ajustes (Ícone Engrenagem de Configurações)
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
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
  const initialTreinamento = items.find((i) => i.href === "/painel/treinamento")?.badge;
  const liveBadge = useTreinamentoBadge(initialTreinamento);

  return (
    <nav aria-label="Menu principal" className="hidden items-center sm:flex">
      <div className="flex items-center gap-1.5 rounded-xl border border-panel-line/80 bg-white p-1 shadow-2xs">
        {items.map((item) => {
          const ativo = estaAtivo(item.href, pathname);
          const badge = item.href === "/painel/treinamento" ? liveBadge : (item.badge ?? 0);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                ativo
                  ? "bg-[#182229] text-amber shadow-xs border border-amber/30"
                  : "text-panel-sub hover:bg-[#F0F2F5] hover:text-panel-ink"
              }`}
            >
              <span className={ativo ? "text-amber" : "text-[#54656f] group-hover:text-panel-ink"}>
                {iconeParaRota(item.href)}
              </span>
              <span>{item.label}</span>
              {Boolean(badge > 0) && (
                <span
                  className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-black ${
                    ativo ? "bg-amber text-night" : "bg-amber text-night animate-pulse ring-1 ring-night/10"
                  }`}
                  aria-label={`${badge} para ensinar`}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PainelNavMobile({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const initialTreinamento = items.find((i) => i.href === "/painel/treinamento")?.badge;
  const liveBadge = useTreinamentoBadge(initialTreinamento);

  const rotuloCurto = (href: string, label: string) => {
    if (href.includes("atendente")) return "Conversas";
    if (href.includes("treinamento")) return "Ensinar Atendente";
    if (href.includes("clientes")) return "Clientes";
    if (href.includes("agenda")) return "Agenda";
    if (href.includes("assinatura")) return "Ajustes";
    return label;
  };

  return (
    <nav
      aria-label="Navegação móvel oficial estilo WhatsApp"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E9EDEF] bg-white/98 backdrop-blur-lg px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden shadow-[0_-2px_15px_rgba(0,0,0,0.05)]"
    >
      <div className="grid grid-cols-5 items-center justify-around">
        {items.map((item) => {
          const ativo = estaAtivo(item.href, pathname);
          const badge = item.href === "/painel/treinamento" ? liveBadge : (item.badge ?? 0);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className="relative flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-95"
            >
              {/* Pílula ativa característica do WhatsApp (Material You / WhatsApp Mobile) */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`flex items-center justify-center px-4 py-0.5 rounded-full transition-colors ${
                    ativo ? "bg-amber/25 text-night font-bold ring-1 ring-amber/40" : "text-[#54656f]"
                  }`}
                >
                  {iconeParaRota(item.href)}
                </div>
                {Boolean(badge > 0) && (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber text-night px-1 text-[10px] font-black shadow-xs animate-pulse ring-1 ring-night/10"
                    aria-label={`${badge} notificações`}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 text-center leading-tight line-clamp-2 max-w-full px-0.5 ${
                  ativo ? "font-black text-night" : "font-medium text-[#54656f]"
                }`}
              >
                {rotuloCurto(item.href, item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
