"use client";

import { Children, cloneElement, createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode } from "react";
import type { InformacaoNexa, PendenciaNexa, SituacaoInformacao } from "@/lib/atendente/configuracao-schema";

export const PendenciasNexaContext = createContext<PendenciaNexa[]>([]);

export const CAMPO_NEXA = "w-full min-w-0 rounded-xl border border-panel-line bg-panel-bg px-3 py-2.5 text-sm text-panel-ink outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/20 disabled:opacity-60";
export const BOTAO_NEXA = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-panel-line bg-panel-card px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber/60 disabled:cursor-not-allowed disabled:opacity-50";
export const PRINCIPAL_NEXA = `${BOTAO_NEXA} !border-amber !bg-amber !text-night hover:!bg-amber/85`;
export const SITUACOES_NEXA: Record<SituacaoInformacao, string> = { CONFIRMADO: "Confirmado", REVISAR: "Confira esta informação", NAO_INFORMADO: "Não informado", NAO_APLICA: "Não se aplica" };

function correspondeAoCampo(pendencia: PendenciaNexa, campos: string[]) {
  return campos.some(campo => pendencia.campo === campo || pendencia.campo.startsWith(`${campo}.`) || pendencia.campo.startsWith(`${campo}:`));
}

export function DetalhesNexa({ titulo, aberto = false, campo, children }: { titulo: string; aberto?: boolean; campo?: string | string[]; children: ReactNode }) {
  const pendencias = useContext(PendenciasNexaContext);
  const campos = campo ? Array.isArray(campo) ? campo : [campo] : [];
  const temErro = pendencias.some(p => correspondeAoCampo(p, campos));
  return <details open={aberto || temErro} className="group rounded-xl border border-panel-line bg-panel-bg/40 p-3 sm:p-4"><summary className="cursor-pointer text-sm font-medium text-panel-ink marker:text-panel-sub">{titulo}</summary><div className="mt-4 space-y-4">{children}</div></details>;
}

export function AvisoCampoNexa({ campo }: { campo: string | string[] }) {
  const pendencias = useContext(PendenciasNexaContext);
  const campos = Array.isArray(campo) ? campo : [campo];
  const falha = pendencias.find(p => correspondeAoCampo(p, campos));
  return falha ? <p className="text-xs leading-relaxed text-red-700" role="alert">{falha.mensagem}</p> : null;
}

export function CartaoNexa({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-panel-line bg-panel-card p-4 shadow-sm sm:p-6"><h3 className="text-base font-semibold text-panel-ink">{titulo}</h3>{descricao && <p className="mt-1 text-sm leading-relaxed text-panel-sub">{descricao}</p>}<div className="mt-5 space-y-4">{children}</div></section>;
}
export function CampoNexa({ titulo, dica, campo, children }: { titulo: string; dica?: string; campo?: string | string[]; children: ReactNode }) {
  const pendencias = useContext(PendenciasNexaContext);
  const id = useId();
  const caminhos = campo ? Array.isArray(campo) ? campo : [campo] : [];
  const falha = pendencias.find(p => correspondeAoCampo(p, caminhos));
  return <label data-campo={caminhos[0]} className="block min-w-0 space-y-1.5"><span className="block text-sm font-medium text-panel-ink">{titulo}</span>{Children.map(children, child => isValidElement(child) && typeof child.type === "string" ? cloneElement(child as ReactElement<Record<string, unknown>>, { "aria-invalid": falha ? true : undefined, "aria-describedby": falha ? id : undefined }) : child)}{dica && <span className="block text-xs leading-relaxed text-panel-sub">{dica}</span>}{falha && <span id={id} className="block text-xs leading-relaxed text-red-700">{falha.mensagem}</span>}</label>;
}
export function SituacaoNexa({ valor }: { valor: SituacaoInformacao }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${valor === "CONFIRMADO" ? "bg-emerald-500/10 text-emerald-700" : valor === "REVISAR" ? "bg-amber/15 text-panel-ink" : "bg-panel-bg text-panel-sub"}`}>{SITUACOES_NEXA[valor]}</span>;
}
export function SeletorSituacaoNexa({ titulo, valor, mudar }: { titulo: string; valor: SituacaoInformacao; mudar: (v: SituacaoInformacao) => void }) {
  return <select aria-label={titulo} className={CAMPO_NEXA} value={valor} onChange={e => mudar(e.target.value as SituacaoInformacao)}>{Object.entries(SITUACOES_NEXA).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>;
}
export function RevisaoNexa({ titulo, valor, mudar, confirmavel = true }: { titulo: string; valor: SituacaoInformacao; mudar: (v: SituacaoInformacao) => void; confirmavel?: boolean }) {
  return <div className="space-y-3">{valor === "REVISAR" ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber/10 p-3"><span className="text-xs leading-relaxed text-panel-ink">Confira antes de usar no atendimento.</span><button type="button" className={BOTAO_NEXA} disabled={!confirmavel} aria-label={`Confirmar informação: ${titulo}`} onClick={() => mudar("CONFIRMADO")}>Confirmar informação</button></div> : valor === "NAO_APLICA" && <SituacaoNexa valor={valor} />}<details className="text-xs text-panel-sub"><summary className="w-fit cursor-pointer py-1">Outras opções</summary><div className="mt-2 max-w-sm space-y-1.5"><p>Indique se esta informação já pode ser usada.</p><SeletorSituacaoNexa titulo={`Situação: ${titulo}`} valor={valor} mudar={mudar} /></div></details></div>;
}
export function EscolhaNexa<T extends string>({ titulo, valor, opcoes, mudar }: { titulo: string; valor: T; opcoes: { valor: T; titulo: string; descricao: string }[]; mudar: (v: T) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-medium text-panel-ink">{titulo}</legend><div className="grid gap-2">{opcoes.map(o => <label key={o.valor} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${valor === o.valor ? "border-amber bg-amber/10" : "border-panel-line hover:border-amber/50"}`}><input type="radio" checked={valor === o.valor} onChange={() => mudar(o.valor)} className="mt-1 accent-amber" name={titulo} /><span><span className="block text-sm font-semibold text-panel-ink">{o.titulo}</span><span className="mt-0.5 block text-xs leading-relaxed text-panel-sub">{o.descricao}</span></span></label>)}</div></fieldset>;
}
export function InformacaoNexaCampo({ titulo, dica, campo, valor, mudar, multiline = false }: { titulo: string; dica?: string; campo?: string; valor: InformacaoNexa; mudar: (v: InformacaoNexa) => void; multiline?: boolean }) {
  const alterar = (texto: string) => mudar({ valor: texto, situacao: texto.trim() ? valor.situacao === "REVISAR" ? "REVISAR" : "CONFIRMADO" : "NAO_INFORMADO", origem: "MANUAL" });
  return <div className="space-y-2"><CampoNexa titulo={titulo} dica={dica} campo={campo}>{multiline ? <textarea aria-label={titulo} rows={3} maxLength={3000} className={CAMPO_NEXA} value={valor.valor} onChange={e => alterar(e.target.value)} /> : <input aria-label={titulo} maxLength={3000} className={CAMPO_NEXA} value={valor.valor} onChange={e => alterar(e.target.value)} />}</CampoNexa><RevisaoNexa titulo={titulo} valor={valor.situacao} confirmavel={!!valor.valor.trim()} mudar={situacao => mudar({ ...valor, situacao, origem: "MANUAL" })} /></div>;
}
