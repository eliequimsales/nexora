"use client";

import Link from "next/link";
interface WhatsAppDemoCardProps {
  className?: string;
  origem?: "hero" | "cadastro" | "atendente" | "precos";
}

export function WhatsAppDemoCard({ className = "", origem = "hero" }: WhatsAppDemoCardProps) {

  return (
    <div
      className={`rounded-2xl border border-nx-gold/40 bg-nx-surface/90 p-5 shadow-nx-glow-sm transition-all hover:border-nx-gold/60 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-nx-success/30 bg-nx-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-nx-success">
            <span className="h-1.5 w-1.5 rounded-full bg-nx-success animate-pulse" />
            Simulador Interativo do WhatsApp
          </div>
          <h3 className="mt-2 text-sm sm:text-base font-bold text-nx-primary">
            Prefere ver funcionando antes de criar conta?
          </h3>
          <p className="mt-1 text-xs text-nx-secondary leading-relaxed">
            Experimente o simulador de WhatsApp na própria página: converse em tempo real, veja a velocidade da resposta e como ele fecha agendamentos sem você digitar nada.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 w-full sm:w-auto">
          <Link
            href="/#simulador"
            data-origem={origem}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-nx-gold px-5 py-3 text-xs sm:text-sm font-bold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            💬 Testar no Simulador ao Vivo ↓
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-nx-border/40 pt-2.5 text-[11px] text-nx-muted">
        <span className="flex items-center gap-1 text-nx-secondary font-medium">
          ✓ Sem sair da página
        </span>
        <span>•</span>
        <span>Simulação com IA em tempo real</span>
        <span>•</span>
        <span>Veja exatamente o que seu cliente vai sentir</span>
      </div>
    </div>
  );
}
