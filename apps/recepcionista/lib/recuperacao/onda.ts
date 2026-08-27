/**
 * A ONDA DE SEGUNDA
 *
 * Doze clientes por semana. Não é limitação técnica nem escassez fabricada —
 * são três motivos reais, e todos são ditos ao dono na própria tela:
 *
 *   1. WhatsApp bloqueia número que dispara em massa. Onda pequena é proteção
 *      operacional do número DELE — um cliente banido é desastre irrecuperável.
 *   2. Ele não teria mão para atender 100 pessoas respondendo hoje à tarde.
 *      Mensagem que gera resposta sem atendimento vira cliente irritado.
 *   3. Doze mensagens de copiar e colar levam ~9 minutos. Lista de 137 vira
 *      nada; lista de 12 vira mensagem enviada.
 *
 * Efeito colateral virtuoso: 180 clientes de estoque x 4 toques nao cabem num
 * mes, entao o estoque se distribui naturalmente por meses.
 */

import type { Esteira } from "./esteiras";

export const TAMANHO_DA_ONDA = 12;

export type Candidato = {
  id: string;
  esteira: Esteira;
  /** Dinheiro em jogo em centavos — o que ele já gastou, não o que promete gastar. */
  valorCents: number;
  /** Follow-up do Protocolo 4 Toques que já venceu. Vem na frente de tudo. */
  toqueVencido: boolean;
  confianca: "alta" | "baixa";
};

/**
 * Prioridade das esteiras dentro da onda. Pré-atraso primeiro porque converte
 * mais (sumiço recente volta mais fácil) e porque é a única esteira que impede
 * o estoque de se formar de novo.
 */
const PRIORIDADE: Record<string, number> = {
  PRE_ATRASO: 0,
  ATRASO: 1,
  RESGATE: 2,
  EM_DIA: 99,
};

export function montarOnda<T extends Candidato>(
  candidatos: T[],
  tamanho: number = TAMANHO_DA_ONDA,
): T[] {
  return [...candidatos]
    .filter((c) => c.esteira !== "EM_DIA")
    .sort((a, b) => {
      // 1. Follow-up vencido na frente: não mandar o toque 2 é jogar fora a
      //    maior alavanca disponível (4-5 toques recuperam ~81% a mais).
      if (a.toqueVencido !== b.toqueVencido) return a.toqueVencido ? -1 : 1;

      // 2. Ordem das esteiras.
      const pa = PRIORIDADE[a.esteira] ?? 98;
      const pb = PRIORIDADE[b.esteira] ?? 98;
      if (pa !== pb) return pa - pb;

      // 3. Dinheiro antes de vaidade: dentro da esteira, quem tem mais em jogo.
      if (a.valorCents !== b.valorCents) return b.valorCents - a.valorCents;

      // 4. Empate: confiança alta primeiro, para o dono começar pelo que é sólido.
      if (a.confianca !== b.confianca) return a.confianca === "alta" ? -1 : 1;

      return a.id.localeCompare(b.id);
    })
    .slice(0, tamanho);
}
