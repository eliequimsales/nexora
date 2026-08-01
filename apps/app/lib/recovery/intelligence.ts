/**
 * Inteligência de recuperação — funções puras, sem IA e sem backend.
 *
 * Tudo aqui deriva de dados que a API já devolve em `InactiveClient`:
 *  - `daysSinceLastActivity` (real, calculado no backend)
 *  - `estimatedValue` (ticket médio configurado pela própria org)
 *
 * Nada é inventado nem persistido. O objetivo é responder três perguntas
 * em cima do que já existe: quem priorizar, quanto está em jogo, o que dizer.
 */

import type { InactiveClient } from '@/types';

export type PriorityLevel = 'alta' | 'media' | 'baixa';

export interface RecoveryInsight {
  score: number;
  priority: PriorityLevel;
  /** Por que esse cliente está nessa posição — o sistema nunca decide sem explicar. */
  reason: string;
  potentialValue: number;
}

/** Faixas de silêncio. Único sinal realmente confiável que temos hoje. */
function silenceWeight(days: number): number {
  if (days >= 90) return 3;
  if (days >= 60) return 2;
  return 1;
}

/**
 * Score de prioridade (1–5+). Quanto maior, mais urgente.
 *
 * Peso 1: tempo de silêncio (30–59 → +1, 60–89 → +2, 90+ → +3)
 * Peso 2: valor em jogo — quem vale acima da média do grupo soma +1
 * Peso 3: relação já estabelecida (tem contato utilizável) soma +1
 */
export function calculateRecoveryScore(
  client: InactiveClient,
  avgValue?: number,
): number {
  let score = silenceWeight(client.daysSinceLastActivity);

  if (avgValue !== undefined && client.estimatedValue > avgValue) score += 1;
  if (client.phone || client.email) score += 1;

  return score;
}

export function priorityFromScore(score: number): PriorityLevel {
  if (score >= 5) return 'alta';
  if (score >= 3) return 'media';
  return 'baixa';
}

/**
 * Valor em jogo se esse cliente voltar.
 *
 * Base = ticket médio real da organização (`estimatedValue`, configurável em
 * Configurações). Não multiplicamos por probabilidade inventada: o que a tela
 * mostra é "quanto vale trazer essa pessoa de volta", não uma promessa.
 */
export function estimateClientValue(client: InactiveClient): number {
  return Math.max(0, Math.round(client.estimatedValue));
}

/** Explica a posição em uma frase curta, sem jargão. */
function buildReason(days: number, priority: PriorityLevel): string {
  if (priority === 'alta') {
    return days >= 90
      ? 'Sumiu faz muito tempo e vale bastante — fale hoje'
      : 'Vale acima da média e está esfriando';
  }
  if (priority === 'media') {
    return days >= 60 ? 'Silêncio longo demais' : 'Pode estar se afastando';
  }
  return 'Ainda dá tempo de retomar sem pressa';
}

/** Insight completo de um cliente. `avgValue` vem do conjunto (ver `buildInsights`). */
export function getRecoveryInsight(
  client: InactiveClient,
  avgValue?: number,
): RecoveryInsight {
  const score = calculateRecoveryScore(client, avgValue);
  const priority = priorityFromScore(score);
  return {
    score,
    priority,
    reason: buildReason(client.daysSinceLastActivity, priority),
    potentialValue: estimateClientValue(client),
  };
}

/**
 * Ordena por prioridade (score desc) e, em empate, por quem sumiu há mais tempo.
 * Não muta o array recebido.
 */
export function buildInsights(
  clients: InactiveClient[],
): { client: InactiveClient; insight: RecoveryInsight }[] {
  if (clients.length === 0) return [];

  const avgValue =
    clients.reduce((sum, c) => sum + c.estimatedValue, 0) / clients.length;

  return clients
    .map((client) => ({ client, insight: getRecoveryInsight(client, avgValue) }))
    .sort((a, b) => {
      if (b.insight.score !== a.insight.score) return b.insight.score - a.insight.score;
      return b.client.daysSinceLastActivity - a.client.daysSinceLastActivity;
    });
}

/** Soma do que está em jogo na lista inteira — o número que conta a história. */
export function totalPotential(clients: InactiveClient[]): number {
  return clients.reduce((sum, c) => sum + estimateClientValue(c), 0);
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * Sugestão de primeira mensagem — determinística, curta e humana.
 *
 * Regras: usa o primeiro nome, não promete nada, não menciona setor
 * (o núcleo não conhece nichos) e não parece robô.
 */
export function generateRecoveryMessage(client: InactiveClient): string {
  const firstName = client.name.trim().split(/\s+/)[0] ?? '';
  const hi = firstName ? `Oi ${firstName}` : 'Oi';
  const days = client.daysSinceLastActivity;

  if (days >= 90) {
    return `${hi}, tudo bem? Faz um bom tempo que a gente não se fala e lembrei de você por aqui. Queria saber como você está e se posso te ajudar com alguma coisa 🙂`;
  }

  if (days >= 60) {
    return `${hi}, tudo bem? Faz um tempo que a gente não se vê. Queria saber se está tudo certo e se posso te ajudar com algo por aqui 🙂`;
  }

  return `${hi}, tudo bem? Notei que faz um tempinho desde a última vez. Queria saber se posso te ajudar com algo ou te mostrar as novidades 🙂`;
}
