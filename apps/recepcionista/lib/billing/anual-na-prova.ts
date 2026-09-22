import type { EstadoConta } from "./acesso";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "./preco";

/**
 * O ANUAL NO MOMENTO DA PROVA.
 *
 * Aparece para quem paga mês a mês quando o Dinheiro recuperado dos últimos
 * JANELA_DA_PROVA_DIAS dias passa de MENSALIDADES_DA_PROVA mensalidades — o dia
 * em que o anual deixa de ser aposta e vira conta feita com o dinheiro dele.
 *
 * - Pix de 30 dias: pagar o ano. Os 12 meses começam quando os dias pagos acabam
 *   (periodoDoPasse), então pagar agora não custa dia nenhum.
 * - Cartão: a troca é feita com a gente. Uma assinatura cancelada no fim do
 *   período continua ativa, e o passe comprado nesse meio-tempo começaria a
 *   contar na hora — o dono pagaria duas vezes pelos mesmos dias.
 *
 * Pura: quem lê o banco é anual-da-conta.ts.
 */

export const MENSALIDADES_DA_PROVA = 3;
export const JANELA_DA_PROVA_DIAS = 30;

/** Como a conta paga hoje: passe de 30 dias, anual ou assinatura no cartão. */
export type ComoPaga = "CARTAO" | "PIX_30" | "ANUAL" | null;

export type OfertaDoAnual = {
  titulo: string;
  texto: string;
  acao: { texto: string; href: string };
};

export function ofertaDoAnual(p: {
  estado: EstadoConta;
  comoPaga: ComoPaga;
  recuperado30dCents: number;
  /** Onde pedir a troca do cartão: WhatsApp de suporte ou e-mail de atendimento. */
  suporte: string;
}): OfertaDoAnual | null {
  if (p.recuperado30dCents < MENSALIDADES_DA_PROVA * PRECO_MENSAL_CENTS) return null;

  // Para baixo: "3 vezes" só quando já são três inteiras.
  const vezes = Math.floor(p.recuperado30dCents / PRECO_MENSAL_CENTS);
  const economia = 12 * PRECO_MENSAL_CENTS - PRECO_ANUAL_CENTS;
  const titulo =
    `Nos últimos ${JANELA_DA_PROVA_DIAS} dias, a Nexora trouxe ` +
    `${emReais(p.recuperado30dCents)} de volta: ${vezes} vezes a mensalidade.`;
  const conta =
    `No anual, você paga ${emReais(PRECO_ANUAL_CENTS)} por 12 meses — ` +
    `${emReais(economia)} a menos que 12 mensalidades.`;

  if (p.estado === "PASSE" && p.comoPaga === "PIX_30") {
    return {
      titulo,
      texto: `${conta} Os 12 meses começam quando os seus dias pagos acabarem.`,
      acao: { texto: "Pagar o ano", href: "/painel/assinatura" },
    };
  }
  if (p.estado === "ATIVO" && p.comoPaga === "CARTAO") {
    return {
      titulo,
      texto:
        `${conta} Para você não pagar duas vezes pelos mesmos dias, a troca do cartão ` +
        "para o anual é feita com a gente.",
      acao: { texto: "Pedir a troca para o anual", href: p.suporte },
    };
  }
  return null;
}
