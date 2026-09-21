import { isOpenNow } from "@/lib/ai/prompt";
import type { BusinessHour } from "@/lib/validation";

/**
 * O PORTÃO DO PLANTÃO.
 *
 * Decide se uma mensagem que acabou de chegar pode ter resposta automática. Só
 * pode com as três coisas juntas: o dono ligou o Plantão, a agenda diz que a
 * loja está fechada agora, e o dono não respondeu esta conversa pelo celular
 * nas últimas 12 horas. A Fase 1 troca essa janela pela duração do turno.
 *
 * `horarios` vem sempre de `horarioDaEmpresa`, que nunca devolve lista vazia —
 * com lista vazia, `isOpenNow` diria "aberto" e o Plantão nunca atenderia.
 */

export const JANELA_DO_DONO_MS = 12 * 60 * 60 * 1000;

export type Silencio = "DESLIGADO" | "DONO_ASSUMIU" | "ABERTO";
export type DecisaoDoPortao = { responde: true } | { responde: false; motivo: Silencio };

export function portaoDoPlantao(ctx: {
  plantaoAtivo: boolean;
  horarios: BusinessHour[];
  donoAssumiuEm: Date | null;
  agora: Date;
}): DecisaoDoPortao {
  if (!ctx.plantaoAtivo) return { responde: false, motivo: "DESLIGADO" };
  if (ctx.donoAssumiuEm && ctx.agora.getTime() - ctx.donoAssumiuEm.getTime() < JANELA_DO_DONO_MS) {
    return { responde: false, motivo: "DONO_ASSUMIU" };
  }
  if (isOpenNow(ctx.horarios, ctx.agora)) return { responde: false, motivo: "ABERTO" };
  return { responde: true };
}
