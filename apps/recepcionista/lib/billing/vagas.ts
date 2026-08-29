/**
 * Ponte entre a regra de preço (pura) e o banco.
 *
 * A contagem de vagas de fundador é lida do banco toda vez. A escassez que
 * aparece na tela precisa ser a real: "restam 6 vagas" só pode ser exibido se
 * 6 for verdade, senão é publicidade enganosa — e num produto vendido como
 * "risco zero" isso custa exatamente a confiança que sustenta o preço.
 */

import { prisma } from "@/lib/db";
import { PRECO_LISTA_CENTS, precoDaVez, type Preco } from "./preco";

/**
 * Contas que ocupam vaga. `trialing` conta: a assinatura já existe na Stripe
 * com o Price de fundador travado nela. Quem abandona o trial tem a assinatura
 * cancelada, sai desta contagem, e a vaga volta sozinha para a fila.
 */
export async function contarAssinantes(): Promise<number> {
  return prisma.company.count({
    where: { subscriptionStatus: { in: ["active", "trialing", "past_due", "unpaid"] } },
  });
}

export type PrecoAplicado = Preco & { priceId: string };

export function precoAtual(assinantes: number): PrecoAplicado {
  const preco = precoDaVez(assinantes);
  const doFundador = process.env.STRIPE_PRICE_FUNDADOR;
  const daLista = process.env.STRIPE_PRICE_PRO ?? "";

  // Sem o price de fundador configurado, a cohort não abre e cai no preço de
  // lista. Melhor cobrar cheio do que quebrar o checkout por uma variável de
  // campanha ausente.
  if (preco.fundador && doFundador) {
    return { ...preco, priceId: doFundador };
  }

  // O valor exibido tem que ser o valor cobrado. Cair para o price de lista e
  // continuar mostrando R$ 97 seria cobrar um preço e anunciar outro.
  return {
    ...preco,
    fundador: false,
    cents: PRECO_LISTA_CENTS,
    vagasRestantes: 0,
    variavel: "STRIPE_PRICE_PRO",
    priceId: daLista,
  };
}
