"use client";

import { useEffect, useRef, useState } from "react";
import { CENARIOS_NEXA, type CenarioNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, PRINCIPAL_NEXA as PRINCIPAL } from "./configuracao-campos";
import { requisitarConfiguracaoNexa as requisitar, type OperarConfiguracaoNexa } from "./configuracao-requisicao";

type Mensagem = { de: "cliente" | "atendente"; texto: string };
export type PedidoTesteNexa = { cenario: CenarioNexa; seq: number };
type Props = {
  tela: TelaConfiguracaoNexa;
  ocupado: boolean;
  sujo: boolean;
  erro: string;
  pedido: PedidoTesteNexa | null;
  operar: OperarConfiguracaoNexa;
  prepararTeste: () => Promise<TelaConfiguracaoNexa | null>;
  aplicar: (tela: TelaConfiguracaoNexa) => void;
  corrigir: (cenario: CenarioNexa) => void;
  proximoCenario?: CenarioNexa | null;
  concluirTeste?: () => void;
};

export function SimuladorConfiguracaoNexa({ tela, ocupado, sujo, erro, pedido, operar, prepararTeste, aplicar, corrigir, proximoCenario, concluirTeste }: Props) {
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<unknown>(null);
  const [cenario, setCenario] = useState<CenarioNexa>("INFORMACOES");
  const [fontes, setFontes] = useState<unknown>(null);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const conversa = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const seqTratada = useRef(0);
  useEffect(() => { setHistorico([]); setEstado(null); setFontes(null); setUltimoTeste(null); }, [tela.revisao]);
  useEffect(() => {
    if (!historico.length && !respondendo) return;
    fim.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [historico, respondendo]);

  async function testar(pergunta: string, escolhido = cenario, novaConversa = false) {
    if (ocupado || respondendo || (!pergunta.trim() && escolhido !== "MIDIA")) return;
    setRespondendo(true);
    const base = await prepararTeste();
    if (!base) { setRespondendo(false); return; }
    const reiniciar = novaConversa || base.revisao !== tela.revisao;
    const antes = reiniciar ? [] : historico;
    const mensagem = escolhido === "MIDIA" && !pergunta.trim() ? "[Mídia recebida: áudio; conteúdo não interpretado]" : pergunta.trim();
    const mensagens: Mensagem[] = [...antes.slice(-29), { de: "cliente", texto: mensagem }];
    setRespondendo(true); setHistorico(mensagens); setTexto(""); setUltimoTeste(null);
    const resultado = await operar(async () => {
      const resposta = await requisitar<{ mensagens: string[]; estado: unknown; fontes?: unknown; testeId?: string }>("/api/atendente/simular", "POST", {
        configuracaoRevisao: base.revisao, cenario: escolhido,
        mensagens: escolhido === "MIDIA" && novaConversa ? [{ de: "cliente", texto: "", midia: "audio" }] : mensagens,
        estado: reiniciar ? null : estado,
      });
      return { resposta, nova: await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao") };
    });
    if (resultado) {
      setHistorico([...mensagens, ...resultado.resposta.mensagens.map(texto => ({ de: "atendente" as const, texto }))]);
      setEstado(resultado.resposta.estado); setFontes(resultado.resposta.fontes ?? null); setUltimoTeste(resultado.resposta.testeId ?? null); aplicar(resultado.nova);
    } else { setHistorico(antes); setTexto(pergunta); }
    setRespondendo(false);
  }

  useEffect(() => {
    if (!pedido || pedido.seq === seqTratada.current) return;
    seqTratada.current = pedido.seq; setCenario(pedido.cenario);
    conversa.current?.focus({ preventScroll: true });
    conversa.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const c = CENARIOS_NEXA.find(c => c.id === pedido.cenario)!;
    void testar(c.pergunta, c.id, true);
    // Cada pedido é uma ação explícita do usuário; alterações de outros estados não o repetem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.seq]);

  async function revisar(correto: boolean) {
    if (!ultimoTeste || ocupado || sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "REVISAR_TESTE", revisao: tela.revisao, testeId: ultimoTeste, correto }));
    if (nova) { aplicar(nova); if (!correto) corrigir(cenario); }
  }
  const atual = tela.testes.find(t => t.id === ultimoTeste && t.revisao === tela.revisao);
  const proximo = proximoCenario && proximoCenario !== atual?.cenario
    ? CENARIOS_NEXA.find(c => c.id === proximoCenario)
    : null;

  return <section aria-label="Simulador do atendente" className="flex min-h-0 flex-col overflow-hidden bg-panel-card">
    <div className="flex items-center justify-between gap-3 border-b border-panel-line px-4 py-2"><p className="text-xs leading-relaxed text-panel-sub">Não envia mensagens nem faz reservas.</p><button type="button" disabled={ocupado || respondendo || !historico.length} className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-panel-sub hover:bg-panel-bg disabled:opacity-40" onClick={() => { setHistorico([]); setEstado(null); setFontes(null); setUltimoTeste(null); }}>Nova conversa</button></div>
    {erro && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">{erro}</p>}
    <details className="border-b border-panel-line px-4 py-3 text-xs text-panel-sub"><summary className="cursor-pointer font-medium">Experimentar outra situação</summary><label className="mt-3 block" htmlFor="cenario-atendente">Situação para testar</label><div className="mt-1 flex gap-2"><select id="cenario-atendente" className={CAMPO} value={cenario} disabled={ocupado || respondendo} onChange={e => setCenario(e.target.value as CenarioNexa)}>{CENARIOS_NEXA.map(c => <option value={c.id} key={c.id}>{c.titulo}</option>)}</select><button className={BOTAO} type="button" disabled={ocupado || respondendo} onClick={() => { const c = CENARIOS_NEXA.find(c => c.id === cenario)!; void testar(c.pergunta, c.id, true); }}>Testar</button></div></details>
    <div ref={conversa} tabIndex={-1} aria-label="Conversa de teste" className="min-h-[160px] flex-1 space-y-3 overflow-y-auto bg-panel-bg/70 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber" aria-live="polite">
      {!historico.length && <div className="mx-auto max-w-xs py-4 text-center text-sm leading-relaxed text-panel-sub"><span aria-hidden="true" className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber/20 text-panel-ink">✦</span><p>Escreva uma dúvida que seus clientes costumam enviar.</p></div>}
      {historico.map((m, i) => <div key={i} className={`flex ${m.de === "cliente" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${m.de === "cliente" ? "rounded-br-sm bg-amber/20 text-panel-ink" : "rounded-bl-sm border border-panel-line bg-panel-card text-panel-ink"}`}><span className="mb-1 block text-[11px] font-semibold text-panel-sub">{m.de === "cliente" ? "Você, como cliente" : "Seu atendente"}</span>{m.texto}</div></div>)}
      {respondendo && <p role="status" className="text-xs text-panel-sub">Preparando resposta…</p>}<div ref={fim} />
    </div>
    {Array.isArray(fontes) && fontes.length > 0 && <details className="border-t border-panel-line px-4 py-3 text-xs text-panel-sub"><summary className="cursor-pointer">Informações utilizadas nesta resposta</summary><ul className="mt-2 list-inside list-disc space-y-1">{fontes.filter((f): f is string => typeof f === "string").map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
    {ultimoTeste && <div className="space-y-2 border-t border-panel-line p-4">{atual?.correto === true ? <><p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Resposta conferida.</p>{proximo ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || sujo} onClick={() => { setCenario(proximo.id); void testar(proximo.pergunta, proximo.id, true); }}>Testar próxima resposta</button> : proximoCenario === null && concluirTeste ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || sujo} onClick={concluirTeste}>Concluir testes</button> : null}<button type="button" className="text-xs font-medium text-panel-sub underline underline-offset-4" disabled={ocupado || respondendo || sujo} onClick={() => void revisar(false)}>Preciso corrigir esta resposta</button></> : <><p className="text-sm font-medium text-panel-ink">A resposta está correta para o seu negócio?</p><div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado || respondendo || sujo} onClick={() => void revisar(true)}>Está correta</button><button type="button" className={BOTAO} disabled={ocupado || respondendo || sujo} onClick={() => void revisar(false)}>Preciso corrigir</button></div></>}</div>}
    <form className="space-y-2 border-t border-panel-line p-4" onSubmit={e => { e.preventDefault(); void testar(texto); }}>{sujo && <p className="text-xs text-panel-sub">O teste aguarda o salvamento e usa suas informações mais recentes.</p>}<label className="sr-only" htmlFor="mensagem-teste-atendente">Mensagem de teste</label><textarea id="mensagem-teste-atendente" rows={2} maxLength={500} className={CAMPO} placeholder="Escreva como um cliente…" value={texto} disabled={ocupado || respondendo} onChange={e => setTexto(e.target.value)} /><button type="submit" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || !texto.trim()}>Enviar no teste</button></form>
  </section>;
}

