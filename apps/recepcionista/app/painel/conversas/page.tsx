"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, STATUS_LABEL } from "@/components/status";

interface ConversationRow {
  id: string;
  customerName: string | null;
  customerPhone: string;
  status: string;
  updatedAt: string;
  lastMessage: { role: string; content: string } | null;
}

const FILTERS = ["", "AI", "WAITING_HUMAN", "HUMAN", "FINISHED"] as const;

function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function ConversasPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations${filter ? `?status=${filter}` : ""}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
      setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  const waiting = counts.WAITING_HUMAN ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Conversas</h1>
        {waiting > 0 && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            {waiting} conversa{waiting > 1 ? "s" : ""} aguardando sua equipe
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const count = value === "" ? total : (counts[value] ?? 0);
          const active = filter === value;
          return (
            <button
              key={value || "all"}
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                active
                  ? "border-leaf-dark bg-leaf-dark text-white"
                  : "border-panel-line bg-panel-card text-panel-sub hover:text-panel-ink"
              }`}
            >
              {value === "" ? "Todas" : STATUS_LABEL[value]} ({count})
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-panel-line bg-panel-card">
        {loading ? (
          <p className="p-8 text-center text-sm text-panel-sub">Carregando conversas...</p>
        ) : conversations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">Nenhuma conversa por aqui ainda.</p>
            <p className="mt-1 text-sm text-panel-sub">
              Conecte seu WhatsApp em{" "}
              <Link href="/painel/configuracoes" className="text-leaf-dark underline">
                Meu Atendente
              </Link>{" "}
              e as conversas aparecem aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-panel-line">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/painel/conversas/${conversation.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-panel-bg/60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-bg font-display text-sm font-semibold text-panel-sub">
                    {(conversation.customerName ?? conversation.customerPhone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {conversation.customerName ?? `+${conversation.customerPhone}`}
                      </p>
                      <span className="font-mono text-xs text-panel-sub">
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-panel-sub">
                      {conversation.lastMessage
                        ? `${
                            { AI: "Atendente: ", HUMAN: "Você: ", SYSTEM: "" }[
                              conversation.lastMessage.role
                            ] ?? ""
                          }${conversation.lastMessage.content}`
                        : "Sem mensagens"}
                    </p>
                  </div>
                  <StatusBadge status={conversation.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
