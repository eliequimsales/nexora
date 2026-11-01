"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ResumoTopicoConfiguracao, TopicoConfiguracao } from "@/lib/atendente/configuracao-topicos";
import type { ConfiguracaoNexa, PendenciaNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA, PRINCIPAL_NEXA, PendenciasNexaContext } from "./configuracao-campos";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";

const SOBRE_O_ASSUNTO: Record<TopicoConfiguracao, string> = {
  EMPRESA: "Seu negócio e o que você faz",
  SERVICOS: "O que você oferece e quanto custa",
  FUNCIONAMENTO: "Dias, horários e onde você atende",
  ATENDIMENTO: "Como falar e quando chamar você",
  REGRAS: "O que seus clientes costumam perguntar",
};

export function TopicosDaConfiguracao({ topicos, ativo, desabilitado, escolher }: {
  topicos: ResumoTopicoConfiguracao[];
  ativo: TopicoConfiguracao | null;
  desabilitado: boolean;
  escolher: (topico: TopicoConfiguracao) => void;
}) {
  return <nav aria-label="Tópicos da conversa" className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-panel-card">
    {topicos.map((topico, indice) => <button type="button" key={topico.id} aria-current={ativo === topico.id ? "step" : undefined} disabled={desabilitado}
      title={SOBRE_O_ASSUNTO[topico.id]}
      onClick={() => escolher(topico.id)}
      className={`flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition first:rounded-t-2xl last:rounded-b-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber disabled:cursor-wait disabled:opacity-50 ${ativo === topico.id ? "bg-[#FFF8DF]" : "hover:bg-panel-bg"}`}>
      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ativo === topico.id ? "bg-amber text-night" : "bg-panel-bg text-panel-sub"}`}>{indice + 1}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-snug text-panel-ink">{topico.titulo}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-panel-sub">{SOBRE_O_ASSUNTO[topico.id]}</span></span>
      <span className={`shrink-0 text-[10px] font-medium ${ativo === topico.id ? "text-amber-deep" : topico.estado === "PREENCHIDO" ? "text-emerald-700" : "text-panel-sub"}`}>{ativo === topico.id ? "Conversando" : topico.estado === "PENDENTE" ? "Falta informar" : topico.estado === "REVISAR" ? "Conferir" : "Informado"}</span>
    </button>)}
  </nav>;
}

export function EditorDoTopico({ topico, dados, pendencias, editar, desabilitado, estadoSalvo, erro, erroAoSalvar, concluir, conversar, tentarSalvar, children }: {
  topico: ResumoTopicoConfiguracao;
  dados: ConfiguracaoNexa;
  pendencias: PendenciaNexa[];
  editar: <K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) => void;
  desabilitado: boolean;
  estadoSalvo: string;
  erro?: string;
  erroAoSalvar: boolean;
  concluir: () => void;
  conversar: () => void;
  tentarSalvar: () => void;
  children?: ReactNode;
}) {
  const tituloId = useId();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { tituloRef.current?.focus({ preventScroll: true }); }, [topico.id]);
  return <section aria-labelledby={tituloId} aria-live="off" className="rounded-2xl border border-panel-line bg-panel-card shadow-sm">
    <div className="flex items-start justify-between gap-3 border-b border-panel-line px-4 py-4 sm:px-5"><div className="min-w-0"><h3 ref={tituloRef} id={tituloId} tabIndex={-1} className="text-base font-semibold text-panel-ink outline-none">{topico.titulo}</h3><p className="mt-1 text-xs leading-relaxed text-panel-sub">{topico.descricao}</p></div><button type="button" onClick={concluir} disabled={desabilitado} aria-label={`Fechar tópico: ${topico.titulo}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-panel-sub hover:bg-panel-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50">×</button></div>
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <p className="text-xs leading-relaxed text-panel-sub">As alterações são salvas automaticamente. Se preferir, explique tudo na conversa.</p>
      <fieldset disabled={desabilitado} className="min-w-0"><PendenciasNexaContext.Provider value={pendencias.filter(p => !p.campo.startsWith("teste:") && !p.campo.startsWith("etapa:"))}>
        <FormularioConfiguracaoNexa etapa={topico.etapa} secaoInformacoes={topico.id === "SERVICOS" || topico.id === "FUNCIONAMENTO" ? topico.id : undefined} dados={dados} editar={editar} />
      </PendenciasNexaContext.Provider></fieldset>
      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">{erro}</p>}
      {erroAoSalvar && <button type="button" className={BOTAO_NEXA} disabled={desabilitado} onClick={tentarSalvar}>Tentar salvar novamente</button>}
      {children}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-line px-4 py-4 sm:px-5"><span role="status" className="text-xs text-panel-sub">{estadoSalvo}</span><button type="button" className={`${PRINCIPAL_NEXA} text-xs`} disabled={desabilitado} onClick={conversar}>Voltar para a conversa</button></div>
  </section>;
}
