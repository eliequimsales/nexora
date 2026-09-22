import { prisma } from "@/lib/db";
import {
  fimDaPrimeiraOnda,
  resultadoDaPrimeiraOnda,
  situacaoDaPrimeiraOnda,
  type ResultadoDaPrimeiraOnda,
  type SituacaoDaPrimeiraOnda,
} from "./primeira-onda";

/**
 * A primeira Onda da conta, lida do banco. A regra mora em primeira-onda.ts.
 */

export type PrimeiraOndaDaConta = {
  situacao: SituacaoDaPrimeiraOnda;
  primeiraOndaEm: Date | null;
  /** Mensagens registradas desde que ela foi gerada, sem os pulados. */
  enviadas: number;
  /** Até quando ela vale; null enquanto não foi gerada. */
  ate: Date | null;
};

export async function primeiraOndaDaEmpresa(
  companyId: string,
  agora = new Date(),
): Promise<PrimeiraOndaDaConta> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { primeiraOndaEm: true },
  });
  const primeiraOndaEm = empresa?.primeiraOndaEm ?? null;
  // Pular quem mudou de cidade não é mandar mensagem: não gasta a Onda grátis.
  const enviadas = primeiraOndaEm
    ? await prisma.recoveryTouch.count({
        where: { companyId, sentAt: { gte: primeiraOndaEm }, outcome: { not: "PULADO" } },
      })
    : 0;

  return {
    situacao: situacaoDaPrimeiraOnda({ primeiraOndaEm, enviadas, agora }),
    primeiraOndaEm,
    enviadas,
    ate: primeiraOndaEm ? fimDaPrimeiraOnda(primeiraOndaEm) : null,
  };
}

/**
 * Começa a primeira Onda, uma vez só. O `primeiraOndaEm: null` no filtro é a
 * reivindicação: duas abas abrindo a Onda no mesmo segundo gravam uma data.
 */
export async function comecarPrimeiraOnda(companyId: string, agora = new Date()): Promise<void> {
  await prisma.company.updateMany({
    where: { id: companyId, primeiraOndaEm: null },
    data: { primeiraOndaEm: agora },
  });
}

/** O que a primeira Onda fez, pelas marcações do dono e pelo Dinheiro recuperado. */
export async function resultadoDaPrimeiraOndaDaEmpresa(
  companyId: string,
  primeiraOndaEm: Date,
): Promise<ResultadoDaPrimeiraOnda> {
  const [toques, recuperado] = await Promise.all([
    prisma.recoveryTouch.findMany({
      where: { companyId, sentAt: { gte: primeiraOndaEm } },
      select: { outcome: true },
    }),
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: true, returnedAt: { gte: primeiraOndaEm } },
      _sum: { valueCents: true },
    }),
  ]);
  return resultadoDaPrimeiraOnda(
    toques.map((t) => t.outcome),
    recuperado._sum.valueCents ?? 0,
  );
}
