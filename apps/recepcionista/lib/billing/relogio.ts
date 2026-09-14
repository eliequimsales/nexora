import { TRIAL_DIAS } from "./acesso";

/**
 * O RELÓGIO DO TESTE GRÁTIS.
 *
 * Os Termos prometem "os primeiros 30 dias". Até 14/09/2026 o código cumpria só
 * metade: o prazo era gravado apenas pela Stripe, então quem nunca abria o
 * checkout ficava em teste para sempre — e quem abria depois de usar o mês
 * ganhava outro, contado do clique e não do cadastro.
 *
 * Tudo aqui é puro, com `agora` injetado. Quem grava é o cadastro e
 * `garantirRelogio`, em relogio-da-conta.ts.
 */

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

/**
 * Dias de aviso para quem já tinha conta quando o relógio passou a valer.
 * Ninguém trava no mesmo dia em que descobre que existe prazo, e o aviso de
 * três dias do motor de reengajamento cabe dentro destes sete.
 */
export const AVISO_DO_RELOGIO_DIAS = 7;

/** A Stripe recusa `trial_end` a menos de 48 horas; uma hora de folga evita a borda. */
const MINIMO_TRIAL_NA_STRIPE_MS = 49 * HORA_MS;

/**
 * Até quando vale o teste de uma conta que ainda não tem prazo.
 *
 * Conta nova: cadastro + TRIAL_DIAS, que é o que os Termos prometem. Conta
 * antiga: nunca menos que o aviso a partir de agora.
 */
export function fimDoTesteSemRelogio(criadoEm: Date, agora: Date): Date {
  const pelaPromessa = criadoEm.getTime() + TRIAL_DIAS * DIA_MS;
  const peloAviso = agora.getTime() + AVISO_DO_RELOGIO_DIAS * DIA_MS;
  return new Date(Math.max(pelaPromessa, peloAviso));
}

/**
 * O prazo a gravar, ou null quando não há o que gravar.
 *
 * Conta com assinatura na Stripe fica de fora: ali o escritor único de
 * `trialEndsAt` é converger.ts, e um relógio local seria um segundo escritor
 * no mesmo campo.
 */
export function relogioParaGravar(
  empresa: { subscriptionStatus: string | null; trialEndsAt: Date | null; createdAt: Date },
  agora: Date,
): Date | null {
  const temAssinatura = empresa.subscriptionStatus !== null && empresa.subscriptionStatus !== undefined;
  if (temAssinatura || empresa.trialEndsAt) return null;
  return fimDoTesteSemRelogio(empresa.createdAt, agora);
}

/**
 * `subscription_data.trial_end` do checkout, em segundos Unix — ou null quando
 * o teste já acabou (ou nunca existiu) e assinar deve cobrar na hora.
 *
 * O trial da Stripe termina no MESMO dia do relógio da conta. Faltando menos
 * que o mínimo da Stripe, o fim vai para o mínimo: o dono ganha no máximo
 * essas horas, e nunca perde as que ainda tinha.
 */
export function fimDoTrialNoCheckout(trialEndsAt: Date | null, agora: Date): number | null {
  if (!trialEndsAt || trialEndsAt.getTime() <= agora.getTime()) return null;
  const fim = Math.max(trialEndsAt.getTime(), agora.getTime() + MINIMO_TRIAL_NA_STRIPE_MS);
  return Math.floor(fim / 1000);
}
