"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MaterialNexa, TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
const ENDPOINT = "/api/atendente/configuracao/materiais";
type Props = {
  revisao: number; materiais?: MaterialNexa[]; desabilitado?: boolean;
  aoImportar: (tela: TelaConfiguracaoNexa) => void;
  aoEstado?: (estado: { pendente: boolean; ocupado: boolean }) => void;
};
export function ImportarMaterialDoAtendente({ revisao, materiais = [], desabilitado = false, aoImportar, aoEstado }: Props) {
  const id = useId(); const arquivo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false); const [nome, setNome] = useState(""); const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"TEXTO" | "ARQUIVO" | "AUDIO">("TEXTO");
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(""); const [aviso, setAviso] = useState("");
  const [audio, setAudio] = useState(false); const [validade, setValidade] = useState("");
  const estadoRef = useRef(aoEstado); estadoRef.current = aoEstado;
  useEffect(() => { estadoRef.current?.({ pendente: !!texto.trim() || !!nome.trim() || !!validade, ocupado }); }, [texto, nome, validade, ocupado]);
  useEffect(() => () => estadoRef.current?.({ pendente: false, ocupado: false }), []);
  useEffect(() => { fetch(ENDPOINT, { cache: "no-store" }).then(async r => r.ok ? r.json() : null).then(v => setAudio(!!v?.audioDisponivel)).catch(() => {}); }, []);
  async function enviarArquivo(f: File) {
    setOcupado(true); setErro(""); setAviso("");
    try {
      const dados = new FormData(); dados.append("arquivo", f);
      const r = await fetch(`${ENDPOINT}/extrair`, { method: "POST", body: dados }); const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Não consegui ler esse arquivo.");
      setNome(body.nome); setTexto(body.texto); setTipo(body.tipo); setAberto(true); setAviso(body.aviso);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); if (arquivo.current) arquivo.current.value = ""; }
  }
  async function guardar() {
    if (!texto.trim() || ocupado) return;
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisao, nome: nome.trim() || "Informações enviadas por texto", texto, tipo, validoAte: validade ? new Date(`${validade}T23:59:59`).toISOString() : null }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || "Não consegui guardar esse material.");
      aoImportar(body.tela); setTexto(""); setNome(""); setValidade(""); setTipo("TEXTO"); setAviso(body.resumo);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  async function remover(m: MaterialNexa) {
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await fetch(ENDPOINT, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisao, id: m.id }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || "Não consegui remover esse material.");
      aoImportar(body.tela); setAviso(body.resumo);
    } catch(e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  const bloqueado = ocupado || desabilitado;
  return <div className="rounded-2xl border border-panel-line bg-white px-4 py-3 text-sm">
    <button type="button" className="flex min-h-10 w-full items-center justify-between gap-3 text-left font-medium text-panel-ink" aria-expanded={aberto} aria-controls={`${id}-conteudo`} onClick={() => setAberto(v => !v)}>
      <span>Ensinar com um material</span><span aria-hidden="true">{aberto ? "−" : "+"}</span>
    </button>
    <p className="text-xs leading-relaxed text-panel-sub">Envie informações que já tem. Você confere antes de usar com os clientes.</p>
    {aberto && <div id={`${id}-conteudo`} className="mt-4 space-y-3">
      <input ref={arquivo} type="file" className="hidden" accept={`.txt,.md,.csv,.json${audio ? ",.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,.flac" : ""}`} disabled={bloqueado} onChange={e => { const f=e.target.files?.[0]; if(f) void enviarArquivo(f); }} />
      <button type="button" className="min-h-11 rounded-xl border border-panel-line px-4 font-medium disabled:opacity-50" disabled={bloqueado || !!texto.trim()} onClick={() => arquivo.current?.click()}>{ocupado ? "Preparando material…" : "Escolher arquivo"}</button>
      <p className="text-xs leading-relaxed text-panel-sub">TXT, MD, CSV ou JSON · até 6.000 caracteres{audio ? ". Áudio de até 10 MB, com conferência da transcrição." : ". A transcrição de áudio ainda não está disponível nesta instalação."} Para PDF ou XLSX, copie o texto ou exporte um CSV.</p>
      <label className="block text-xs font-medium text-panel-sub" htmlFor={`${id}-nome`}>Nome do material</label>
      <input id={`${id}-nome`} className="min-h-11 w-full rounded-xl border border-panel-line px-3 text-sm" value={nome} onChange={e => setNome(e.target.value)} maxLength={180} disabled={bloqueado} placeholder="Ex.: serviços e regras da empresa" />
      <label className="block text-xs font-medium text-panel-sub" htmlFor={`${id}-texto`}>Confira ou cole as informações</label>
      <textarea id={`${id}-texto`} className="min-h-36 w-full resize-y rounded-xl border border-panel-line p-3 text-sm leading-relaxed" value={texto} onChange={e => setTexto(e.target.value)} maxLength={6000} disabled={bloqueado} placeholder="Cole seu material aqui. Para tabela, use colunas nome, preco e duracao_minutos; ou pergunta e resposta." />
      <div className="flex items-center justify-between gap-3"><label className="text-xs text-panel-sub" htmlFor={`${id}-validade`}>Válido até (opcional)</label><input id={`${id}-validade`} type="date" value={validade} onChange={e=>setValidade(e.target.value)} disabled={bloqueado} className="min-h-10 min-w-0 rounded-lg border border-panel-line px-2 text-sm" /></div>
      <p className="text-xs text-panel-sub">{texto.length.toLocaleString("pt-BR")} / 6.000 caracteres</p>
      <button type="button" disabled={bloqueado || !texto.trim()} onClick={() => void guardar()} className="min-h-11 w-full rounded-xl bg-panel-ink px-4 font-medium text-white disabled:opacity-50">{ocupado ? "Aguarde…" : "Guardar para revisar"}</button>
      {(!!texto.trim() || !!nome.trim() || !!validade) && <button type="button" disabled={bloqueado} onClick={() => { setTexto(""); setNome(""); setValidade(""); setTipo("TEXTO"); setErro(""); setAviso(""); }} className="min-h-10 w-full text-xs text-panel-sub underline disabled:opacity-50">Descartar texto preparado</button>}
      {materiais.length > 0 && <ul className="divide-y divide-panel-line">{materiais.map(m=><li key={m.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-xs font-medium">{m.nome}</p><p className="mt-1 text-xs text-panel-sub">{m.tipo === "AUDIO" ? "Transcrição de áudio" : m.tipo === "ARQUIVO" ? "Arquivo enviado" : "Texto informado"} · {new Date(m.importadoEm).toLocaleDateString("pt-BR")}{m.validoAte ? ` · válido até ${new Date(m.validoAte).toLocaleDateString("pt-BR")}` : ""}</p></div><button type="button" onClick={() => void remover(m)} disabled={bloqueado} className="min-h-10 shrink-0 px-2 text-xs underline disabled:opacity-50" aria-label={`Remover material ${m.nome}`}>Remover</button></li>)}</ul>}
    </div>}
    {erro && <p role="alert" className="mt-3 text-xs leading-relaxed text-red-700">{erro}</p>}
    {aviso && <p role="status" className="mt-3 text-xs leading-relaxed text-panel-sub">{aviso}</p>}
  </div>;
}
