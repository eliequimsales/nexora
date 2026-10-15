"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge, STATUS_LABEL } from "@/components/status";
import { CartaoDaNoite } from "@/components/painel/cartao-da-noite";

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
  const [busca, setBusca] = useState<string>("");
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

  const filtradas = conversations.filter((c) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    const nome = (c.customerName || "").toLowerCase();
    const fone = c.customerPhone.toLowerCase();
    const msg = (c.lastMessage?.content || "").toLowerCase();
    return nome.includes(termo) || fone.includes(termo) || msg.includes(termo);
  });

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* Aviso de conversas da noite / resumo */}
      <div className="mb-4">
        <CartaoDaNoite />
      </div>

      {/* PAINEL ESTILO WHATSAPP: BUSCA + ABAS DE FILTRO */}
      <div className="overflow-hidden rounded-2xl border border-[#E9EDEF] bg-white shadow-xs">
        {/* Barra de Pesquisa Idêntica ao WhatsApp */}
        <div className="border-b border-[#E9EDEF] bg-white p-3">
          <div className="flex items-center gap-3 rounded-xl bg-[#F0F2F5] px-4 py-2 text-sm text-[#111B21] transition focus-within:bg-white focus-within:ring-1 focus-within:ring-amber">
            <svg className="h-4 w-4 shrink-0 text-[#667781]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
              className="w-full bg-transparent text-sm text-[#111B21] placeholder:text-[#667781] outline-none"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="text-xs text-[#667781] hover:text-[#111B21]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chips de Filtro Oficiais do WhatsApp (Todas, Não lidas, etc.) */}
          <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map((value) => {
              const count = value === "" ? total : (counts[value] ?? 0);
              const active = filter === value;
              const rotulo =
                value === ""
                  ? "Tudo"
                  : value === "WAITING_HUMAN"
                  ? "Aguardando equipe"
                  : value === "AI"
                  ? "Atendente"
                  : value === "HUMAN"
                  ? "Você"
                  : STATUS_LABEL[value];

              return (
                <button
                  key={value || "all"}
                  onClick={() => setFilter(value)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-amber/25 text-night font-bold ring-1 ring-amber/40 shadow-2xs"
                      : "bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF] hover:text-[#111B21]"
                  }`}
                >
                  <span>{rotulo}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-bold ${
                        active ? "text-night font-black" : "text-[#667781]"
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* LISTA DE CONVERSAS ESTILO WHATSAPP */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[#667781]">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent mb-2" />
            <p>Carregando conversas do WhatsApp...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F2F5] text-2xl">
              💬
            </div>
            <p className="font-semibold text-[#111B21]">
              {busca ? "Nenhuma conversa encontrada para essa busca." : "Nenhuma conversa por aqui ainda."}
            </p>
            <p className="mt-1 text-xs text-[#667781] max-w-sm mx-auto">
              Quando seus clientes escreverem no WhatsApp, as conversas aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E9EDEF]">
            {filtradas.map((conversation) => {
              const nomeExibicao = conversation.customerName || `+${conversation.customerPhone}`;
              const iniciais = (conversation.customerName ?? conversation.customerPhone).slice(0, 2).toUpperCase();
              const ehEquipe = conversation.status === "WAITING_HUMAN";
              const remetente = conversation.lastMessage
                ? { AI: "Atendente: ", HUMAN: "Você: ", CUSTOMER: "" }[conversation.lastMessage.role] ?? ""
                : "";

              return (
                <li key={conversation.id}>
                  <Link
                    href={`/painel/conversas/${conversation.id}`}
                    className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-[#F5F6F6] active:bg-[#E9EDEF]"
                  >
                    {/* Foto de Perfil / Avatar Circular do WhatsApp */}
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DFE5E7] font-semibold text-[#54656F] text-sm shadow-inner">
                        {iniciais}
                      </div>
                      {ehEquipe && (
                        <span
                          className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 rounded-full bg-amber ring-2 ring-white"
                          title="Aguardando resposta da sua equipe"
                        />
                      )}
                    </div>

                    {/* Informações da Linha do Chat */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-base font-semibold text-[#111B21]">
                          {nomeExibicao}
                        </p>
                        <span
                          className={`shrink-0 font-sans text-xs ${
                            ehEquipe ? "font-bold text-amber-deep" : "text-[#667781]"
                          }`}
                        >
                          {formatTime(conversation.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1 truncate text-[13.5px] text-[#667781]">
                          {conversation.lastMessage?.role !== "CUSTOMER" && (
                            <span className="text-[#53BDEB] font-bold text-[11px] tracking-tighter" title="Enviado">
                              ✓✓
                            </span>
                          )}
                          <span className="truncate">
                            {conversation.lastMessage
                              ? `${remetente}${conversation.lastMessage.content}`
                              : "Sem mensagens recentes"}
                          </span>
                        </p>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={conversation.status} />
                          {ehEquipe && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1.5 text-[10px] font-black text-night shadow-2xs">
                              1
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* BOTÃO FLUTUANTE DE NOVA CONVERSA COM IDENTIDADE NEXORA */}
      <Link
        href="/painel/atendente"
        aria-label="Abrir Atendente Virtual"
        title="Testar atendimento no simulador"
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber text-night shadow-lg shadow-amber/25 transition hover:bg-amber-400 active:scale-95 sm:bottom-8 sm:right-8 font-black"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </Link>
    </div>
  );
}
