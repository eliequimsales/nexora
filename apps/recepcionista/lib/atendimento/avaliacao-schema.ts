import { z } from "zod";

export const RESULTADOS_ATENDIMENTO = ["RESOLVIDO_ATENDENTE", "RESOLVIDO_EQUIPE", "PRECISA_CORRIGIR", "ASSUMIDO_EQUIPE", "DESCONHECIDO", "REABERTO"] as const;
export type ResultadoAtendimento = typeof RESULTADOS_ATENDIMENTO[number];
export const ROTULOS_RESULTADO: Record<ResultadoAtendimento, string> = {
  RESOLVIDO_ATENDENTE: "Resolveu sem minha ajuda",
  RESOLVIDO_EQUIPE: "Resolvido pela equipe",
  PRECISA_CORRIGIR: "Precisa corrigir",
  ASSUMIDO_EQUIPE: "Precisei assumir",
  DESCONHECIDO: "Ainda não sei o resultado",
  REABERTO: "Cliente voltou pelo mesmo problema",
};
export const avaliacaoAtendimentoSchema = z.object({
  requestId: z.string().uuid(),
  lastMessageId: z.string().min(1).max(200),
  outcome: z.enum(RESULTADOS_ATENDIMENTO),
  note: z.string().trim().max(2000).default(""),
}).strict().superRefine((v, ctx) => {
  if (v.outcome === "PRECISA_CORRIGIR" && v.note.length < 5) ctx.addIssue({ code: "custom", path: ["note"], message: "Conte o que precisava ser respondido ou feito." });
});

export type ResumoResultados = {
  reviewed: number; resolvedByAttendant: number; resolvedByTeam: number;
  needsCorrection: number; takenOver: number; unknown: number; reopened: number; awaitingReview: number;
};

type RegistroResumido = {
  evaluations: { outcome: string; source: string; anchorMessageId: string }[];
  messages: { id: string }[];
};

/** Contagem de avaliações vigentes. Silêncio, status FINISHED e falas da IA não provam resolução. */
export function resumirResultados(conversas: RegistroResumido[]): ResumoResultados {
  const r: ResumoResultados = { reviewed: 0, resolvedByAttendant: 0, resolvedByTeam: 0, needsCorrection: 0, takenOver: 0, unknown: 0, reopened: 0, awaitingReview: 0 };
  for (const c of conversas) {
    const a = c.evaluations[0];
    if (!a || a.source !== "OWNER" || !(RESULTADOS_ATENDIMENTO as readonly string[]).includes(a.outcome)) { r.awaitingReview++; continue; }
    if (c.messages[0]?.id !== a.anchorMessageId) { r.reopened++; continue; }
    r.reviewed++;
    switch (a.outcome) {
      case "RESOLVIDO_ATENDENTE": r.resolvedByAttendant++; break;
      case "RESOLVIDO_EQUIPE": r.resolvedByTeam++; break;
      case "PRECISA_CORRIGIR": r.needsCorrection++; break;
      case "ASSUMIDO_EQUIPE": r.takenOver++; break;
      case "REABERTO": r.reopened++; break;
      default: r.unknown++;
    }
  }
  return r;
}
