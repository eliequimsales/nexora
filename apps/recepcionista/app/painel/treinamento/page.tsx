"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type TabSecao = "todas" | "duvidas" | "aprendidas" | "diario" | "observadas" | "inconsistencias";

function IconeTreinamento({
  nome,
  className = "h-4 w-4",
}: {
  nome:
    | "conversa"
    | "enviar"
    | "check"
    | "fechar"
    | "livro"
    | "teste"
    | "seta"
    | "raio"
    | "alerta"
    | "lixeira"
    | "editar"
    | "busca"
    | "usuario"
    | "relogio";
  className?: string;
}) {
  const icones: Record<typeof nome, React.ReactNode> = {
    conversa: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    enviar: (
      <>
        <path d="m22 2-7 20-4-9-9-4L22 2Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    fechar: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    livro: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z" />
        <path d="M8 7h8M8 11h6" />
      </>
    ),
    teste: (
      <>
        <path d="m9 5 10 7-10 7V5Z" />
        <path d="M4 5v14" />
      </>
    ),
    seta: <path d="M5 12h14m-5-5 5 5-5 5" />,
    raio: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    alerta: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    lixeira: (
      <>
        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    ),
    editar: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    busca: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    usuario: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    relogio: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icones[nome]}
    </svg>
  );
}

