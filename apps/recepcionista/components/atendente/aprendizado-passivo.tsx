"use client";

import { useState } from "react";

export interface ObservacaoPassiva {
  id: string;
  pergunta: string;
  resposta: string;
}

export function AprendizadoPassivo({
  observacoes,
  aoAtualizar,
}: {
  observacoes: ObservacaoPassiva[];
  aoAtualizar: () => void;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [respostaEditada, setRespostaEditada] = useState("");
  const [perguntaEditada, setPerguntaEditada] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  if (!observacoes || observacoes.length === 0) return null;

  async function decidir(
    id: string,
    action: "aprovar" | "rejeitar",
    edits?: { question?: string; answer?: string },
  ) {
    setOcupado(id);
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
        setEditandoId(null);
        aoAtualizar();
        setTimeout(() => setSucesso(null), 4000);
      }
    } catch {
      // silencioso
    } finally {
      setOcupado(null);
    }
  }

  function iniciarEdicao(obs: ObservacaoPassiva) {
    setEditandoId(obs.id);
    setPerguntaEditada(obs.pergunta);
    setRespostaEditada(obs.resposta);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber/40 bg-amber/5 p-5 shadow-xs">
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
            Você respondeu a um cliente recentemente. Posso usar essa resposta nos próximos atendimentos?
          </p>
        </div>
      </div>

      {sucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {sucesso}
        </div>
      )}

      <div className="space-y-3 pt-1">
        {observacoes.map((obs) => {
          const estaEditando = editandoId === obs.id;
          const estaOcupado = ocupado === obs.id;

          return (
            <div
              key={obs.id}
              className="rounded-xl border border-panel-line bg-white p-4 shadow-2xs space-y-3"
            >
              {estaEditando ? (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-panel-sub uppercase">
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
                    <label className="block text-[11px] font-semibold text-panel-sub uppercase">
                      Sua resposta ideal:
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
                      disabled={estaOcupado}
                      onClick={() =>
                        decidir(obs.id, "aprovar", {
                          question: perguntaEditada,
                          answer: respostaEditada,
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                    >
                      Salvar e Usar Sempre
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId(null)}
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

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={estaOcupado}
                      onClick={() => decidir(obs.id, "aprovar")}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
                    >
                      ✓ Usar sempre
                    </button>
                    <button
                      type="button"
                      disabled={estaOcupado}
                      onClick={() => iniciarEdicao(obs)}
                      className="rounded-lg border border-panel-line bg-white px-3 py-1.5 text-xs font-semibold text-panel-ink hover:border-amber transition disabled:opacity-50"
                    >
                      ✏️ Corrigir
                    </button>
                    <button
                      type="button"
                      disabled={estaOcupado}
                      onClick={() => decidir(obs.id, "rejeitar")}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-panel-sub hover:text-red-700 transition disabled:opacity-50"
                    >
                      ✕ Vale só para este caso
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
