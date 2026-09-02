import { rateLimit } from "@/lib/rate-limit";

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
