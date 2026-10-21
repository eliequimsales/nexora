import type { TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";

export type FalhaConfiguracaoNexa = Error & { pendencias?: TelaConfiguracaoNexa["pendencias"] };
export type OperarConfiguracaoNexa = <T>(acao: () => Promise<T>) => Promise<T | null>;

export async function requisitarConfiguracaoNexa<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    const erro = new Error(j?.error || "Não foi possível concluir. Tente novamente.") as FalhaConfiguracaoNexa;
    erro.pendencias = j?.pendencias;
    throw erro;
  }
  return j;
}
