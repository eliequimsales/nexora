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

  return <section aria-label="Simulador do atendente" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-panel-line bg-panel-card shadow-sm">
    <div className="flex items-center justify-between gap-2 border-b border-panel-line p-4">
      <div className="flex items-center gap-3">
        <img src="/nex/nex-avatar.png" alt="Nex" className="h-9 w-9 rounded-xl border border-panel-line object-cover bg-white shadow-sm" />
        <div>
          <h2 className="font-semibold text-panel-ink text-sm sm:text-base">Teste com o Nex</h2>
          <p className="mt-0.5 text-xs text-panel-sub">Veja como o Nex responde aos seus clientes em tempo real.</p>
        </div>
      </div>
      <button type="button" disabled={ocupado || !historico.length} className="rounded-lg px-2 py-2 text-xs font-medium text-panel-sub hover:bg-panel-bg disabled:opacity-40" onClick={() => { setHistorico([]); setEstado(null); setFontes(null); setUltimoTeste(null); }}>Nova conversa</button>
    </div>
    <div className="border-b border-panel-line bg-amber/10 px-4 py-3 text-xs leading-relaxed text-panel-ink">Teste seguro: não envia mensagens nem faz reservas.</div>
    {erro && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">{erro}</p>}
    <details className="border-b border-panel-line px-4 py-3 text-xs text-panel-sub"><summary className="cursor-pointer font-medium">Experimentar outra situação</summary><label className="mt-3 block" htmlFor="cenario-atendente">Situação para testar</label><div className="mt-1 flex gap-2"><select id="cenario-atendente" className={CAMPO} value={cenario} disabled={ocupado || respondendo} onChange={e => setCenario(e.target.value as CenarioNexa)}>{CENARIOS_NEXA.map(c => <option value={c.id} key={c.id}>{c.titulo}</option>)}</select><button className={BOTAO} type="button" disabled={ocupado || respondendo} onClick={() => { const c = CENARIOS_NEXA.find(c => c.id === cenario)!; void testar(c.pergunta, c.id, true); }}>Testar</button></div></details>
    <div ref={conversa} tabIndex={-1} aria-label="Conversa de teste" className="min-h-[160px] flex-1 space-y-3 overflow-y-auto bg-panel-bg/70 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber xl:max-h-[300px]" aria-live="polite">
      {!historico.length && <div className="mx-auto max-w-xs py-4 text-center text-sm leading-relaxed text-panel-sub"><span aria-hidden="true" className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber/20 text-panel-ink">✦</span><p>Escreva uma dúvida que seus clientes costumam enviar.</p></div>}
      {historico.map((m, i) => (
        m.de === "cliente" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm border border-amber/20 bg-[#FFF8E7] px-3.5 py-3 text-sm leading-relaxed text-panel-ink">
              <span className="mb-1 block text-[11px] font-semibold text-amber-900/70">Você, como cliente</span>
              {m.texto}
            </div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-2.5 justify-start">
            <img src="/nex/nex-avatar.png" alt="Nex" className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-panel-line object-cover bg-white shadow-sm" />
            <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-panel-line bg-panel-card px-3.5 py-3 text-sm leading-relaxed text-panel-ink shadow-sm">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-panel-ink">Nex</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-panel-sub">Atendente Oficial</span>
              </div>
              {m.texto}
            </div>
          </div>
        )
      ))}
      {respondendo && (
        <div role="status" className="flex items-center gap-2 pl-1 text-xs text-panel-sub">
          <img src="/nex/nex-avatar.png" alt="" className="h-5 w-5 rounded-full object-cover shrink-0 animate-pulse border border-panel-line" />
          <span>Nex está digitando…</span>
        </div>
      )}<div ref={fim} />
    </div>
    {Array.isArray(fontes) && fontes.length > 0 && <details className="border-t border-panel-line px-4 py-3 text-xs text-panel-sub"><summary className="cursor-pointer">Informações utilizadas nesta resposta</summary><ul className="mt-2 list-inside list-disc space-y-1">{fontes.filter((f): f is string => typeof f === "string").map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
    {ultimoTeste && <div className="space-y-2 border-t border-panel-line p-4"><p className="text-xs font-medium text-panel-sub">A resposta está correta para o seu negócio?</p><div className="flex flex-wrap gap-2"><button type="button" className={`${BOTAO} ${atual?.correto === true ? "!border-emerald-500 !bg-emerald-500/10" : ""}`} disabled={ocupado || sujo} onClick={() => void revisar(true)}>Está correta</button><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void revisar(false)}>Preciso corrigir</button></div>{atual?.correto === true && (proximo ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || sujo} onClick={() => { setCenario(proximo.id); void testar(proximo.pergunta, proximo.id, true); }}>Testar próxima resposta</button> : proximoCenario === null && concluirTeste ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || sujo} onClick={concluirTeste}>Concluir testes</button> : null)}</div>}
    <form className="space-y-2 border-t border-panel-line p-4" onSubmit={e => { e.preventDefault(); void testar(texto); }}>{sujo && <p className="text-xs text-panel-sub">O teste aguarda o salvamento e usa suas informações mais recentes.</p>}<label className="sr-only" htmlFor="mensagem-teste-atendente">Mensagem de teste</label><textarea id="mensagem-teste-atendente" rows={2} maxLength={500} className={CAMPO} placeholder="Escreva como um cliente…" value={texto} disabled={ocupado || respondendo} onChange={e => setTexto(e.target.value)} /><button type="submit" className={`${PRINCIPAL} w-full`} disabled={ocupado || respondendo || !texto.trim()}>Enviar no teste</button></form>
  </section>;
}

