"use client";

import { useEffect, useState } from "react";

export interface ObservacaoPassiva {
  id: string;
  pergunta: string;
  resposta: string;
}

/**
 * Detecta termos comuns de exceção ou condição temporária/pessoal.
 */
export function ehCondicaoPontual(resposta: string): boolean {
  return /\b(hoje|agora|só hoje|so hoje|apenas hoje|nesta semana|neste mês|neste mes|pra você|pra vc|para você|para vc|te faço|te faco|consigo te|faço por|faco por|abro uma exceção|abro uma excecao)\b/i.test(
    resposta,
  );
}

export function AprendizadoPassivo({
  observacoes,
  aoAtualizar,
}: {
  observacoes: ObservacaoPassiva[];
  aoAtualizar: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [editando, setEditando] = useState(false);
  const [respostaEditada, setRespostaEditada] = useState("");
  const [perguntaEditada, setPerguntaEditada] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Ajusta o índice se a lista encolher
  useEffect(() => {
    if (indice >= observacoes.length) {
      setIndice(Math.max(0, observacoes.length - 1));
    }
  }, [observacoes.length, indice]);

  if (!observacoes || observacoes.length === 0) return null;

  const obs = observacoes[indice] || observacoes[0];
  if (!obs) return null;

  const condicaoDetectada = ehCondicaoPontual(obs.resposta);

  async function decidir(
    id: string,
    action: "aprovar" | "rejeitar",
    edits?: { question?: string; answer?: string },
  ) {
    setOcupado(true);
    setSucesso(null);
    try {
      const res = await fetch(`/api/training/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(edits ? edits : {}),
        }),
      });

      if (res.ok) {
        setSucesso(
          action === "aprovar"
            ? "✓ Entendido! Seu atendente já aprendeu essa resposta para os próximos clientes."
            : "✓ Combinado! Essa resposta não será usada como regra geral.",
        );
        setEditando(false);
        aoAtualizar();
        setTimeout(() => setSucesso(null), 4000);
      }
    } catch {
      // silencioso
    } finally {
      setOcupado(false);
    }
  }

  function iniciarEdicao() {
    setEditando(true);
    setPerguntaEditada(obs.pergunta);
    setRespostaEditada(obs.resposta);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber/40 bg-amber/5 p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber text-xs font-bold text-night"
            aria-hidden="true"
          >
            💡
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-panel-ink">
              Aprendi com seu atendimento no WhatsApp
            </h3>
            <p className="text-xs text-panel-sub">
              Você respondeu a um cliente recentemente. Posso usar essa informação?
            </p>
          </div>
        </div>

        {observacoes.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-amber/20 px-2 py-0.5 font-semibold text-amber-deep">
              {indice + 1} de {observacoes.length}
            </span>
            <button
              type="button"
              disabled={indice === 0 || ocupado}
              onClick={() => {
                setEditando(false);
                setIndice((prev) => Math.max(0, prev - 1));
              }}
              className="rounded p-1 text-panel-sub hover:text-panel-ink disabled:opacity-30"
              title="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={indice >= observacoes.length - 1 || ocupado}
              onClick={() => {
                setEditando(false);
                setIndice((prev) => Math.min(observacoes.length - 1, prev + 1));
              }}
              className="rounded p-1 text-panel-sub hover:text-panel-ink disabled:opacity-30"
              title="Próxima"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {sucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {sucesso}
        </div>
      )}

      <div className="rounded-xl border border-panel-line bg-white p-4 shadow-2xs space-y-3">
        {editando ? (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-panel-sub">
                Pergunta do cliente:
              </label>
              <input
                type="text"
                value={perguntaEditada}
                onChange={(e) => setPerguntaEditada(e.target.value)}
                className="mt-1 w-full rounded-lg border border-panel-line px-3 py-1.5 text-xs text-panel-ink focus:border-amber focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-panel-sub">
                Sua resposta ideal para todos os clientes:
              </label>
              <textarea
                rows={3}
                value={respostaEditada}
                onChange={(e) => setRespostaEditada(e.target.value)}
                className="mt-1 w-full rounded-lg border border-panel-line px-3 py-1.5 text-xs text-panel-ink focus:border-amber focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  decidir(obs.id, "aprovar", {
                    question: perguntaEditada,
                    answer: respostaEditada,
                  })
                }
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                Salvar e Usar Sempre
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded-lg border border-panel-line px-3 py-1.5 text-xs font-semibold text-panel-sub hover:text-panel-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1 text-xs">
              <p className="text-panel-sub">
                Cliente perguntou:{" "}
                <span className="font-semibold text-panel-ink">&ldquo;{obs.pergunta}&rdquo;</span>
              </p>
              <p className="text-panel-sub">
                Você respondeu:{" "}
                <span className="font-bold text-emerald-800">&ldquo;{obs.resposta}&rdquo;</span>
              </p>
            </div>

            {condicaoDetectada && (
              <div className="rounded-lg border border-amber/30 bg-amber/10 p-2.5 text-[11px] text-panel-ink leading-relaxed">
                <span className="font-bold text-amber-deep">⚠️ Condição pontual detectada:</span> Sua
                resposta menciona uma condição momentânea ou pessoal (&ldquo;hoje&rdquo; / &ldquo;para você&rdquo;).
                <div className="mt-0.5 text-panel-sub">
                  Se foi uma exceção para este cliente, use <strong>Vale só para este caso</strong>. Se
                  for a regra geral, use <strong>Corrigir</strong> para definir o padrão da empresa.
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => decidir(obs.id, "aprovar")}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                ✓ Usar sempre
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={iniciarEdicao}
                className="rounded-lg border border-panel-line bg-white px-3 py-1.5 text-xs font-semibold text-panel-ink transition hover:border-amber disabled:opacity-50"
              >
                ✏️ Corrigir
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => decidir(obs.id, "rejeitar")}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-panel-sub transition hover:text-red-700 disabled:opacity-50"
              >
                ✕ Vale só para este caso
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
