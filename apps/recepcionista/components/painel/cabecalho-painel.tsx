"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { BotaoBaixarApp } from "@/components/install-prompt";
import { LogoutButton } from "@/components/logout-button";
import { PainelNavDesktop, type NavItem } from "@/components/painel/navegacao";

export function CabecalhoPainel({
  empresaNome,
  navItems,
}: {
  empresaNome: string;
  navItems: NavItem[];
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    if (menuAberto) {
      document.addEventListener("mousedown", handleClickFora);
    }
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [menuAberto]);

  return (
    <>
      {/* CABEÇALHO MOBILE COM IDENTIDADE VISUAL NEXORA */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-[#182229] px-4 py-3 text-white shadow-md border-b border-[#2A3942] sm:hidden">
        <div className="flex items-center gap-2.5">
          <Link href="/painel/atendente" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber text-night font-black text-sm shadow-sm ring-1 ring-white/25">
              N
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-lg font-bold tracking-tight text-white font-sans">
                  Nexora
                </span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase">
                  IA
                </span>
              </div>
              <span className="text-[10.5px] text-white/80 font-normal truncate max-w-[150px] leading-tight mt-0.5">
                {empresaNome}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Ícone de Busca do WhatsApp */}
          <Link
            href="/painel/conversas"
            aria-label="Buscar conversas"
            className="p-1 text-white/90 hover:text-white transition active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          {/* Menu de 3 Pontos do WhatsApp (⋮) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuAberto(!menuAberto)}
              aria-label="Mais opções"
              className="p-1 text-white/90 hover:text-white transition active:scale-95"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-white py-2 text-sm text-[#111B21] shadow-xl border border-[#E9EDEF] z-50 animate-in fade-in zoom-in-95 duration-100">
                <Link
                  href="/painel/clientes/importar"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F2F5] transition"
                >
                  <span>👥</span>
                  <span>Novo contato</span>
                </Link>
                <Link
                  href="/painel/treinamento"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F2F5] transition"
                >
                  <span>🔄</span>
                  <span>Ensinar atendente</span>
                </Link>
                <Link
                  href="/painel/agenda"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F2F5] transition"
                >
                  <span>📞</span>
                  <span>Agenda</span>
                </Link>
                <Link
                  href="/painel/assinatura"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F2F5] transition"
                >
                  <span>⚙️</span>
                  <span>Configurações & Planos</span>
                </Link>
                <div className="my-1 border-t border-[#E9EDEF]" />
                <div className="px-3 py-1">
                  <LogoutButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CABEÇALHO DESKTOP ESTILO WHATSAPP WEB */}
      <header className="hidden border-b border-[#E9EDEF] bg-[#F0F2F5] sm:block">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/painel/atendente" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#182229] text-amber font-black text-lg shadow-sm border border-amber/30 ring-2 ring-amber/10">
                N
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans font-bold text-base text-[#111B21] leading-tight">
                    Nexora
                  </span>
                  <span className="rounded bg-amber/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-deep tracking-wider uppercase">
                    Atendente
                  </span>
                </div>
                <span className="text-[11px] text-amber-deep leading-tight font-semibold">
                  Inteligência no WhatsApp
                </span>
              </div>
            </Link>
            <PainelNavDesktop items={navItems} />
          </div>
          <div className="flex items-center gap-3">
            <BotaoBaixarApp />
            <span className="text-sm font-medium text-[#667781]">{empresaNome}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
    </>
  );
}
