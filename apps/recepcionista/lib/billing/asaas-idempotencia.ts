/**
 * IDEMPOTÊNCIA DOS EVENTOS DO ASAAS.
 *
 * O Asaas reenvia eventos em caso de lentidão ou falha de rede.
 * Sem controle transacional atômico, múltiplas requisições simultâneas
 * poderiam duplicar crédito de dias ou concessão de acesso.
 *
 * Seguimos o mesmo padrão CAS com lease e tentativa atômica (Compare-And-Swap):
 * 1. O claim inicial é um create (dispara erro P2002 na chave primária se repetido).
 * 2. Em caso de colisão, tenta CAS com lease de 30s se houver erro anterior ou lease expirado.
 * 3. processedAt só é gravado após a confirmação com sucesso do efeito no banco.
 */

import { prisma } from "@/lib/db";

export type ReivindicacaoAsaas =
  | { ganhou: true; tentativa: number }
  | { ganhou: false; motivo: "ja-processado" | "em-voo" };

function ehColisaoDeChave(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: string }).code === "P2002"
  );
}

export async function reivindicarEventoAsaas(
  eventId: string,
  event: string,
  paymentId?: string,
): Promise<ReivindicacaoAsaas> {
  try {
    await prisma.asaasEvent.create({
      data: { id: eventId, event, paymentId: paymentId ?? null },
    });
    return { ganhou: true, tentativa: 1 };
  } catch (erro) {
    if (!ehColisaoDeChave(erro)) throw erro;

    const agora = new Date();
    const limiteLease = new Date(agora.getTime() - 30_000);

    // Aquisição atômica por Compare-And-Swap (CAS):
    const atualizado = await prisma.asaasEvent.updateMany({
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
      const linha = await prisma.asaasEvent.findUnique({
        where: { id: eventId },
        select: { attempts: true },
      });
      return { ganhou: true, tentativa: linha?.attempts ?? 2 };
    }

    const linha = await prisma.asaasEvent.findUnique({
      where: { id: eventId },
      select: { processedAt: true },
    });

    if (linha?.processedAt) return { ganhou: false, motivo: "ja-processado" };

    return { ganhou: false, motivo: "em-voo" };
  }
}

export async function marcarProcessadoAsaas(
  eventId: string,
  companyId: string | null,
  tentativa?: number,
): Promise<void> {
  if (tentativa !== undefined) {
    await prisma.asaasEvent.updateMany({
      where: { id: eventId, attempts: tentativa, processedAt: null },
      data: { processedAt: new Date(), companyId },
    });
  } else {
    await prisma.asaasEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date(), companyId },
    });
  }
}

export async function marcarFalhaAsaas(
  eventId: string,
  erro: unknown,
  tentativa?: number,
): Promise<void> {
  if (tentativa !== undefined) {
    await prisma.asaasEvent.updateMany({
      where: { id: eventId, attempts: tentativa, processedAt: null },
      data: { erro: String(erro).slice(0, 500) },
    });
  } else {
    await prisma.asaasEvent.update({
      where: { id: eventId },
      data: { erro: String(erro).slice(0, 500) },
    });
  }
}
