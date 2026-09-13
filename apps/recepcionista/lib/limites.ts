import { NextResponse } from "next/server";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

/**
 * TETOS DAS ROTAS AUTENTICADAS.
 *
 * Sessão válida não é cheque em branco. A auditoria encontrou catorze rotas
 * autenticadas sem limite nenhum, e três classes de dano saem daí:
 *
 *   DINHEIRO — training/teach e training/interview chamam a IA. Sem teto, uma
 *   conta (ou uma sessão roubada) queima crédito em looping, e a conta chega
 *   no fim do mês.
 *
 *   DADO — dados/exportar despeja a base inteira num CSV. Um cookie roubado
 *   extrai tudo em segundos, e repetidamente, sem deixar rastro de anomalia.
 *
 *   CPU — onda e reports varrem toda a base e recalculam o ciclo pessoal de
 *   cada cliente. É a operação mais cara do produto.
 *
 * O teto é por EMPRESA e não por IP: o gargalo é o custo que a CONTA gera, e o
 * IP de um dono legítimo muda quando ele sai do wi-fi para o 4G.
 *
 * Continua sendo janela fixa em memória, por processo. Com mais de uma
 * instância o teto efetivo multiplica pelo número de instâncias — o que ainda
 * é infinitamente melhor do que teto nenhum. Trocar por contador no Postgres é
 * o passo seguinte, quando houver mais de uma instância.
 */

export type Politica = { limit: number; windowMs: number };

const MIN = 60_000;

export const LIMITES = {
  /** Leitura de tela do painel: generoso, o dono navega. */
  leitura: { limit: 120, windowMs: 5 * MIN },

  /** Escrita comum de configuração e treino. */
  escrita: { limit: 60, windowMs: 5 * MIN },

  /** Chamada de IA: cada uma custa dinheiro de verdade. */
  ia: { limit: 20, windowMs: 10 * MIN },

  /** Dump da base inteira. Uso legítimo é raro; abuso é o caso comum. */
  exportar: { limit: 8, windowMs: 10 * MIN },

  /** Varredura completa da base com recálculo de ciclo. */
  pesado: { limit: 30, windowMs: 10 * MIN },

  /** Cria sessão na Stripe — chamada a terceiro, com custo e limite deles. */
  terceiro: { limit: 10, windowMs: 10 * MIN },

  /** Webhook autenticado por token: alto, mas não infinito. */
  webhook: { limit: 600, windowMs: MIN },
} satisfies Record<string, Politica>;

/**
 * Aplica um teto. Devolve false quando estourou.
 *
 * O escopo entra na chave para que exportar e ler relatório não dividam o
 * mesmo balde — senão navegar no painel gastaria a cota de exportação.
 */
export function limitar(escopo: string, chave: string, politica: Politica): boolean {
  return rateLimit(`${escopo}:${chave}`, politica);
}

/**
 * A recusa por excesso de tentativas, com `Retry-After`.
 *
 * Sem o cabeçalho, o cliente legítimo não tem como saber se espera dez segundos
 * ou dez minutos, e o padrão humano é repetir na hora — o que só empurra a
 * janela para frente e transforma um tropeço em bloqueio prolongado. O valor é
 * o teto da janela: nunca promete liberação antes da hora.
 *
 * Em segundos e como string porque é assim que a RFC 9110 define o cabeçalho.
 */
export function respostaDeLimite(politica: Politica): NextResponse {
  const segundos = Math.max(1, Math.ceil(politica.windowMs / 1000));
  return NextResponse.json(
    { error: TOO_MANY_ATTEMPTS },
    { status: 429, headers: { "Retry-After": String(segundos) } },
  );
}
