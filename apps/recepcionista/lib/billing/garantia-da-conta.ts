import { prisma } from "@/lib/db";
import {
  avaliarGarantia,
  GARANTIA_DIAS,
  pendentesSemResposta,
  recuperadoNaGarantia,
  semanasComOnda,
  type DecisaoDaGarantia,
  type SinaisDaGarantia,
} from "./garantia";

const DIA_MS = 86_400_000;

const SEM_GARANTIA: SinaisDaGarantia = {
  inicio: null,
  acimaDoCorte: false,
  usadaEm: null,
  ondas: 0,
  pendentesSemResposta: 0,
  recuperadoCents: 0,
};

/**
 * Os sinais da garantia lidos do banco.
 *
 * A regra é pura (lib/billing/garantia.ts); aqui só se busca o que ela precisa.
 * A tela de Minha conta e a rota que devolve o dinheiro leem pelo MESMO caminho:
 * as duas não podem discordar sobre quem tem direito.
 */
export async function sinaisDaGarantia(
  companyId: string,
  agora = new Date(),
): Promise<SinaisDaGarantia> {
  const garantia = await prisma.garantia.findUnique({
    where: { companyId },
    select: { inicio: true, acimaDoCorte: true, devolvidaEm: true },
  });
  if (!garantia) return SEM_GARANTIA;

  const fimDaConta = new Date(garantia.inicio.getTime() + GARANTIA_DIAS * DIA_MS);

  const [toques, entradas] = await Promise.all([
    prisma.recoveryTouch.findMany({
      where: { companyId, sentAt: { gte: garantia.inicio, lt: fimDaConta } },
      select: { sentAt: true, outcome: true },
    }),
    prisma.recoveryEntry.findMany({
      where: { companyId, attributed: true, returnedAt: { gte: garantia.inicio, lte: agora } },
      select: { returnedAt: true, valueCents: true, attributed: true },
    }),
  ]);

  return {
    inicio: garantia.inicio,
    acimaDoCorte: garantia.acimaDoCorte,
    usadaEm: garantia.devolvidaEm,
    // Contato pulado não é mensagem enviada.
    ondas: semanasComOnda(
      toques.filter((t) => t.outcome !== "PULADO").map((t) => t.sentAt),
      garantia.inicio,
    ),
    pendentesSemResposta: pendentesSemResposta(toques, garantia.inicio, agora),
    recuperadoCents: recuperadoNaGarantia(entradas, garantia.inicio, agora),
  };
}

export async function garantiaDaEmpresa(
  companyId: string,
  agora = new Date(),
): Promise<{ sinais: SinaisDaGarantia; decisao: DecisaoDaGarantia }> {
  const sinais = await sinaisDaGarantia(companyId, agora);
  return { sinais, decisao: avaliarGarantia(sinais, agora) };
}
