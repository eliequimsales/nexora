"use client";

import { useEffect } from "react";
import type { NomeDeEvento } from "@/lib/funil";

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
    return new URLSearchParams(window.location.search).get("c");
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
}

/** Dispara um evento uma vez, quando a tela monta. */
export function EventoAoMontar({ nome }: { nome: NomeDeEvento }) {
  useEffect(() => {
    registrar(nome);
  }, [nome]);
  return null;
}
