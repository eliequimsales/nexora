"use client";

import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

interface WhatsAppDemoCardProps {
  className?: string;
  origem?: "hero" | "cadastro" | "atendente" | "precos";
}

export function WhatsAppDemoCard({ className = "", origem = "hero" }: WhatsAppDemoCardProps) {
  const linkWhatsApp = obterLinkWhatsAppDemo();

  return (
    <div
      className={`rounded-2xl border border-nx-gold/40 bg-nx-surface/90 p-5 shadow-nx-glow-sm transition-all hover:border-nx-gold/60 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-nx-success/30 bg-nx-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-nx-success">
            <span className="h-1.5 w-1.5 rounded-full bg-nx-success animate-pulse" />
            Demonstração ao Vivo no WhatsApp
          </div>
          <h3 className="mt-2 text-sm sm:text-base font-bold text-nx-primary">
            Prefere ver funcionando antes de criar conta?
          </h3>
          <p className="mt-1 text-xs text-nx-secondary leading-relaxed">
            Mande um &quot;Oi&quot; no WhatsApp do nosso Atendente Virtual e veja como ele responde instantaneamente,
            informa horários e fecha agendamentos sem você digitar nada.
          </p>
        </div>

        <a
          href={linkWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          data-origem={origem}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-nx-success px-5 py-3 text-xs sm:text-sm font-bold text-nx-bg shadow-sm transition-all hover:bg-nx-success/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.199.534 1.286.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z" />
          </svg>
          Mandar &quot;Oi&quot; no WhatsApp →
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-nx-border/40 pt-2.5 text-[11px] text-nx-muted">
        <span className="flex items-center gap-1 text-nx-secondary font-medium">
          ✓ Responde em segundos
        </span>
        <span>•</span>
        <span>Sem cadastro ou cartão</span>
        <span>•</span>
        <span>Veja exatamente o que seu cliente vai sentir</span>
      </div>
    </div>
  );
}
