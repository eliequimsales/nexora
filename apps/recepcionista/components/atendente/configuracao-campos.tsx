"use client";

import { Children, cloneElement, createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode } from "react";
import type { InformacaoNexa, PendenciaNexa, SituacaoInformacao } from "@/lib/atendente/configuracao-schema";

export const PendenciasNexaContext = createContext<PendenciaNexa[]>([]);

export const CAMPO_NEXA = "w-full min-w-0 rounded-lg border border-panel-line bg-panel-card px-3 py-2.5 text-sm text-panel-ink outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/20 disabled:opacity-60";
export const BOTAO_NEXA = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-panel-line bg-panel-card px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber/60 disabled:cursor-not-allowed disabled:opacity-50";
export const PRINCIPAL_NEXA = `${BOTAO_NEXA} !border-amber !bg-amber !text-night hover:!bg-amber/85`;
export const SITUACOES_NEXA: Record<SituacaoInformacao, string> = { CONFIRMADO: "Confirmado", REVISAR: "Confira esta informação", NAO_INFORMADO: "Não informado", NAO_APLICA: "Não se aplica" };

function correspondeAoCampo(pendencia: PendenciaNexa, campos: string[]) {
  return campos.some(campo => pendencia.campo === campo || pendencia.campo.startsWith(`${campo}.`) || pendencia.campo.startsWith(`${campo}:`));
}

export function DetalhesNexa({ titulo, descricao, aberto = false, campo, children }: { titulo: string; descricao?: string; aberto?: boolean; campo?: string | string[]; children: ReactNode }) {
  const pendencias = useContext(PendenciasNexaContext);
  const campos = campo ? Array.isArray(campo) ? campo : [campo] : [];
  const temErro = pendencias.some(p => correspondeAoCampo(p, campos));
  return <details open={aberto || temErro} className="border-b border-panel-line py-3 last:border-b-0 [&[open]>summary>svg]:rotate-180"><summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-panel-ink [&::-webkit-details-marker]:hidden"><span className="min-w-0 break-words">{titulo}{descricao && <span className="mt-1 block text-xs font-normal leading-relaxed text-panel-sub">{descricao}</span>}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-panel-sub transition-transform"><path d="m6 9 6 6 6-6" /></svg></summary><div className="mt-4 space-y-4 pb-1">{children}</div></details>;
}

export function AvisoCampoNexa({ campo }: { campo: string | string[] }) {
  const pendencias = useContext(PendenciasNexaContext);
  const campos = Array.isArray(campo) ? campo : [campo];
  const falha = pendencias.find(p => correspondeAoCampo(p, campos));
  return falha ? <p className="text-xs leading-relaxed text-red-700" role="alert">{falha.mensagem}</p> : null;
}

export function CartaoNexa({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return <section className="py-1 [&+section]:mt-7 [&+section]:border-t [&+section]:border-panel-line [&+section]:pt-7"><h3 className="text-sm font-semibold text-panel-ink">{titulo}</h3>{descricao && <p className="mt-1 text-sm leading-relaxed text-panel-sub">{descricao}</p>}<div className="mt-4 space-y-4">{children}</div></section>;
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
export function RevisaoNexa({ titulo, valor, mudar, confirmavel = true, confirmarTexto = "Confirmar informação" }: { titulo: string; valor: SituacaoInformacao; mudar: (v: SituacaoInformacao) => void; confirmavel?: boolean; confirmarTexto?: string }) {
  if (valor === "REVISAR") return <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-amber pl-3"><span className="text-xs leading-relaxed text-panel-sub">{confirmavel ? "Confira e confirme para usar no atendimento." : "Preencha os dados antes de confirmar."}</span><button type="button" className={BOTAO_NEXA} disabled={!confirmavel} aria-label={`Confirmar informação: ${titulo}`} onClick={() => mudar("CONFIRMADO")}>{confirmarTexto}</button></div>;
  return null;
}
export function EscolhaNexa<T extends string>({ titulo, valor, opcoes, mudar }: { titulo: string; valor: T; opcoes: { valor: T; titulo: string; descricao: string }[]; mudar: (v: T) => void }) {
  const id = useId();
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-sm font-medium text-panel-ink">{titulo}</label><select id={id} aria-describedby={`${id}-dica`} className={CAMPO_NEXA} value={valor} onChange={e => mudar(e.target.value as T)}>{opcoes.map(o => <option key={o.valor} value={o.valor}>{o.titulo}</option>)}</select><p id={`${id}-dica`} className="text-xs leading-relaxed text-panel-sub">{opcoes.find(o => o.valor === valor)?.descricao}</p></div>;
}
export function InformacaoNexaCampo({ titulo, dica, campo, valor, mudar, multiline = false }: { titulo: string; dica?: string; campo?: string; valor: InformacaoNexa; mudar: (v: InformacaoNexa) => void; multiline?: boolean }) {
  const alterar = (texto: string) => mudar({ valor: texto, situacao: texto.trim() ? valor.situacao === "REVISAR" ? "REVISAR" : "CONFIRMADO" : "NAO_INFORMADO", origem: "MANUAL" });
  return <div className="space-y-2"><CampoNexa titulo={titulo} dica={dica} campo={campo}>{multiline ? <textarea aria-label={titulo} rows={2} maxLength={3000} disabled={valor.situacao === "NAO_APLICA"} className={CAMPO_NEXA} value={valor.valor} onChange={e => alterar(e.target.value)} /> : <input aria-label={titulo} maxLength={3000} disabled={valor.situacao === "NAO_APLICA"} className={CAMPO_NEXA} value={valor.valor} onChange={e => alterar(e.target.value)} />}</CampoNexa>{valor.situacao === "REVISAR" && <RevisaoNexa titulo={titulo} valor={valor.situacao} confirmavel={!!valor.valor.trim()} mudar={situacao => mudar({ ...valor, situacao, origem: "MANUAL" })} />}<label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-xs text-panel-sub"><input type="checkbox" className="accent-amber" checked={valor.situacao === "NAO_APLICA"} onChange={e => mudar({ ...valor, situacao: e.target.checked ? "NAO_APLICA" : valor.valor.trim() ? "REVISAR" : "NAO_INFORMADO", origem: "MANUAL" })} />Não se aplica</label></div>;
}
