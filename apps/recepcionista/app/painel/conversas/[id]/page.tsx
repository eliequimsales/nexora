"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/status";

interface MessageRow {
  id: string;
  role: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  customerName: string | null;
  customerPhone: string;
  status: string;
  messages: MessageRow[];
  lead: { name: string; interest: string | null } | null;
}

const ROLE_LABEL: Record<string, string> = { AI: "Atendente", HUMAN: "Você (Equipe)", CUSTOMER: "Cliente" };

function MessageBubble({ message }: { message: MessageRow }) {
  if (message.role === "SYSTEM") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-panel-bg/90 border border-panel-line px-3 py-1 font-mono text-[11px] text-panel-sub">
          {message.content}
        </span>
      </div>
    );
  }

  const fromCustomer = message.role === "CUSTOMER";
  return (
    <div className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-xs ${
          fromCustomer
            ? "rounded-tl-xs bg-white text-[#111b21] border border-gray-100"
            : "rounded-tr-xs bg-[#d9fdd3] text-[#111b21] border border-[#c4e9be]/60"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
          <span>{ROLE_LABEL[message.role]}</span>
          <span>·</span>
          <span>
            {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!fromCustomer && (
            <span className="text-[#53bdeb] font-bold text-[11px] tracking-tighter" title="Entregue">
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversaPage() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);
  const notFoundRef = useRef(false);

  const load = useCallback(async () => {
    if (notFoundRef.current) return;
    const res = await fetch(`/api/conversations/${id}`);
    if (res.status === 404) {
      notFoundRef.current = true;
      setNotFound(true);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setConversation(data.conversation);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const count = conversation?.messages.length ?? 0;
    if (count > messageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    messageCountRef.current = count;
  }, [conversation?.messages.length]);

  async function runAction(action: "assumir" | "reativar_ia" | "finalizar") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao executar ação");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar");
        return;
      }
      setReply("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Conversa não encontrada.</p>
        <Link href="/painel/conversas" className="mt-2 inline-block text-sm text-amber-deep underline">
          Voltar para as conversas
        </Link>
      </div>
    );
  }

  if (!conversation) {
    return <p className="p-8 text-center text-sm text-panel-sub">Carregando conversa...</p>;
  }

  const canAssume = conversation.status === "AI" || conversation.status === "WAITING_HUMAN";
  const isHuman = conversation.status === "HUMAN";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/painel/conversas" className="text-sm text-panel-sub hover:text-panel-ink">
            ← Conversas
          </Link>
          <h1 className="font-display text-xl font-bold">
            {conversation.customerName ?? `+${conversation.customerPhone}`}
          </h1>
          <StatusBadge status={conversation.status} />
        </div>
        <div className="flex gap-2">
          {canAssume && (
            <button
              onClick={() => runAction("assumir")}
              disabled={busy}
              className="rounded-lg bg-panel-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              Assumir conversa
            </button>
          )}
          {isHuman && (
            <button
              onClick={() => runAction("reativar_ia")}
              disabled={busy}
              className="rounded-lg border border-amber px-4 py-2 text-sm font-semibold text-amber-deep transition hover:bg-amber/5 disabled:opacity-60"
            >
              Devolver para o Atendente
            </button>
          )}
          {conversation.status !== "FINISHED" && (
            <button
              onClick={() => runAction("finalizar")}
              disabled={busy}
              className="rounded-lg border border-panel-line px-4 py-2 text-sm text-panel-sub transition hover:text-panel-ink disabled:opacity-60"
            >
              Finalizar
            </button>
          )}
        </div>
      </div>

      {conversation.lead && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Lead:</strong> {conversation.lead.name} · +{conversation.customerPhone}
          {conversation.lead.interest && <> · interesse: {conversation.lead.interest}</>}
        </div>
      )}

      <div className="rounded-2xl border border-panel-line bg-panel-card shadow-xs overflow-hidden">
        <div className="flex max-h-[60vh] min-h-[360px] flex-col gap-3 overflow-y-auto p-5 bg-[#EFEAE2]/35">
          {conversation.messages.length === 0 ? (
            <p className="m-auto text-sm text-panel-sub">Sem mensagens nesta conversa.</p>
          ) : (
            conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-panel-line bg-panel-card p-3 sm:p-4">
          {isHuman ? (
            <form onSubmit={sendReply} className="flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 rounded-full border border-panel-line bg-panel-bg/60 px-4 py-2.5 text-sm outline-none focus:border-[#00A884] focus:ring-1 focus:ring-[#00A884]/30"
              />
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                className="rounded-full bg-[#00A884] hover:bg-[#00A884]/90 px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 shadow-xs"
              >
                Enviar
              </button>
            </form>
          ) : (
            <p className="text-center text-sm text-panel-sub">
              {conversation.status === "AI" && "Seu Atendente está cuidando desta conversa. Assuma para responder manualmente."}
              {conversation.status === "WAITING_HUMAN" && "Cliente aguardando sua equipe — assuma a conversa para responder."}
              {conversation.status === "FINISHED" && "Conversa finalizada. Se o cliente escrever de novo, o Atendente reabre o atendimento."}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
