"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { NomeDeEvento } from "@/lib/funil";
import {
  trackCustom,
  trackViewContent,
  trackCompleteRegistration,
} from "@/lib/analytics/pixel";
import { obterUtmsSalvas } from "@/lib/analytics/utm";

/**
 * O gancho de instrumentação, do lado do navegador.
 *
 * `keepalive` no fetch: sem ele, o evento de clique que leva a pessoa para o
 * WhatsApp é cancelado quando a aba perde o foco — e "clicou_mensagem" seria
 * justamente o evento mais subcontado, que é o que mede se o produto gerou AÇÃO.
 *
 * A sessão é sorteada e vive em sessionStorage: liga as etapas da mesma visita
 * entre si e morre quando a aba fecha. Não identifica pessoa e não atravessa
 * visitas — o objetivo é saber onde o funil quebra, não quem é quem.
 */
function sessaoAnonima(): string | null {
  try {
    const CHAVE = "nx_s";
    let s = sessionStorage.getItem(CHAVE);
    if (!s) {
      s = Math.random().toString(36).slice(2, 14).replace(/[^a-z0-9]/g, "") || "anon00";
      sessionStorage.setItem(CHAVE, s);
    }
    return s;
  } catch {
    // Navegador com armazenamento bloqueado. O evento ainda vale sem sessão:
    // perde-se o encadeamento, não a contagem.
    return null;
  }
}

function criativoDaUrl(): string | null {
  try {
    const daUrl = new URLSearchParams(window.location.search).get("c");
    if (daUrl) return daUrl;
    const utms = obterUtmsSalvas();
    return utms?.criativo || null;
  } catch {
    return null;
  }
}

export function registrar(nome: NomeDeEvento): void {
  try {
    void fetch("/api/funil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, criativo: criativoDaUrl(), sessao: sessaoAnonima() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Métrica nunca derruba produto.
  }

  // Ponte com Meta Pixel
  try {
    if (nome === "usou_calculadora") trackCustom("UsedCalculator");
    else if (nome === "clicou_calculadora") trackCustom("ClickCalculatorCTA");
    else if (nome === "chegou") trackViewContent("Diagnóstico Início");
    else if (nome === "comecou_entrada") trackCustom("StartedDiagnosisInput");
    else if (nome === "viu_numero") trackCustom("ViewDiagnosisResult");
    else if (nome === "clicou_mensagem") trackCustom("ClickDiagnosisMessage");
    else if (nome === "criou_conta") trackCompleteRegistration("funil_diagnostico");
  } catch {
    // Métrica nunca derruba produto.
  }
}

/** Dispara um evento uma vez, quando a tela monta. */
export function EventoAoMontar({ nome }: { nome: NomeDeEvento }) {
  useEffect(() => {
    registrar(nome);
  }, [nome]);
  return null;
}

/** Dispara evento ViewContent do Meta Pixel quando o componente monta. */
export function TrackViewContent({
  name,
  extra,
}: {
  name: string;
  extra?: Record<string, unknown>;
}) {
  useEffect(() => {
    trackViewContent(name, extra);
  }, [name, extra]);

  return null;
}

/** Link com medição de clique nos CTAs principais do funil. */
export function CtaLink({
  href,
  className,
  children,
  ctaName,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  ctaName: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackCustom("ClickSignupCTA", { cta_location: ctaName });
      }}
    >
      {children}
    </Link>
  );
}
