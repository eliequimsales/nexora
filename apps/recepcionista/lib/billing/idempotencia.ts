/**
 * IDEMPOTÊNCIA DOS EVENTOS DA STRIPE.
 *
 * A Stripe reenvia eventos e não garante ordem. Sem isto, um retry de
 * `invoice.paid` registra a mesma receita duas vezes — e receita duplicada
 * corrompe justamente a North Star que a empresa vende como prova.
 *
 * Duas decisões aqui são sutis e ambas já custaram bug em outros lugares:
 *
 *   O CLAIM É `create`, NUNCA `upsert`. Só o `create` estoura P2002 na chave
 *   primária, e é essa exceção que torna a reivindicação atômica. `upsert`, por
 *   definição, atualiza em vez de falhar: sob duas entregas simultâneas as duas
 *   passariam, as duas leriam processedAt == null, e as duas processariam —
 *   recriando exatamente a janela que a tabela existe para fechar.
 *
 *   `processedAt` SÓ É GRAVADO DEPOIS DO EFEITO DAR CERTO. Marcar antes perde o
 *   evento para sempre se o handler falhar: a reentrega veria "já processado" e
 *   sairia. Enquanto está em voo, a reentrega recebe 500 de propósito, para a
 *   Stripe tentar de novo mais tarde.
 */

import { prisma } from "@/lib/db";

export type Reivindicacao =
  | { ganhou: true; tentativa: number }
  | { ganhou: false; motivo: "ja-processado" | "em-voo" };

function ehColisaoDeChave(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: string }).code === "P2002"
  );
}

export async function reivindicar(
  eventId: string,
  tipo: string,
): Promise<Reivindicacao> {
  try {
    await prisma.stripeEvent.create({ data: { id: eventId, type: tipo } });
    return { ganhou: true, tentativa: 1 };
  } catch (erro) {
    if (!ehColisaoDeChave(erro)) throw erro;

    const agora = new Date();
    const limiteLease = new Date(agora.getTime() - 30_000);

    // Aquisição atômica por Compare-And-Swap (CAS):
    // Só atualiza se o evento NÃO foi processado E (estava com erro OU o lease expirou).
    // Atualiza atomicamente attempts, renova receivedAt para agora (novo lease) e limpa o erro.
    const atualizado = await prisma.stripeEvent.updateMany({
      where: {
        id: eventId,
        processedAt: null,
        OR: [
          { erro: { not: null } },
          { receivedAt: { lt: limiteLease } },
        ],
      },
      data: {
        attempts: { increment: 1 },
        receivedAt: agora,
        erro: null,
      },
    });

    if (atualizado.count === 1) {
      const linha = await prisma.stripeEvent.findUnique({
        where: { id: eventId },
        select: { attempts: true },
      });
      return { ganhou: true, tentativa: linha?.attempts ?? 2 };
    }

    // Se count === 0, não houve aquisição: ou já foi processado ou está em voo com lease ativo (< 30s)
    const linha = await prisma.stripeEvent.findUnique({
      where: { id: eventId },
      select: { processedAt: true },
    });

    if (linha?.processedAt) return { ganhou: false, motivo: "ja-processado" };

    return { ganhou: false, motivo: "em-voo" };
  }
}

export async function marcarProcessado(
  eventId: string,
  companyId: string | null,
  tentativa?: number,
): Promise<void> {
  if (tentativa !== undefined) {
    await prisma.stripeEvent.updateMany({
      where: { id: eventId, attempts: tentativa, processedAt: null },
      data: { processedAt: new Date(), companyId },
    });
  } else {
    await prisma.stripeEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), companyId },
    });
  }
}

/**
 * Registra a falha SEM marcar como processado, para que a reentrega da Stripe
 * possa tentar de novo. O erro fica gravado para diagnóstico.
 */
export async function marcarFalha(
  eventId: string,
  erro: unknown,
  tentativa?: number,
): Promise<void> {
  if (tentativa !== undefined) {
    await prisma.stripeEvent.updateMany({
      where: { id: eventId, attempts: tentativa, processedAt: null },
      data: { erro: String(erro).slice(0, 500) },
    });
  } else {
    await prisma.stripeEvent.update({
      where: { id: eventId },
      data: { erro: String(erro).slice(0, 500) },
    });
  }
}
