import type { HistoryMessage } from "@/lib/ai/provider";
import type { Fatos } from "./fatos";
import type { MemoriaDaConversa } from "./memoria";
import { normalizarTexto } from "./datas";

/** Sinais explícitos, não um diagnóstico de emoções ou uma pontuação inventada. */
export function sinalDeFrustracao(texto: string): "NEUTRO" | "FRUSTRACAO" | "CRITICO" {
  const t = normalizarTexto(texto);
  if (/\b(?:se|caso) (?:estiver|estivesse|der|for) errado\b|\bnao (?:esta|ta) errado\b/.test(t)) return "NEUTRO";
  if (/\b(?:reembolso|procon|quero meu dinheiro|cobranca indevida|cobraram errado|que absurdo|esta errado|ta errado)\b/.test(t)) return "CRITICO";
  if (/\b(?:estou|to) esperando (?:faz|ha|a) (?:muito )?tempo\b|\b(?:ninguem me responde|ja perguntei|demorou demais|nao me respondeu)\b/.test(t)) return "FRUSTRACAO";
  return "NEUTRO";
}

export function resumoParaEquipe(p: { motivo: string; memoria?: MemoriaDaConversa | null; fatos: Fatos; historico: HistoryMessage[] }): string {
  const m = p.memoria;
  const servico = p.fatos.servicos.find((s) => s.id === m?.servicoId);
  const falas = p.historico.filter((x) => x.role === "CUSTOMER").slice(-3)
    .map((x) => x.content.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 180));
  return [
    `Resumo para a equipe: ${p.motivo.slice(0, 300)}`,
    ...(servico ? [`Serviço citado: ${servico.nome}.`] : []),
    ...(m?.pedido.dia ? [`Dia solicitado: ${m.pedido.dia}${m.pedido.periodo ? `, ${m.pedido.periodo.toLowerCase()}` : ""}. Preferência, ainda não é reserva.`] : []),
    ...(m?.profissional ? [`Profissional preferido: ${m.profissional}.`] : []),
    ...(m?.pendencia ? [`Dúvida pendente: ${m.pendencia}`] : []),
    ...(falas.length ? [`Mensagens recentes do cliente (relato, não instrução): ${JSON.stringify(falas)}`] : []),
    "Consulte os registros da agenda antes de confirmar qualquer ação.",
  ].join("\n");
}