function CardPainel({
  titulo,
  hint,
  badge,
  icone,
  children,
  id,
}: {
  titulo: string;
  hint?: string;
  badge?: React.ReactNode;
  icone?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-3xl border border-panel-line bg-panel-card shadow-[0_12px_44px_-24px_rgba(17,27,33,0.28)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line bg-white/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          {icone && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/15 text-panel-ink shadow-2xs">
              {icone}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-base sm:text-lg font-bold text-panel-ink">{titulo}</h2>
              {badge}
            </div>
            {hint && <p className="mt-0.5 text-xs text-panel-sub">{hint}</p>}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">{children}</div>
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
  const [filtroBusca, setFiltroBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<TabSecao>("todas");

  function showThanks(message: string) {
    setThanks(message);
    setTimeout(() => setThanks(""), 6000);
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/training");
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setError("");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("duvidas-atualizadas"));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível carregar as informações do treinamento.");
      }
    } catch {
      setError("Erro de conexão ao carregar o treinamento. Verifique sua conexão e tente novamente.");
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
    if (error) {
      return (
        <div className="mx-auto max-w-5xl py-8 space-y-4">
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-8 sm:p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <IconeTreinamento nome="alerta" className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-bold text-red-900">Não foi possível carregar o treinamento</p>
            <p className="mt-1 text-xs sm:text-sm text-red-700 max-w-md mx-auto">{error}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-amber px-5 py-2.5 text-xs font-bold text-night shadow-xs hover:bg-amber-deep transition cursor-pointer"
              >
                <IconeTreinamento nome="raio" className="h-4 w-4" />
                <span>Tentar novamente</span>
              </button>
              <Link
                href="/painel/atendente"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-panel-line bg-white px-4 py-2.5 text-xs font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
              >
                <IconeTreinamento nome="conversa" className="h-4 w-4 text-emerald-600" />
                <span>Configurar Atendente</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl py-8">
        <div className="rounded-3xl border border-panel-line bg-panel-card p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/20 text-night animate-pulse">
            <IconeTreinamento nome="raio" className="h-7 w-7" />
          </div>
          <p className="mt-4 text-base font-semibold text-panel-ink">Abrindo a Central de Ensino do Nex...</p>
          <p className="mt-1 text-xs text-panel-sub">Carregando dúvidas, aprendizados e métricas do WhatsApp.</p>
        </div>
      </div>
    );
  }

  const topGaps = Array.isArray(report?.topGaps) ? report.topGaps : [];
  const approvedItems = Array.isArray(report?.approvedItems) ? report.approvedItems : [];
  const observations = Array.isArray(report?.observations) ? report.observations : [];
  const inconsistencies = Array.isArray(report?.inconsistencies) ? report.inconsistencies : [];
  const diary = Array.isArray(report?.diary) ? report.diary : [];
  const interview =
    report?.interview && Array.isArray(report.interview.topics) && report.interview.topics.length > 0
      ? report.interview
      : null;
  const stats = {
    totalConversations: Number(report?.stats?.totalConversations) || 0,
    resolvedByAttendant: Number(report?.stats?.resolvedByAttendant) || 0,
    sentToTeam: Number(report?.stats?.sentToTeam) || 0,
  };

  const itensAprovadosFiltrados = useMemo(() => {
    if (!filtroBusca.trim()) return approvedItems;
    const termo = filtroBusca.toLowerCase().trim();
    return approvedItems.filter(
      (item) =>
        (item?.question && String(item.question).toLowerCase().includes(termo)) ||
        (item?.answer && String(item.answer).toLowerCase().includes(termo)),
    );
  }, [approvedItems, filtroBusca]);

  async function beginInterview() {
    if (!interview || !Array.isArray(interview.topics)) return;
    const topics = interview.topics
      .filter((t) => t && t.topic)
      .map((t) => t.topic)
      .filter((t) => !excludedTopics.has(t));
    if (topics.length === 0) return;
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
      showThanks("Resposta corrigida no repertório oficial! O atendente já atualizou.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const taxaResolucao =
    stats.totalConversations > 0
      ? Math.min(100, Math.max(0, Math.round((stats.resolvedByAttendant / stats.totalConversations) * 100)))
      : 100;

  return (
    <div className="mx-auto max-w-5xl pb-12 space-y-6">
      {/* Cabeçalho da Página */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold tracking-tight text-panel-ink sm:text-3xl flex items-center gap-2">
              Nex • Ensinar Atendente
            </h1>
            {topGaps.length > 0 && (
              <span
                className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber px-2 text-xs font-black text-night shadow-xs animate-pulse"
                title={`${topGaps.length} ${topGaps.length === 1 ? "dúvida pendente" : "dúvidas pendentes"}`}
              >
                {topGaps.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-panel-sub">
            Perguntas feitas no WhatsApp e no simulador que ele ainda não sabia responder.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/painel/atendente"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-panel-line bg-white px-4 py-2.5 text-xs font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
          >
            <IconeTreinamento nome="conversa" className="h-4 w-4 text-emerald-600" />
            <span>Configurar Atendente</span>
            <IconeTreinamento nome="seta" className="h-3.5 w-3.5 text-panel-sub" />
          </Link>
          {topGaps.length > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber/40 bg-amber/15 px-3.5 py-2 text-xs font-bold text-amber-deep shadow-2xs">
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1 text-[11px] font-black text-night shadow-xs">
                {topGaps.length}
              </span>
              <span>{topGaps.length === 1 ? "1 dúvida pendente" : `${topGaps.length} dúvidas pendentes`}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs">
              <IconeTreinamento nome="check" className="h-4 w-4 text-emerald-600" />
              <span>Conhecimento em dia</span>
            </span>
          )}
        </div>
      </header>

      {/* Apresentação Visual Marcante do Nex (Idêntica à interface do atendente) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 rounded-3xl border border-amber/30 bg-gradient-to-r from-amber/15 via-white to-emerald-500/10 p-5 sm:p-6 shadow-xs">
        <div className="relative shrink-0">
          <img
            src="/nex/nex-avatar.png"
            alt="Nex - Atendente Oficial"
            className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover shrink-0 drop-shadow-md border-2 border-emerald-500/30 shadow-md ring-2 ring-emerald-500/15 bg-white"
          />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        </div>
        <div className="min-w-0 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Nex ⚡ Central de Aprendizado
            </div>
            {topGaps.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-deep">
                {topGaps.length === 1 ? "1 dúvida para ensinar" : `${topGaps.length} dúvidas para ensinar`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                ✓ Pronto para responder
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-base sm:text-lg font-bold text-panel-ink">
            Olá! Estou sempre aprendendo com você.
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-panel-sub leading-relaxed max-w-3xl">
            Quando clientes fazem perguntas no WhatsApp que eu ainda não sabia responder com certeza, elas aparecem aqui para você me ensinar. Seus ensinamentos são aplicados imediatamente ao meu repertório oficial!
          </p>
        </div>
      </div>

      {/* Cartões de Métricas Executivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Métrica 1: Dúvidas Pendentes */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition ${
            topGaps.length > 0
              ? "border-amber/50 bg-amber/10"
              : "border-panel-line bg-panel-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-panel-sub">Dúvidas para Ensinar</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                topGaps.length > 0 ? "bg-amber text-night" : "bg-panel-bg text-panel-sub"
              }`}
            >
              <IconeTreinamento nome="raio" className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-panel-ink">{topGaps.length}</p>
          <p className="mt-1 text-[11px] font-medium text-panel-sub">
            {topGaps.length === 0 ? "Tudo em dia" : "Aguardando seu ensinamento"}
          </p>
        </div>

        {/* Métrica 2: Conhecimentos Ativos */}
        <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-panel-sub">Respostas Aprendidas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800">
              <IconeTreinamento nome="livro" className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-panel-ink">{approvedItems.length}</p>
          <p className="mt-1 text-[11px] font-medium text-panel-sub">Ativas no atendimento WhatsApp</p>
        </div>

        {/* Métrica 3: Atendimentos na Semana */}
        <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-panel-sub">Conversas na Semana</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-800">
              <IconeTreinamento nome="conversa" className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-panel-ink">{stats.totalConversations}</p>
          <p className="mt-1 text-[11px] font-medium text-panel-sub">Iniciadas com clientes</p>
        </div>

        {/* Métrica 4: Resolvidas pelo Atendente */}
        <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-panel-sub">Resolvidas pelo Nex</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber/20 text-amber-deep">
              <IconeTreinamento nome="check" className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-panel-ink">{stats.resolvedByAttendant}</p>
          <p className="mt-1 text-[11px] font-medium text-panel-sub">
            {taxaResolucao}% resolvidas sem intervenção
          </p>
        </div>
      </div>

      {/* Avisos de Notificação */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-xs"
        >
          <IconeTreinamento nome="alerta" className="h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 font-medium">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-xs font-bold text-red-700 underline"
          >
            Fechar
          </button>
        </div>
      )}

      {thanks && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <IconeTreinamento nome="check" className="h-4 w-4" />
            </div>
            <p className="font-semibold">{thanks}</p>
          </div>
          <Link
            href="/painel/atendente"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-2xs hover:bg-emerald-100 transition"
          >
            <span>Ver no Atendente Virtual</span>
            <IconeTreinamento nome="seta" className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Barra de Navegação Rápida das Seções (Idêntica aos tópicos do atendente) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:gap-2.5">
        <button
          type="button"
          onClick={() => setAbaAtiva("todas")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
            abaAtiva === "todas"
              ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
              : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <span>Visão Geral Completa</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("duvidas")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
            abaAtiva === "duvidas"
              ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
              : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <IconeTreinamento nome="raio" className="h-3.5 w-3.5" />
          <span>Dúvidas para Ensinar</span>
          {topGaps.length > 0 && (
            <span className="flex h-4 min-w-[18px] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-black text-night">
              {topGaps.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("aprendidas")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
            abaAtiva === "aprendidas"
              ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
              : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <IconeTreinamento nome="livro" className="h-3.5 w-3.5" />
          <span>O que já aprendeu</span>
          <span className="flex h-4 min-w-[18px] items-center justify-center rounded-full bg-panel-line px-1 text-[10px] font-bold text-panel-sub">
            {approvedItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("diario")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
            abaAtiva === "diario"
              ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
              : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <IconeTreinamento nome="relogio" className="h-3.5 w-3.5" />
          <span>Diário do Atendente</span>
        </button>

        {observations.length > 0 && (
          <button
            type="button"
            onClick={() => setAbaAtiva("observadas")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
              abaAtiva === "observadas"
                ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
                : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
            }`}
          >
            <IconeTreinamento nome="conversa" className="h-3.5 w-3.5 text-emerald-600" />
            <span>Respostas da Equipe</span>
            <span className="flex h-4 min-w-[18px] items-center justify-center rounded-full bg-emerald-100 px-1 text-[10px] font-bold text-emerald-800">
              {observations.length}
            </span>
          </button>
        )}

        {inconsistencies.length > 0 && (
          <button
            type="button"
            onClick={() => setAbaAtiva("inconsistencias")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium transition ${
              abaAtiva === "inconsistencias"
                ? "border-amber bg-amber/20 text-panel-ink font-bold shadow-2xs"
                : "border-panel-line bg-white text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
            }`}
          >
            <IconeTreinamento nome="alerta" className="h-3.5 w-3.5 text-amber-deep" />
            <span>Respostas Divergentes</span>
            <span className="flex h-4 min-w-[18px] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-black text-night">
              {inconsistencies.length}
            </span>
          </button>
        )}
      </div>

      {/* SEÇÃO 1: Respostas observadas no WhatsApp pela equipe */}
      {(abaAtiva === "todas" || abaAtiva === "observadas") && observations.length > 0 && (
        <CardPainel
          id="secao-observadas"
          titulo="Respostas capturadas do seu WhatsApp"
          icone={<IconeTreinamento nome="conversa" className="h-5 w-5 text-emerald-700" />}
          badge={
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-black text-emerald-800 shadow-xs">
              {observations.length}
            </span>
          }
          hint="Respostas dadas pela equipe viram sugestões. Confira as condições, aprove para incluir no rascunho ou descarte se foi uma exceção."
        >
          <div className="space-y-4">
            {observations.map((obs) => {
              const estaEditando = edits[obs.id] !== undefined;
              return (
                <div
                  key={obs.id}
                  className="rounded-2xl border border-panel-line bg-white p-5 shadow-2xs space-y-4 transition hover:border-panel-ink/20"
                >
                  {estaEditando ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-panel-sub uppercase tracking-wider mb-1">
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
                          className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-panel-sub uppercase tracking-wider mb-1">
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
                          className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
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
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-50"
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
                          className="rounded-xl border border-panel-line bg-white px-3.5 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-line text-[10px] font-bold text-panel-sub mt-0.5">
                            Q
                          </span>
                          <p className="text-sm text-panel-ink font-semibold leading-relaxed">
                            Cliente perguntou: &ldquo;{obs.question}&rdquo;
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5 pl-0.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-800 mt-0.5">
                            A
                          </span>
                          <p className="text-sm text-emerald-900 font-medium leading-relaxed bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 flex-1">
                            Você respondeu: &ldquo;{obs.answer}&rdquo;
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-panel-line">
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
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <IconeTreinamento nome="check" className="h-3.5 w-3.5" />
                          <span>Usar sempre</span>
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
                          className="rounded-xl border border-panel-line bg-white px-3.5 py-2 text-xs font-semibold text-panel-ink hover:border-amber transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <IconeTreinamento nome="editar" className="h-3.5 w-3.5 text-panel-sub" />
                          <span>Corrigir texto</span>
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
                          className="rounded-xl px-3 py-2 text-xs font-medium text-panel-sub hover:text-red-700 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          ✕ Valeu só para este caso
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardPainel>
      )}

      {/* SEÇÃO 2: Dúvidas que o atendente quer aprender (Principal) */}
      {(abaAtiva === "todas" || abaAtiva === "duvidas") && (
        <CardPainel
          id="secao-duvidas"
          titulo="Dúvidas que o atendente quer aprender"
          icone={<IconeTreinamento nome="raio" className="h-5 w-5 text-amber-deep" />}
          badge={
            topGaps.length > 0 ? (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1.5 text-[11px] font-black text-night shadow-xs"
                title={`${topGaps.length} ${topGaps.length === 1 ? "dúvida pendente" : "dúvidas pendentes"}`}
              >
                {topGaps.length}
              </span>
            ) : undefined
          }
          hint={
            topGaps.length > 0
              ? "Perguntas de clientes em aberto. Escreva como você gostaria que ele respondesse no WhatsApp."
              : undefined
          }
        >
          {topGaps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-50/40 p-8 sm:p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-800 shadow-sm">
                <IconeTreinamento nome="check" className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="mt-4 text-base font-bold text-emerald-900">
                ✓ Nenhuma dúvida pendente no momento!
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm text-panel-sub leading-relaxed">
                O Nex está respondendo os clientes com segurança no WhatsApp. Quando alguém fizer uma pergunta nova que ele ainda não saiba responder, ela aparecerá aqui para você ensinar.
              </p>
              <div className="mt-5">
                <Link
                  href="/painel/atendente"
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-panel-line px-4 py-2.5 text-xs font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
                >
                  <IconeTreinamento nome="teste" className="h-4 w-4 text-amber-deep" />
                  <span>Testar no Atendente Virtual</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {topGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="rounded-2xl border border-panel-line bg-white p-5 sm:p-6 shadow-2xs space-y-4 transition hover:border-amber/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/20 text-night shadow-2xs mt-0.5">
                        <IconeTreinamento nome="conversa" className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-panel-sub">
                            Pergunta do cliente no WhatsApp
                          </span>
                        </div>
                        <p className="mt-1 text-base sm:text-lg font-bold text-panel-ink">
                          &ldquo;{gap.question}&rdquo;
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber/15 px-3 py-1 text-xs font-bold text-amber-deep">
                      {gap.source === "INTERVIEW"
                        ? "Entrevista Inicial"
                        : gap.askCount === 1
                        ? "1 pergunta recebida"
                        : `${gap.askCount} perguntas recebidas`}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor={`gap-${gap.id}`}
                      className="block text-xs font-bold text-panel-ink mb-1.5"
                    >
                      Como o Nex deve responder aos seus clientes:
                    </label>
                    <textarea
                      id={`gap-${gap.id}`}
                      rows={3}
                      placeholder="Escreva como você gostaria que ele respondesse. Pode ser simples e direto, do seu jeito!"
                      value={answers[gap.id] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [gap.id]: e.target.value })}
                      className="w-full rounded-xl border border-panel-line bg-[#FAFBFB] p-3.5 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber focus:bg-white shadow-2xs transition placeholder:text-panel-sub/60 leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-panel-line">
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
                      className="rounded-xl px-3.5 py-2 text-xs font-semibold text-panel-sub transition hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Não precisa responder isso
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
                      className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-xs sm:text-sm font-bold text-night shadow-xs transition hover:brightness-110 active:scale-98 disabled:opacity-50"
                    >
                      <IconeTreinamento nome="raio" className="h-4 w-4" />
                      <span>{busy === gap.id ? "Ensinando..." : "Ensinar Atendente"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardPainel>
      )}

      {/* SEÇÃO 3: O que o atendente já aprendeu */}
      {(abaAtiva === "todas" || abaAtiva === "aprendidas") && approvedItems.length > 0 && (
        <CardPainel
          id="secao-aprendidas"
          titulo="O que seu atendente já aprendeu"
          icone={<IconeTreinamento nome="livro" className="h-5 w-5 text-emerald-700" />}
          badge={
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-bold text-emerald-800">
              {approvedItems.length}
            </span>
          }
          hint="Perguntas e respostas cadastradas que o Nex já usa ativamente no WhatsApp."
        >
          {approvedItems.length > 4 && (
            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-3 flex items-center text-panel-sub">
                <IconeTreinamento nome="busca" className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por pergunta ou resposta aprendida..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="w-full rounded-xl border border-panel-line bg-white pl-9 pr-4 py-2 text-xs text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs"
              />
            </div>
          )}

          <div className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-white overflow-hidden shadow-2xs">
            {itensAprovadosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-panel-sub">
                Nenhum conhecimento encontrado para o termo &ldquo;{filtroBusca}&rdquo;.
              </div>
            ) : (
              itensAprovadosFiltrados.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition hover:bg-panel-bg/40"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <IconeTreinamento nome="check" className="h-3 w-3" />
                        Ativo
                      </span>
                      <p className="text-sm font-bold text-panel-ink">&ldquo;{item.question}&rdquo;</p>
                    </div>
                    <p className="text-xs sm:text-sm text-panel-sub leading-relaxed pl-6">
                      {item.answer}
                    </p>
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
                    className="shrink-0 self-end sm:self-start rounded-xl border border-panel-line bg-white px-3 py-1.5 text-xs font-medium text-panel-sub transition hover:text-red-700 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 flex items-center gap-1.5"
                    title="Esquecer esta resposta"
                  >
                    <IconeTreinamento nome="lixeira" className="h-3.5 w-3.5" />
                    <span>{busy === `del-${item.id}` ? "Removendo..." : "Excluir"}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </CardPainel>
      )}

      {/* SEÇÃO 4: Inconsistências observadas da equipe */}
      {(abaAtiva === "todas" || abaAtiva === "inconsistencias") && inconsistencies.length > 0 && (
        <CardPainel
          id="secao-inconsistencias"
          titulo="Respostas diferentes para a mesma pergunta"
          icone={<IconeTreinamento nome="alerta" className="h-5 w-5 text-amber-deep" />}
          badge={
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1.5 text-[11px] font-black text-night">
              {inconsistencies.length}
            </span>
          }
          hint="Sua equipe respondeu esta dúvida de formas diferentes no WhatsApp. Escolha qual delas está correta para o atendente aprender."
        >
          <div className="space-y-4">
            {inconsistencies.map((group) => (
              <div
                key={group.question}
                className="rounded-2xl border border-panel-line bg-white p-5 shadow-2xs space-y-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-panel-sub uppercase">Dúvida dos clientes:</span>
                  <p className="text-sm font-bold text-panel-ink">&ldquo;{group.question}&rdquo;</p>
                </div>
                <div className="space-y-2.5">
                  {group.options.map((option) => (
                    <div
                      key={option.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-panel-line bg-[#FAFBFB] p-3.5 transition hover:border-amber/40"
                    >
                      <p className="text-xs sm:text-sm text-panel-ink leading-relaxed">
                        &ldquo;{option.answer}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => resolveInconsistency(group, option.id)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-xl bg-white border border-amber px-3.5 py-1.5 text-xs font-bold text-amber-deep transition hover:bg-amber hover:text-night shadow-2xs disabled:opacity-50"
                      >
                        Esta é a oficial
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardPainel>
      )}

      {/* SEÇÃO 5: Entrevista de integração inicial */}
      {interview && Array.isArray(interview.topics) && interview.topics.length > 0 && (
        <CardPainel
          id="secao-entrevista"
          titulo="Entrevista de integração inicial"
          icone={<IconeTreinamento nome="usuario" className="h-5 w-5 text-panel-ink" />}
          hint={`Assuntos sugeridos para o seu ramo (${interview.segmentName}). Desmarque o que não se aplica ao seu negócio.`}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {interview.topics.map((t) => (
              <label
                key={t.topic}
                className="flex items-center gap-3 rounded-xl border border-panel-line bg-white p-3 text-xs sm:text-sm text-panel-ink cursor-pointer hover:bg-panel-bg/40 transition"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-panel-line text-amber focus:ring-amber"
                  checked={!excludedTopics.has(t.topic)}
                  onChange={(e) => {
                    const next = new Set(excludedTopics);
                    if (e.target.checked) next.delete(t.topic);
                    else next.add(t.topic);
                    setExcludedTopics(next);
                  }}
                />
                <span className="font-medium">{t.topic}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={beginInterview}
            disabled={busy === "interview" || interview.topics.every((t) => excludedTopics.has(t.topic))}
            className="rounded-xl bg-amber px-5 py-2.5 text-xs sm:text-sm font-bold text-night shadow-xs transition hover:brightness-110 disabled:opacity-50 mt-2"
          >
            {busy === "interview" ? "Preparando..." : "Começar a entrevista"}
          </button>
        </CardPainel>
      )}

      {/* SEÇÃO 6: Diário do Atendente (Elegante e Estruturado) */}
      {(abaAtiva === "todas" || abaAtiva === "diario") && (
        <CardPainel
          id="secao-diario"
          titulo="Diário do Atendente"
          icone={<IconeTreinamento nome="relogio" className="h-5 w-5 text-panel-ink" />}
          hint="Histórico semanal das atividades, aprendizados e performance do Nex no WhatsApp."
        >
          <div className="space-y-3">
            {diary.map((line, index) => {
              const safeLine = typeof line === "string" ? line : String(line ?? "");
              const isResumoAtendimentos = safeLine.includes("atendimentos");
              const isAprendizado = safeLine.includes("Aprendi") || safeLine.includes("treinamento novo");
              const isDuvidas = safeLine.includes("preciso aprender") || safeLine.includes("dúvidas em aberto");

              return (
                <div
                  key={index}
                  className="flex items-start gap-3.5 rounded-2xl border border-panel-line bg-white p-4 shadow-2xs"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs ${
                      isResumoAtendimentos
                        ? "bg-blue-500/15 text-blue-800"
                        : isAprendizado
                        ? "bg-emerald-500/15 text-emerald-800"
                        : isDuvidas
                        ? "bg-amber/20 text-amber-deep"
                        : "bg-panel-bg text-panel-ink"
                    }`}
                  >
                    {isResumoAtendimentos ? (
                      <IconeTreinamento nome="conversa" className="h-4 w-4" />
                    ) : isAprendizado ? (
                      <IconeTreinamento nome="livro" className="h-4 w-4" />
                    ) : (
                      <IconeTreinamento nome="raio" className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm leading-relaxed text-panel-ink font-medium">
                      {safeLine}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardPainel>
      )}
    </div>
  );
}
