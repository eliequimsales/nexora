import { isOpenNow } from "@/lib/ai/prompt";
import type { EstadoConta } from "@/lib/billing/acesso";
import type { BusinessHour } from "@/lib/validation";
import {
  JANELA_DO_DONO_MS,
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "./constantes";
import { localDe } from "./datas";

/**
 * O PORTÃO DO ATENDENTE VIRTUAL.
 *
 * Duas perguntas, as duas puras e com o "agora" injetado:
 *
 * 1. A conta tem direito ao Atendente agora? No plano, incluído até o teto de
 *    conversas do mês. Sem plano, a primeira semana é por nossa conta — sete
 *    dias ou cinquenta conversas desde a primeira vez que ligou.
 *
 * 2. Esta mensagem pode ter resposta agora? Nada responde sem o dono ligar; com
 *    a loja fechada, responde na hora; com a loja aberta, a mensagem é do dono,
 *    e o Atendente só entra depois de 5 minutos sem resposta — se o dono deixou.
 *    Resposta do dono pelo celular cala o Atendente na conversa por 12 horas.
 *
 * `horarios` vem sempre de `horarioDaEmpresa`, que nunca devolve lista vazia:
 * com lista vazia, `isOpenNow` diria "aberto" e o Atendente nunca atenderia.
 */

export type Acesso = "INCLUIDO" | "TETO" | "SEMANA_GRATIS" | "SEMANA_ACABOU";

const COM_PLANO: EstadoConta[] = ["TRIAL", "ATIVO", "PASSE", "TOLERANCIA", "CANCELADO_COM_ACESSO"];

export function fimDaSemanaGratis(primeiraVezEm: Date): Date {
  return new Date(primeiraVezEm.getTime() + SEMANA_GRATIS_DIAS * 86_400_000);
}

export function acessoDoAtendente(p: {
  estado: EstadoConta;
  primeiraVezEm: Date | null;
  conversasNaSemana: number;
  conversasNoMes: number;
  agora: Date;
}): Acesso {
  if (COM_PLANO.includes(p.estado)) {
    return p.conversasNoMes < TETO_CONVERSAS_MES ? "INCLUIDO" : "TETO";
  }
  // Nunca ligou: a semana começa quando ligar.
  if (!p.primeiraVezEm) return "SEMANA_GRATIS";
  const noPrazo = p.agora.getTime() < fimDaSemanaGratis(p.primeiraVezEm).getTime();
  return noPrazo && p.conversasNaSemana < SEMANA_GRATIS_CONVERSAS ? "SEMANA_GRATIS" : "SEMANA_ACABOU";
}

export function podeLigar(acesso: Acesso): boolean {
  return acesso !== "SEMANA_ACABOU";
}

/** O avesso do horário da agenda, mais os dias fechados pelo botão "Fechar hoje". */
export function lojaFechada(p: { horarios: BusinessHour[]; diasFechados: string[]; agora: Date }): boolean {
  if (p.diasFechados.includes(localDe(p.agora).data)) return true;
  return !isOpenNow(p.horarios, p.agora);
}

export type Silencio =
  | "DESLIGADO"
  | "DONO_ASSUMIU"
  | "SEM_PLANO"
  | "JA_RESPONDIDA"
  | "ABERTO"
  | "CEDO_DEMAIS";

export type Quando = { acao: "RESPONDER" } | { acao: "ESPERAR" } | { acao: "SILENCIO"; motivo: Silencio };

const silencio = (motivo: Silencio): Quando => ({ acao: "SILENCIO", motivo });

export function decidirQuando(p: {
  ligado: boolean;
  acesso: Acesso;
  horarios: BusinessHour[];
  diasFechados: string[];
  /** O dono deixou o Atendente entrar no expediente quando ninguém responde. */
  expediente: boolean;
  donoAssumiuEm: Date | null;
  /** A hora da mensagem do cliente sobre a qual se decide. */
  ultimaDoClienteEm: Date;
  /** Alguém (o dono ou o Atendente) já respondeu depois dela. */
  respondidaDepois: boolean;
  agora: Date;
  /** WEBHOOK: a mensagem acabou de chegar. RESGATE: a rodada de cada minuto. */
  origem: "WEBHOOK" | "RESGATE";
}): Quando {
  if (!p.ligado) return silencio("DESLIGADO");
  if (p.donoAssumiuEm && p.agora.getTime() - p.donoAssumiuEm.getTime() < JANELA_DO_DONO_MS) {
    return silencio("DONO_ASSUMIU");
  }
  if (p.acesso === "SEMANA_ACABOU") return silencio("SEM_PLANO");
  if (p.origem === "RESGATE" && p.respondidaDepois) return silencio("JA_RESPONDIDA");

  if (lojaFechada({ horarios: p.horarios, diasFechados: p.diasFechados, agora: p.agora })) {
    return { acao: "RESPONDER" };
  }

  if (!p.expediente) return silencio("ABERTO");
  if (p.origem === "WEBHOOK") return { acao: "ESPERAR" };

  const esperou = p.agora.getTime() - p.ultimaDoClienteEm.getTime() >= MINUTOS_SEM_RESPOSTA * 60_000;
  return esperou ? { acao: "RESPONDER" } : silencio("CEDO_DEMAIS");
}
