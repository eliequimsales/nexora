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
}

interface Inconsistency {
  question: string;
  options: { id: string; answer: string }[];
}

interface Report {
  stats: { totalConversations: number; resolvedByAttendant: number; sentToTeam: number };
  topGaps: Gap[];
  pendingItems: Item[];
  observations: Item[];
  inconsistencies: Inconsistency[];
  interview: { segmentName: string; topics: { topic: string; question: string }[] } | null;
  score: { overall: number; areas: { label: string; pct: number }[]; openGaps: number };
  diary: string[];
}

const inputClass =
  "w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
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
    setTimeout(() => setThanks(""), 6000);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/training");
    if (res.ok) setReport(await res.json());
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
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Algo deu errado. Tente novamente.");
        return;
      }
      if (thanksMessage) showThanks(thanksMessage);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!report) {
    return <p className="p-8 text-center text-sm text-panel-sub">Preparando a reunião de treinamento...</p>;
  }

  const { stats, topGaps, pendingItems, observations, inconsistencies, interview, score, diary } = report;

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
      <div>
        <h1 className="font-display text-2xl font-bold">Treinamento do Atendente</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Seu Atendente trabalha, anota o que não sabe e aprende só o que você aprovar — igual a um
          funcionário novo.
        </p>
      </div>

      {/* Apresentação do Atendente */}
      <div className="rounded-2xl border border-amber/20 bg-amber/5 p-6">
        <p className="text-sm leading-relaxed">
          Olá! Nesta semana participei de <strong>{stats.totalConversations}</strong> atendimento
          {stats.totalConversations === 1 ? "" : "s"} — resolvi{" "}
          <strong>{stats.resolvedByAttendant}</strong> e precisei da equipe em{" "}
          <strong>{stats.sentToTeam}</strong>.
          {topGaps.length > 0 && " Gostaria de aprender algumas informações novas. 👇"}
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {thanks && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {thanks}
        </p>
      )}

      {/* KUS: entrevista de integração (a empresa escolhe os assuntos) */}
      {interview && (
        <Card
          title="Entrevista de integração"
          hint={`Preparei um roteiro com base no funcionamento comum de: ${interview.segmentName}. Desmarque o que não faz sentido — nada disso vira resposta sem o seu treinamento e aprovação.`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {interview.topics.map((t) => (
              <label key={t.topic} className="flex items-start gap-2 text-sm">
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
            onClick={beginInterview}
            disabled={busy === "interview" || interview.topics.every((t) => excludedTopics.has(t.topic))}
            className="rounded-lg bg-amber px-5 py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === "interview" ? "Preparando..." : "Começar a entrevista"}
          </button>
        </Card>
      )}

      {/* Hoje gostaria de aprender */}
      <Card
        title="Hoje gostaria de aprender"
        hint={
          topGaps.length
            ? "As dúvidas de maior impacto, escolhidas pelo número de clientes que perguntaram."
            : undefined
        }
      >
        {topGaps.length === 0 ? (
          <p className="text-sm text-panel-sub">
            Nenhuma dúvida em aberto no momento. Quando clientes perguntarem algo que não sei, as
            perguntas aparecem aqui.
          </p>
        ) : (
          topGaps.map((gap) => (
            <div key={gap.id} className="rounded-xl border border-panel-line p-4">
              <p className="font-medium">&ldquo;{gap.question}&rdquo;</p>
              <p className="mt-1 text-xs text-panel-sub">
                {gap.source === "INTERVIEW"
                  ? "Pergunta de integração — me ajuda a conhecer a empresa"
                  : `Perguntado por ${gap.askCount} cliente${gap.askCount === 1 ? "" : "s"}`}
              </p>
              <textarea
                className={`${inputClass} mt-3`}
                rows={2}
                placeholder="Escreva a resposta como você explicaria para um funcionário novo..."
                value={answers[gap.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [gap.id]: e.target.value })}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() =>
                    call(
                      "/api/training/teach",
                      "POST",
                      { gapId: gap.id, question: gap.question, answer: answers[gap.id] ?? "" },
                      gap.id,
                      "Anotei! Organizei sua resposta logo abaixo — revise e aprove para eu começar a usar.",
                    )
                  }
                  disabled={busy === gap.id || !(answers[gap.id] ?? "").trim()}
                  className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
                >
                  Ensinar
                </button>
                <button
                  onClick={() => call(`/api/training/gaps/${gap.id}`, "PATCH", { action: "dispensar" }, `d-${gap.id}`)}
                  disabled={busy === `d-${gap.id}`}
                  className="rounded-lg border border-panel-line px-4 py-2 text-sm text-panel-sub transition hover:text-panel-ink"
                >
                  Não é relevante
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Inconsistências: mesma pergunta, respostas diferentes da equipe */}
      {inconsistencies.length > 0 && (
        <Card
          title="Percebi respostas diferentes para a mesma pergunta"
          hint="Sua equipe respondeu esta dúvida de formas diferentes. Qual delas está correta? A escolhida vira conhecimento; as outras são descartadas."
        >
          {inconsistencies.map((group) => (
            <div key={group.question} className="rounded-xl border border-panel-line p-4">
              <p className="font-medium">&ldquo;{group.question}&rdquo;</p>
              <div className="mt-3 space-y-2">
                {group.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-bg p-3"
                  >
                    <p className="text-sm">{option.answer}</p>
                    <button
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

      {/* Aguardando aprovação */}
      {(pendingItems.length > 0 || observations.length > 0) && (
        <Card
          title="Aguardando sua aprovação"
          hint="Nada entra no conhecimento do Atendente sem a sua confirmação. Revise, edite se precisar e aprove."
        >
          {[...pendingItems, ...observations].map((item) => {
            const edit = edits[item.id] ?? { question: item.question, answer: item.answer };
            const isObservation = item.source === "TEAM_OBSERVATION";
            return (
              <div key={item.id} className="rounded-xl border border-amber-300 bg-amber-50/50 p-4">
                {isObservation && (
                  <p className="mb-2 text-xs font-medium text-amber-700">
                    Observei sua equipe respondendo isto a um cliente — quer que eu aprenda?
                  </p>
                )}
                <input
                  className={inputClass}
                  value={edit.question}
                  onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, question: e.target.value } })}
                />
                <textarea
                  className={`${inputClass} mt-2`}
                  rows={2}
                  value={edit.answer}
                  onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, answer: e.target.value } })}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      call(
                        `/api/training/items/${item.id}`,
                        "PATCH",
                        { action: "aprovar", ...edit },
                        item.id,
                        "Obrigado! Agora consigo responder essa pergunta corretamente. 🙌",
                      )
                    }
                    disabled={busy === item.id}
                    className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
                  >
                    Aprovar — pode usar
                  </button>
                  <button
                    onClick={() =>
                      call(`/api/training/items/${item.id}`, "PATCH", { action: "rejeitar" }, `r-${item.id}`)
                    }
                    disabled={busy === `r-${item.id}`}
                    className="rounded-lg border border-panel-line px-4 py-2 text-sm text-panel-sub transition hover:text-panel-ink"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Conhecimento do Atendente */}
      <Card title="Conhecimento do Atendente" hint="Onde vale a pena investir alguns minutos de treinamento.">
        <div className="flex items-center gap-3">
          <span className="font-mono text-4xl font-medium text-amber-deep">{score.overall}%</span>
          {score.openGaps > 0 && (
            <span className="text-sm text-panel-sub">
              {score.openGaps} dúvida{score.openGaps === 1 ? "" : "s"} em aberto
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {score.areas.map((area) => (
            <div key={area.label} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-sm text-panel-sub">{area.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-bg">
                <div className="h-full rounded-full bg-amber/80" style={{ width: `${area.pct}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-xs text-panel-sub">{area.pct}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Diário */}
      <Card title="Diário do Atendente">
        <ul className="space-y-2 text-sm leading-relaxed">
          {diary.map((line, index) => (
            <li key={index}>• {line}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
