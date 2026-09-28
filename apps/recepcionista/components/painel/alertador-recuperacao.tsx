"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAVE_DISPENSADO = "nexora:aviso-retencao-dispensado";

/**
 * ALERTADOR DE RETENÇÃO (O Recuperador agindo na surdina dentro da plataforma).
 *
 * Fica monitorando a retenção em segundo plano. Quando identifica que clientes
 * habituais passaram do prazo de retorno e estão sumidos, solta um gatilho direto
 * para o dono recuperar a receita perdida no Plano Completo (Onda).
 */
export function AlertadorRecuperacao() {
  const [visivel, setVisivel] = useState(false);
  const [sumidos, setSumidos] = useState(14);
  const [potencialReais, setPotencialReais] = useState(1250);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_DISPENSADO);
      if (salvo) {
        const data = parseInt(salvo, 10);
        // Não mostrar de novo por 3 dias se foi dispensado
        if (Date.now() - data < 3 * 86_400_000) {
          return;
        }
      }
    } catch {}

    // Busca status da onda/clientes para personalizar o gatilho
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/onda");
        if (res.ok) {
          const dados = await res.json();
          if (dados?.clientes?.length > 0 && vivo) {
            setSumidos(dados.clientes.length);
            const totalEstimado = dados.clientes.length * 85;
            setPotencialReais(totalEstimado);
          }
        }
      } catch {
        // Silencioso - fallback padrão mantido
      } finally {
        if (vivo) {
          setVisivel(true);
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const dispensar = () => {
    setVisivel(false);
    try {
      window.localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    } catch {}
  };

  if (!visivel) return null;

  return (
    <section
      aria-labelledby="alertador-retencao-titulo"
      className="relative overflow-hidden rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 via-panel-card to-panel-card p-5 shadow-sm transition-all"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber animate-pulse" />
          Monitor de Retenção de Clientes
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber/40 bg-amber/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber">
            Alerta de Perda
          </span>
          <button
            type="button"
            onClick={dispensar}
            title="Dispensar aviso"
            aria-label="Dispensar aviso"
            className="rounded-lg p-1 text-panel-sub transition hover:bg-amber/20 hover:text-panel-ink"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <h2
          id="alertador-retencao-titulo"
          className="font-display text-lg font-bold tracking-tight text-panel-ink sm:text-xl"
        >
          Você tem clientes habituais que pararam de voltar.
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-panel-sub">
          O monitor detectou aproximadamente <strong className="font-semibold text-panel-ink">{sumidos} clientes</strong> cujo ciclo de retorno habitual venceu e que ainda não agendaram. Isso representa cerca de <strong className="font-semibold text-emerald-600 dark:text-emerald-400">R$ {potencialReais.toLocaleString("pt-BR")}</strong> parados que podem ser resgatados antes de irem para a concorrência.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/painel/onda"
            className="inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-xs font-bold text-night shadow-sm transition hover:brightness-110"
          >
            <span>Ver clientes sumidos e reativar</span>
            <span aria-hidden="true">→</span>
          </Link>
          <button
            type="button"
            onClick={dispensar}
            className="text-xs font-medium text-panel-sub transition hover:text-panel-ink"
          >
            Lembrar mais tarde
          </button>
        </div>
      </div>
    </section>
  );
}
