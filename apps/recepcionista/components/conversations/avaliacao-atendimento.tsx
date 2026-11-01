"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RESULTADOS_ATENDIMENTO, ROTULOS_RESULTADO, type ResultadoAtendimento } from "@/lib/atendimento/avaliacao-schema";

type Dados = {
  lastMessageId: string | null;
  evaluation: { id: string; outcome: ResultadoAtendimento; note: string; source: string; createdAt: string; current: boolean } | null;
};

export function AvaliacaoAtendimento({ conversationId }: { conversationId: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [outcome, setOutcome] = useState<ResultadoAtendimento | "">("");
  const [note, setNote] = useState("");
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const tentativa = useRef<{ id: string; assinatura: string } | null>(null);
  const carregar = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/avaliacao`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Não foi possível carregar a avaliação.");
    setDados(body as Dados);
    return body as Dados;
  }, [conversationId]);
  useEffect(() => { let ativo = true; void carregar().catch(e => { if (ativo) setErro((e as Error).message); }); return () => { ativo = false; }; }, [carregar, tentativas]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!dados?.lastMessageId || !outcome || ocupado) return;
    setOcupado(true); setErro(""); setSalvo(false);
    const assinatura = JSON.stringify({ outcome, note: note.trim(), lastMessageId: dados.lastMessageId });
    const id = tentativa.current?.assinatura === assinatura ? tentativa.current.id : crypto.randomUUID();
    tentativa.current = { id, assinatura };
    try {
      const res = await fetch(`/api/conversations/${conversationId}/avaliacao`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, lastMessageId: dados.lastMessageId, outcome, note }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status < 500) tentativa.current = null;
        if (res.status === 409) await carregar();
        throw new Error(body.error ?? "Não foi possível confirmar o salvamento. Tente novamente.");
      }
      await carregar(); tentativa.current = null; setSalvo(true); setOutcome(""); setNote("");
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  return <details className="mt-4 rounded-2xl border border-panel-line bg-panel-card p-4">
    <summary className="cursor-pointer text-sm font-semibold text-panel-ink">Como foi este atendimento?</summary>
    <p className="mt-3 text-sm text-panel-sub">Sua avaliação ajuda a conferir o resultado e encontrar o que precisa melhorar. Ela não envia mensagem ao cliente.</p>
    {dados?.evaluation && <p className="mt-3 rounded-lg bg-panel-bg p-3 text-sm">
      {dados.evaluation.current ? "Última avaliação: " : "Há novas mensagens desde a avaliação: "}
      <strong>{ROTULOS_RESULTADO[dados.evaluation.outcome] ?? "Resultado a conferir"}</strong>
      {dados.evaluation.note && <span className="mt-1 block whitespace-pre-wrap text-panel-sub">{dados.evaluation.note}</span>}
    </p>}
    {dados && !dados.lastMessageId ? <p className="mt-3 text-sm text-panel-sub">A avaliação fica disponível depois das primeiras mensagens.</p> : <form onSubmit={salvar} className="mt-3 space-y-3">
      <label className="block text-sm font-medium">Resultado
        <select value={outcome} onChange={e => { setOutcome(e.target.value as ResultadoAtendimento | ""); setSalvo(false); }} disabled={ocupado || !dados} className="mt-1 w-full rounded-xl border border-panel-line bg-panel-card px-3 py-2 text-sm text-panel-ink">
          <option value="">Selecione o que aconteceu</option>
          {RESULTADOS_ATENDIMENTO.map(v => <option key={v} value={v}>{ROTULOS_RESULTADO[v]}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">{outcome === "PRECISA_CORRIGIR" ? "O que deveria ter sido respondido ou feito?" : "Observação (opcional)"}
        <textarea value={note} onChange={e => { setNote(e.target.value); setSalvo(false); }} maxLength={2000} rows={2} disabled={ocupado} required={outcome === "PRECISA_CORRIGIR"} minLength={outcome === "PRECISA_CORRIGIR" ? 5 : undefined} className="mt-1 w-full resize-y rounded-xl border border-panel-line bg-panel-card px-3 py-2 text-sm text-panel-ink" />
      </label>
      {outcome === "RESOLVIDO_ATENDENTE" && <p className="text-xs text-panel-sub">Confirme somente se o pedido foi resolvido corretamente sem participação ou solicitação da equipe nesta conversa.</p>}
      {outcome === "PRECISA_CORRIGIR" && <p className="text-xs text-panel-sub">A observação será registrada e a dúvida voltará para revisão. As regras da empresa continuam exigindo ensino e aplicação explícitos.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={ocupado || !dados?.lastMessageId || !outcome || outcome === "PRECISA_CORRIGIR" && note.trim().length < 5} className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-night disabled:opacity-50">{ocupado ? "Salvando…" : "Salvar avaliação"}</button>
        <Link href="/painel/treinamento" className="text-sm font-medium text-amber-deep underline">Revisar o que precisa aprender</Link>
      </div>
    </form>}
    {erro && <div role="alert" className="mt-3 text-sm text-red-700"><p>{erro}</p>{!dados && <button type="button" onClick={() => { setErro(""); setTentativas(v => v + 1); }} className="mt-1 underline">Tentar novamente</button>}</div>}
    {salvo && <p role="status" className="mt-3 text-sm text-green-700">Avaliação salva. Ela será considerada nos relatórios enquanto não houver novas mensagens.</p>}
  </details>;
}
