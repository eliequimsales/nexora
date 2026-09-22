/**
 * A IMPLANTAÇÃO — item opcional no pagamento, R$ 97 uma vez.
 *
 * Uma chamada de até 30 minutos, marcada pelo WhatsApp de suporte, para deixar a
 * Nexora funcionando com a lista do dono. Aparece na tela da Stripe como item
 * opcional (`optional_items`), e só quando pode ser cumprida:
 *
 *   - STRIPE_IMPLANTACAO_PRICE_ID configurado (o fundador cria o Price);
 *   - uma por negócio;
 *   - menos de VAGAS_POR_SEMANA vendidas desde segunda 0h em Brasília;
 *   - compra que cobra de verdade: em teste a Stripe não pede cartão.
 *
 * Puro: quem lê o banco e a Stripe é implantacao-da-conta.ts.
 */

type Env = Record<string, string | undefined>;

export const VAGAS_POR_SEMANA = 5;
export const MINUTOS_DA_CHAMADA = 30;
/** Os Termos devolvem a implantação que não acontecer neste prazo por falta de horário da Nexora. */
export const PRAZO_DA_IMPLANTACAO_DIAS = 15;

export const VARIAVEL_DO_PRECO_DA_IMPLANTACAO = "STRIPE_IMPLANTACAO_PRICE_ID";
export const VARIAVEL_DO_WHATSAPP_DE_SUPORTE = "NEXT_PUBLIC_WHATSAPP_SUPORTE";

/** Brasília é UTC−3 o ano inteiro desde 2019, sem horário de verão. */
const FUSO_DE_BRASILIA_MS = 3 * 3_600_000;

/** Segunda-feira 0h em Brasília da semana de `agora`. */
export function inicioDaSemana(agora: Date): Date {
  const local = new Date(agora.getTime() - FUSO_DE_BRASILIA_MS);
  const desdeSegunda = (local.getUTCDay() + 6) % 7;
  const segunda = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - desdeSegunda,
  );
  return new Date(segunda + FUSO_DE_BRASILIA_MS);
}

export function precoDaImplantacao(env: Env): string | null {
  return (env[VARIAVEL_DO_PRECO_DA_IMPLANTACAO] ?? "").trim() || null;
}

/** O Price a oferecer neste checkout, ou null. */
export function implantacaoNoCheckout(p: {
  precoId: string | null;
  jaComprou: boolean;
  vendidasNaSemana: number;
  entraEmTeste: boolean;
}): string | null {
  if (!p.precoId || p.jaComprou || p.entraEmTeste) return null;
  return p.vendidasNaSemana < VAGAS_POR_SEMANA ? p.precoId : null;
}

/** A sessão paga trouxe a implantação? O valor cobrado por ela, ou null. */
export function implantacaoDaSessao(
  itens: { price?: { id: string } | null; amount_total: number }[],
  precoId: string | null,
): number | null {
  if (!precoId) return null;
  const item = itens.find((i) => i.price?.id === precoId);
  return item ? item.amount_total : null;
}

/**
 * O WhatsApp de suporte com a mensagem pronta, ou null. Aceita o número ou o link
 * wa.me: os dígitos são os mesmos. Lido no servidor, na hora de montar a tela —
 * o build do Docker não enxerga as variáveis do serviço.
 */
export function linkDoWhatsAppDeSuporte(env: Env, texto: string): string | null {
  const numero = (env[VARIAVEL_DO_WHATSAPP_DE_SUPORTE] ?? "").replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(numero)) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
