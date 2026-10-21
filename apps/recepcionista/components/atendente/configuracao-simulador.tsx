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
  aplicar: (tela: TelaConfiguracaoNexa) => void;
  corrigir: (cenario: CenarioNexa) => void;
};

export function SimuladorConfiguracaoNexa({ tela, ocupado, sujo, erro, pedido, operar, aplicar, corrigir }: Props) {
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<unknown>(null);
  const [cenario, setCenario] = useState<CenarioNexa>("INFORMACOES");
  const [fontes, setFontes] = useState<unknown>(null);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const seqTratada = useRef(0);
  useEffect(() => { setHistorico([]); setEstado(null); setFontes(null); setUltimoTeste(null); }, [tela.revisao]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [historico, respondendo]);

  async function testar(pergunta: string, escolhido = cenario, novaConversa = false) {
    if (sujo || ocupado || (!pergunta.trim() && escolhido !== "MIDIA")) return;
    const antes = novaConversa ? [] : historico;
    const mensagem = escolhido === "MIDIA" && !pergunta.trim() ? "[Mídia recebida: áudio; conteúdo não interpretado]" : pergunta.trim();
    const mensagens: Mensagem[] = [...antes.slice(-29), { de: "cliente", texto: mensagem }];
    setRespondendo(true); setHistorico(mensagens); setTexto(""); setUltimoTeste(null);
    const resultado = await operar(async () => {
      const resposta = await requisitar<{ mensagens: string[]; estado: unknown; fontes?: unknown; testeId?: string }>("/api/atendente/simular", "POST", {
        configuracaoRevisao: tela.revisao, cenario: escolhido,
        mensagens: escolhido === "MIDIA" && novaConversa ? [{ de: "cliente", texto: "", midia: "audio" }] : mensagens,
        estado: novaConversa ? null : estado,
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

  return <section aria-label="Simulador da Nexa" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-panel-line bg-panel-card shadow-sm">
    <div className="flex items-center justify-between gap-2 border-b border-panel-line p-4"><div><h2 className="font-semibold text-panel-ink">Teste sua Nexa</h2><p className="text-xs text-panel-sub">Versão de teste · revisão {tela.revisao}</p></div><button type="button" disabled={ocupado || !historico.length} className="rounded-lg px-2 py-2 text-xs font-medium text-panel-sub hover:bg-panel-bg disabled:opacity-40" onClick={() => { setHistorico([]); setEstado(null); setFontes(null); setUltimoTeste(null); }}>Nova conversa</button></div>
    <div className="border-b border-panel-line bg-amber/10 px-4 py-3 text-xs leading-relaxed text-panel-ink">Esta é uma simulação. Não envia mensagens pelo WhatsApp nem cria agendamentos reais.</div>
    {erro && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">{erro}</p>}
    <div className="p-4"><label className="text-xs font-medium text-panel-sub" htmlFor="cenario-nexa">Escolha um cenário</label><div className="mt-1 flex gap-2"><select id="cenario-nexa" className={CAMPO} value={cenario} disabled={ocupado} onChange={e => setCenario(e.target.value as CenarioNexa)}>{CENARIOS_NEXA.map(c => <option value={c.id} key={c.id}>{c.titulo}</option>)}</select><button className={BOTAO} type="button" disabled={ocupado || sujo} onClick={() => { const c = CENARIOS_NEXA.find(c => c.id === cenario)!; void testar(c.pergunta, c.id, true); }}>Testar</button></div></div>
    <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto bg-panel-bg/70 p-4 xl:max-h-[430px]" aria-live="polite">
      {!historico.length && <div className="mx-auto max-w-xs py-7 text-center text-sm leading-relaxed text-panel-sub"><span aria-hidden="true" className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber/20 text-lg text-panel-ink">✦</span><p>Pergunte como um cliente perguntaria. Confira informações, limites e encaminhamentos.</p></div>}
      {historico.map((m, i) => <div key={i} className={`flex ${m.de === "cliente" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${m.de === "cliente" ? "rounded-br-sm bg-amber/20 text-panel-ink" : "rounded-bl-sm border border-panel-line bg-panel-card text-panel-ink"}`}><span className="mb-1 block text-[11px] font-semibold text-panel-sub">{m.de === "cliente" ? "Você, como cliente" : tela.rascunho.atendimento.nome || "Nexa"}</span>{m.texto}</div></div>)}
      {respondendo && <p role="status" className="text-xs text-panel-sub">Preparando resposta…</p>}<div ref={fim} />
    </div>
    {Array.isArray(fontes) && fontes.length > 0 && <details className="border-t border-panel-line px-4 py-3 text-xs text-panel-sub"><summary className="cursor-pointer">Informações utilizadas nesta resposta</summary><ul className="mt-2 list-inside list-disc space-y-1">{fontes.filter((f): f is string => typeof f === "string").map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
    {ultimoTeste && <div className="space-y-2 border-t border-panel-line p-4"><p className="text-xs font-medium text-panel-sub">A resposta está correta para o seu negócio?</p><div className="flex flex-wrap gap-2"><button type="button" className={`${BOTAO} ${atual?.correto === true ? "!border-emerald-500 !bg-emerald-500/10" : ""}`} disabled={ocupado || sujo} onClick={() => void revisar(true)}>Está correta</button><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void revisar(false)}>Preciso corrigir</button></div></div>}
    <form className="space-y-2 border-t border-panel-line p-4" onSubmit={e => { e.preventDefault(); void testar(texto); }}>{sujo && <p className="text-xs text-amber-deep">Salve o rascunho para testar as alterações.</p>}<label className="sr-only" htmlFor="mensagem-teste-nexa">Mensagem de teste</label><textarea id="mensagem-teste-nexa" rows={2} maxLength={500} className={CAMPO} placeholder="Escreva como um cliente…" value={texto} disabled={ocupado} onChange={e => setTexto(e.target.value)} /><button type="submit" className={`${PRINCIPAL} w-full`} disabled={ocupado || sujo || !texto.trim()}>Enviar no teste</button></form>
  </section>;
}

