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

const ROLE_LABEL: Record<string, string> = { AI: "Atendente Virtual", HUMAN: "Você (Equipe)", CUSTOMER: "Cliente" };

function MessageBubble({ message }: { message: MessageRow }) {
  if (message.role === "SYSTEM") {
    return (
      <div className="my-2.5 text-center">
        <span className="rounded-lg bg-[#FFEECD]/90 border border-[#F5C358]/30 px-3 py-1 text-xs text-[#54656F] shadow-2xs">
          🔒 {message.content}
        </span>
      </div>
    );
  }

  const fromCustomer = message.role === "CUSTOMER";
  return (
    <div className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 text-[14.2px] leading-relaxed shadow-[0_1px_0.5px_rgba(11,20,26,.13)] ${
          fromCustomer
            ? "rounded-2xl rounded-tl-none bg-white text-[#111B21]"
            : "rounded-2xl rounded-tr-none bg-[#D9FDD3] text-[#111B21]"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-[#667781]">
          <span>{ROLE_LABEL[message.role]}</span>
          <span>·</span>
          <span>
            {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!fromCustomer && (
            <span className="text-[#53BDEB] font-bold text-[11px] tracking-tighter" title="Lido">
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
        <p className="font-medium text-[#111B21]">Conversa não encontrada.</p>
        <Link href="/painel/conversas" className="mt-2 inline-block text-sm text-[#00A884] font-semibold underline">
          Voltar para as conversas
        </Link>
      </div>
    );
  }

  if (!conversation) {
    return <p className="p-12 text-center text-sm text-[#667781]">Carregando conversa do WhatsApp...</p>;
  }

  const canAssume = conversation.status === "AI" || conversation.status === "WAITING_HUMAN";
  const isHuman = conversation.status === "HUMAN";
  const nomeCliente = conversation.customerName ?? `+${conversation.customerPhone}`;
  const iniciais = (conversation.customerName ?? conversation.customerPhone).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl pb-10">
      {/* CABEÇALHO DO CHAT IDÊNTICO AO WHATSAPP */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E9EDEF] bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-[#E9EDEF] bg-[#F0F2F5] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link
              href="/painel/conversas"
              aria-label="Voltar"
              className="rounded-full p-1.5 text-[#54656F] transition hover:bg-[#E9EDEF] hover:text-[#111B21]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Avatar circular */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DFE5E7] font-bold text-[#54656F] text-sm">
              {iniciais}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-[#111B21] leading-tight">
                {nomeCliente}
              </h1>
              <p className="text-xs text-[#00A884] font-medium leading-tight">
                {isHuman ? "Atendimento com você" : "online · Atendente Virtual 24h"}
              </p>
            </div>
          </div>

          {/* Botões de Ação na Conversa */}
          <div className="flex items-center gap-2">
            {canAssume && (
              <button
                onClick={() => runAction("assumir")}
                disabled={busy}
                className="rounded-full bg-[#00A884] hover:bg-[#008069] px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-60 shadow-xs"
              >
                Assumir conversa
              </button>
            )}
            {isHuman && (
              <button
                onClick={() => runAction("reativar_ia")}
                disabled={busy}
                className="rounded-full border border-[#00A884] bg-[#D9FDD3] hover:bg-[#D9FDD3]/80 px-3.5 py-1.5 text-xs font-bold text-[#008069] transition disabled:opacity-60 shadow-xs"
              >
                Devolver para IA
              </button>
            )}
            {conversation.status !== "FINISHED" && (
              <button
                onClick={() => runAction("finalizar")}
                disabled={busy}
                className="rounded-full border border-[#E9EDEF] bg-white px-3 py-1.5 text-xs font-semibold text-[#54656F] hover:bg-[#F0F2F5] transition disabled:opacity-60"
              >
                Finalizar
              </button>
            )}
          </div>
        </div>

        {/* Lead Card (se houver dados capturados) */}
        {conversation.lead && (
          <div className="border-b border-[#C4E9BE] bg-[#D9FDD3]/50 px-4 py-2 text-xs text-[#008069] flex items-center justify-between">
            <span>
              <strong>Cliente identificado:</strong> {conversation.lead.name} · +{conversation.customerPhone}
              {conversation.lead.interest && ` · Interesse: ${conversation.lead.interest}`}
            </span>
            <StatusBadge status={conversation.status} />
          </div>
        )}

        {/* CORPO DO CHAT: PAPEL DE PAREDE DO WHATSAPP COM BOLHAS */}
        <div className="flex h-[58vh] min-h-[380px] flex-col gap-3 overflow-y-auto p-4 sm:p-5 bg-[#EFEAE2]">
          {/* Aviso Criptografia / Proteção do WhatsApp */}
          <div className="my-1 text-center">
            <span className="rounded-lg bg-[#FFEECD] px-3 py-1.5 text-[11.5px] text-[#54656F] shadow-2xs font-medium inline-block max-w-md">
              🔒 As mensagens são protegidas pela tecnologia de inteligência artificial da Nexora.
            </span>
          </div>

          {/* Pílula de Data estilo WhatsApp */}
          <div className="my-1 text-center">
            <span className="rounded-md bg-white/90 px-3 py-0.5 text-[11px] font-semibold text-[#54656F] shadow-2xs">
              HOJE
            </span>
          </div>

          {conversation.messages.length === 0 ? (
            <p className="m-auto text-sm text-[#667781]">Sem mensagens nesta conversa.</p>
          ) : (
            conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* BARRA DE DIGITAÇÃO ESTILO WHATSAPP */}
        <div className="border-t border-[#E9EDEF] bg-[#F0F2F5] p-2.5 sm:p-3">
          {isHuman ? (
            <form onSubmit={sendReply} className="flex items-center gap-2">
              <span className="text-[#54656F] p-1.5 cursor-pointer hover:text-[#111B21]">
                😊
              </span>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 rounded-full border border-transparent bg-white px-4 py-2.5 text-sm text-[#111B21] placeholder:text-[#8696A0] outline-none shadow-2xs focus:ring-1 focus:ring-[#00A884]"
              />
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                aria-label="Enviar mensagem"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white transition hover:bg-[#008069] disabled:opacity-50 shadow-xs"
              >
                <svg className="h-5 w-5 rotate-45 transform -translate-y-0.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 border border-[#E9EDEF]">
              <p className="text-xs text-[#667781]">
                {conversation.status === "AI" && "O Atendente Virtual está respondendo sozinho. Clique em Assumir para digitar."}
                {conversation.status === "WAITING_HUMAN" && "Cliente aguardando resposta humana. Clique em Assumir para responder."}
                {conversation.status === "FINISHED" && "Atendimento finalizado."}
              </p>
              {canAssume && (
                <button
                  type="button"
                  onClick={() => runAction("assumir")}
                  className="ml-3 shrink-0 rounded-lg bg-[#00A884] px-3 py-1 text-xs font-bold text-white hover:bg-[#008069]"
                >
                  Assumir
                </button>
              )}
            </div>
          )}
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
