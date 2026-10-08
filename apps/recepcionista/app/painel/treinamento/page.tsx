"use client";

import { useCallback, useEffect, useState } from "react";

interface Gap {
  id: string;
  question: string;
  askCount: number;
  source: string;
}

interface Item {
  id: string;
  question: string;
  answer: string;
  source: string;
  approvedAt?: string;
}

interface Inconsistency {
  question: string;
  options: { id: string; answer: string }[];
}

interface Report {
  stats: { totalConversations: number; resolvedByAttendant: number; sentToTeam: number };
  topGaps: Gap[];
  approvedItems?: Item[];
  pendingItems: Item[];
  observations: Item[];
  inconsistencies: Inconsistency[];
  interview: { segmentName: string; topics: { topic: string; question: string }[] } | null;
  score: { overall: number; areas: { label: string; pct: number }[]; openGaps: number };
  diary: string[];
}

const inputClass =
  "w-full rounded-xl border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber shadow-xs";

function Card({
  title,
  hint,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6 shadow-xs">
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-lg font-semibold text-panel-ink">{title}</h2>
        {badge}
      </div>
      {hint && <p className="mt-1 text-sm text-panel-sub">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function TreinamentoPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");
  const [excludedTopics, setExcludedTopics] = useState<Set<string>>(new Set());

  function showThanks(message: string) {
    setThanks(message);
    setTimeout(() => setThanks(""), 5000);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/training");
    if (res.ok) {
      setReport(await res.json());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("duvidas-atualizadas"));
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, method: string, body: unknown, key: string, thanksMessage?: string) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Algo deu errado. Tente novamente.");
        return;
      }
      if (thanksMessage) showThanks(thanksMessage);
      await load();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("duvidas-atualizadas"));
      }
    } finally {
      setBusy(null);
    }
  }

  if (!report) {
    return <p className="p-8 text-center text-sm text-panel-sub">Abrindo a central de ensino...</p>;
  }

  const { topGaps, approvedItems = [], pendingItems, observations, inconsistencies, interview, diary } = report;

  async function beginInterview() {
    if (!interview) return;
    const topics = interview.topics.map((t) => t.topic).filter((t) => !excludedTopics.has(t));
    await call(
      "/api/training/interview",
      "POST",
      { topics },
      "interview",
      "Perfeito! Vou te perguntar aos poucos, começando pelos assuntos abaixo. 👇",
    );
  }

  async function resolveInconsistency(group: Inconsistency, chosenId: string) {
    setBusy(chosenId);
    setError("");
    try {
      for (const option of group.options) {
        await fetch(`/api/training/items/${option.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: option.id === chosenId ? "aprovar" : "rejeitar" }),
        });
      }
      showThanks("Obrigado! Agora sei qual é a resposta correta. 🙌");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-panel-ink">Ensinar Atendente</h1>
            {topGaps.length > 0 && (
              <span
                className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber px-1.5 text-xs font-black text-night shadow-xs animate-pulse"
                title={`${topGaps.length} ${topGaps.length === 1 ? "dúvida para ensinar" : "dúvidas para ensinar"}`}
              >
                {topGaps.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-panel-sub">
            Perguntas feitas no WhatsApp e no simulador que ele ainda não sabia responder.
          </p>
        </div>
        {topGaps.length > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/15 px-3.5 py-1.5 text-xs font-bold text-amber-deep shadow-xs">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1 text-[11px] font-black text-night shadow-xs">
              {topGaps.length}
            </span>
            <span>{topGaps.length === 1 ? "dúvida para ensinar" : "dúvidas para ensinar"}</span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span>✓</span> Em dia
          </span>
        )}
      </div>

      {/* Saudação do atendente */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/10 p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/20 text-lg" aria-hidden="true">
          🙋‍♂️
        </span>
        <div className="text-sm leading-relaxed text-panel-ink">
          <p className="font-semibold">Olá! Estou sempre aprendendo com você.</p>
          <p className="mt-1 text-panel-sub">
            Quando clientes me perguntam algo que não tenho certeza, anoto abaixo para você me ensinar. O que você me ensinar, passo a responder imediatamente no WhatsApp.
          </p>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {thanks && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {thanks}
        </p>
      )}

      {/* Respostas observadas no WhatsApp */}
      {observations && observations.length > 0 && (
        <Card
          title="Respostas capturadas do seu WhatsApp"
          badge={
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1 text-[11px] font-black text-emerald-800 shadow-xs">
              {observations.length}
            </span>
          }
          hint="Perguntas que você mesmo respondeu aos clientes pelo WhatsApp. Aprova com 1 toque para o atendente usar sempre, ajuste se necessário ou descarte se for uma exceção."
        >
          <div className="space-y-3">
            {observations.map((obs) => {
              const estaEditando = edits[obs.id] !== undefined;
              return (
                <div key={obs.id} className="rounded-xl border border-panel-line bg-white p-4 space-y-3">
                  {estaEditando ? (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-panel-sub uppercase">
                          Pergunta do cliente:
                        </label>
                        <input
                          type="text"
                          value={edits[obs.id]?.question ?? obs.question}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [obs.id]: {
                                question: e.target.value,
                                answer: prev[obs.id]?.answer ?? obs.answer,
                              },
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-panel-sub uppercase">
                          Resposta para o atendente usar:
                        </label>
                        <textarea
                          rows={2}
                          value={edits[obs.id]?.answer ?? obs.answer}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [obs.id]: {
                                question: prev[obs.id]?.question ?? obs.question,
                                answer: e.target.value,
                              },
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === `obs-${obs.id}`}
                          onClick={() =>
                            call(
                              `/api/training/items/${obs.id}`,
                              "PATCH",
                              {
                                action: "aprovar",
                                question: edits[obs.id]?.question,
                                answer: edits[obs.id]?.answer,
                              },
                              `obs-${obs.id}`,
                              "Resposta corrigida e aprovada! O atendente já aprendeu.",
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Salvar e Usar Sempre
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[obs.id];
                              return next;
                            });
                          }}
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
                          <span className="font-semibold text-panel-ink">&ldquo;{obs.question}&rdquo;</span>
                        </p>
                        <p className="text-panel-sub">
                          Você respondeu:{" "}
                          <span className="font-bold text-emerald-800">&ldquo;{obs.answer}&rdquo;</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            call(
                              `/api/training/items/${obs.id}`,
                              "PATCH",
                              { action: "aprovar" },
                              `obs-app-${obs.id}`,
                              "Aprendido! O atendente já usa essa resposta no WhatsApp.",
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          ✓ Usar sempre
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            setEdits((prev) => ({
                              ...prev,
                              [obs.id]: { question: obs.question, answer: obs.answer },
                            }))
                          }
                          className="rounded-lg border border-panel-line bg-white px-3 py-1.5 text-xs font-semibold text-panel-ink hover:border-amber transition disabled:opacity-50"
                        >
                          ✏️ Corrigir
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            call(
                              `/api/training/items/${obs.id}`,
                              "PATCH",
                              { action: "rejeitar" },
                              `obs-rej-${obs.id}`,
                              "Descartado. Essa resposta não será usada como regra geral.",
                            )
                          }
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
        </Card>
      )}

      {/* Dúvidas para ensinar agora */}
      <Card
        title="Dúvidas que o atendente quer aprender"
        badge={
          topGaps.length > 0 ? (
            <span
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1 text-[11px] font-black text-night shadow-xs"
              title={`${topGaps.length} ${topGaps.length === 1 ? "dúvida pendente" : "dúvidas pendentes"}`}
            >
              {topGaps.length}
            </span>
          ) : undefined
        }
        hint={
          topGaps.length > 0
            ? "Perguntas de clientes em aberto. Escreva como você gostaria que ele respondesse."
            : undefined
        }
      >
        {topGaps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-panel-line bg-white/50 p-6 text-center">
            <p className="text-sm font-semibold text-emerald-800">✓ Nenhuma dúvida pendente no momento!</p>
            <p className="mt-1.5 text-xs text-panel-sub">
              Quando clientes fizerem perguntas novas no WhatsApp ou no simulador, elas aparecem aqui com aviso no menu.
            </p>
          </div>
        ) : (
          topGaps.map((gap) => (
            <div key={gap.id} className="rounded-xl border border-panel-line bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-panel-sub">Pergunta do cliente</p>
                  <p className="mt-0.5 text-base font-bold text-panel-ink">&ldquo;{gap.question}&rdquo;</p>
                </div>
                <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber-deep">
                  {gap.source === "INTERVIEW"
                    ? "Integração"
                    : gap.askCount === 1
                      ? "1 pergunta recebida"
                      : `${gap.askCount} perguntas recebidas`}
                </span>
              </div>

              <div>
                <label htmlFor={`gap-${gap.id}`} className="block text-xs font-semibold text-panel-sub mb-1">
                  Como o atendente deve responder:
                </label>
                <textarea
                  id={`gap-${gap.id}`}
                  className={inputClass}
                  rows={2}
                  placeholder="Escreva a resposta que o atendente deve dar aos clientes..."
                  value={answers[gap.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [gap.id]: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    call(
                      `/api/training/gaps/${gap.id}`,
                      "PATCH",
                      { action: "dispensar" },
                      `d-${gap.id}`,
                      "Dúvida dispensada.",
                    )
                  }
                  disabled={busy === `d-${gap.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-panel-sub transition hover:text-panel-ink hover:underline disabled:opacity-50"
                >
                  Não precisa responder
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ans = answers[gap.id] ?? "";
                    await call(
                      "/api/training/teach",
                      "POST",
                      { gapId: gap.id, question: gap.question, answer: ans },
                      gap.id,
                      "Ensinado com sucesso! O atendente já sabe responder isso no WhatsApp. 🙌",
                    );
                    setAnswers((prev) => {
                      const next = { ...prev };
                      delete next[gap.id];
                      return next;
                    });
                  }}
                  disabled={busy === gap.id || !(answers[gap.id] ?? "").trim()}
                  className="rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-xs transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy === gap.id ? "Ensinando..." : "Ensinar Atendente"}
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* O que o atendente já aprendeu */}
      {approvedItems.length > 0 && (
        <Card
          title="O que seu atendente já aprendeu"
          hint="Perguntas e respostas que seu atendente já usa no WhatsApp."
        >
          <div className="divide-y divide-panel-line rounded-xl border border-panel-line bg-white">
            {approvedItems.map((item) => (
              <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-panel-ink">&ldquo;{item.question}&rdquo;</p>
                  <p className="text-xs text-panel-sub leading-relaxed">{item.answer}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    call(
                      `/api/training/items/${item.id}`,
                      "DELETE",
                      null,
                      `del-${item.id}`,
                      "Conhecimento removido com sucesso.",
                    )
                  }
                  disabled={busy === `del-${item.id}`}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-panel-sub transition hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                  title="Esquecer esta resposta"
                >
                  {busy === `del-${item.id}` ? "Removendo..." : "Excluir"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Inconsistências observadas da equipe */}
      {inconsistencies.length > 0 && (
        <Card
          title="Respostas diferentes para a mesma pergunta"
          hint="Sua equipe respondeu esta dúvida de formas diferentes. Escolha qual delas está correta para o atendente aprender."
        >
          {inconsistencies.map((group) => (
            <div key={group.question} className="rounded-xl border border-panel-line bg-white p-4 space-y-3">
              <p className="text-sm font-bold text-panel-ink">&ldquo;{group.question}&rdquo;</p>
              <div className="space-y-2">
                {group.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-bg p-3"
                  >
                    <p className="text-xs text-panel-ink">{option.answer}</p>
                    <button
                      type="button"
                      onClick={() => resolveInconsistency(group, option.id)}
                      disabled={busy !== null}
                      className="shrink-0 rounded-lg border border-amber px-3 py-1.5 text-xs font-semibold text-amber-deep transition hover:bg-amber hover:text-night disabled:opacity-50"
                    >
                      Esta está correta
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Entrevista de integração inicial */}
      {interview && (
        <Card
          title="Entrevista de integração"
          hint={`Assuntos sugeridos para o seu ramo (${interview.segmentName}). Desmarque o que não se aplica ao seu negócio.`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {interview.topics.map((t) => (
              <label key={t.topic} className="flex items-start gap-2 text-sm text-panel-ink">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!excludedTopics.has(t.topic)}
                  onChange={(e) => {
                    const next = new Set(excludedTopics);
                    if (e.target.checked) next.delete(t.topic);
                    else next.add(t.topic);
                    setExcludedTopics(next);
                  }}
                />
                {t.topic}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={beginInterview}
            disabled={busy === "interview" || interview.topics.every((t) => excludedTopics.has(t.topic))}
            className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-night shadow-xs transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === "interview" ? "Preparando..." : "Começar a entrevista"}
          </button>
        </Card>
      )}


      {/* Diário */}
      <Card title="Diário do Atendente">
        <ul className="space-y-2 text-xs text-panel-sub leading-relaxed">
          {diary.map((line, index) => (
            <li key={index}>• {line}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
