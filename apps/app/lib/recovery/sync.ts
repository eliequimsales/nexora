/**
 * Sync do tracking local com o backend — modelo local-first.
 *
 * O localStorage continua sendo a fonte imediata de verdade: a UI já mudou
 * antes daqui. Esta chamada é oportunista e silenciosa; se falhar, o registro
 * local permanece intacto e o usuário não vê nada.
 *
 * Usa o `apiClient` (mesmo axios do resto do app) em vez de fetch cru porque
 * ele injeta o Bearer token e o prefixo /api/v1 — sem isso o endpoint responde
 * 401/404 e o sync falharia sempre, em silêncio.
 */

import { apiClient } from '@/lib/api/client';

/** Limites do ConfirmRecoveryDto no backend (@Min 0.01 / @Max 10000). */
const MIN_VALUE = 0.01;
const MAX_VALUE = 10_000;

/**
 * Confirma no servidor que o cliente voltou e pagou.
 * Alimenta o KPI "Receita Recuperada" — o número comprovável, compartilhado
 * pela equipe e independente deste navegador.
 *
 * Lança em falha; quem chama decide o que fazer (hoje: apenas loga).
 */
export async function confirmRecoveryOnServer(
  clientId: string,
  value: number,
): Promise<void> {
  if (!Number.isFinite(value) || value < MIN_VALUE || value > MAX_VALUE) {
    // Fora da faixa aceita pelo backend — não gasta requisição pra tomar 400.
    throw new Error(`valor fora da faixa aceita: ${value}`);
  }

  // O DTO espera { value }, não { recoveredValue } — e a API roda com
  // forbidNonWhitelisted, então um campo com outro nome retorna 400.
  await apiClient.post(`/leads/${clientId}/confirm-recovery`, {
    value: Math.round(value * 100) / 100,
  });
}
