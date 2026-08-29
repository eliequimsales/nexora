/**
 * Leitores do payload da Stripe. Puros de propósito: são exatamente os pontos
 * onde a forma do objeto mudou entre versões da API e onde ler o campo errado
 * grava lixo em silêncio.
 */

/**
 * Eventos que este endpoint assina. A lista é curta por recomendação explícita
 * da Stripe: no início do mês tudo renova junto, e endpoint que assina demais
 * vira gargalo justo no pico.
 *
 * `invoice.created` está deliberadamente FORA. Enquanto qualquer endpoint da
 * conta não responde a ele, a Stripe adia a cobrança da CONTA INTEIRA — e esta
 * conta também hospeda o webhook do apps/api.
 */
export const EVENTOS_ASSINADOS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type EventoAssinado = (typeof EVENTOS_ASSINADOS)[number];

type ComItens = {
  items?: { data?: { current_period_end?: number | null }[] };
};

/**
 * Fim do período vigente.
 *
 * O campo NÃO existe mais na raiz do Subscription — vive em `items.data[]`.
 * Ler da raiz devolve undefined, `new Date(undefined * 1000)` vira Invalid
 * Date, e toda a resposta de "até quando esse cliente tem acesso" passa a
 * mentir. É o bug que o billing.service.ts do apps/api tem hoje, escondido
 * atrás de um apiVersion de 2024.
 */
export function periodoFimDe(sub: ComItens): Date | null {
  const seg = sub?.items?.data?.[0]?.current_period_end;
    return typeof seg === "number" && Number.isFinite(seg) ? new Date(seg * 1000) : null;
}

/**
 * A Checkout Session liberou acesso?
 *
 * O enum tem TRÊS valores: paid | unpaid | no_payment_required. Testar
 * `=== "paid"` deixa de fora o `no_payment_required`, que é justamente o que
 * chega num trial sem cartão ou num cupom de 100% — a promoção óbvia de um
 * produto vendido como "risco zero". Por isso o teste é pela negativa.
 */
export function deveProvisionar(session: { payment_status?: string | null }): boolean {
  return session?.payment_status !== "unpaid";
}

/**
 * De quem é este evento.
 *
 * Devolve null quando o evento pertence ao outro produto hospedado na MESMA
 * conta Stripe (o apps/api marca com `orgId`). Nesse caso a resposta correta é
 * 200 — responder 500 põe a Stripe em retry por 3 dias por um evento que nunca
 * foi nosso.
 */
export function companyIdDe(
  // `metadata` da Stripe é `Metadata | null`, e as rotas passam o objeto cru.
  obj: { metadata?: Record<string, string> | null } | null | undefined,
): string | null {
  const id = obj?.metadata?.companyId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
