import { prisma } from "@/lib/db";
import { linkDeSuporte } from "@/lib/institucional";
import { FORNECEDOR } from "@/lib/legal/identidade";
import type { EstadoConta } from "./acesso";
import {
  JANELA_DA_PROVA_DIAS,
  ofertaDoAnual,
  type ComoPaga,
  type OfertaDoAnual,
} from "./anual-na-prova";
import { linkDoWhatsAppDeSuporte } from "./implantacao";

const DIA_MS = 86_400_000;

/** A oferta do anual para a conta, ou null. Só quem paga mês a mês chega a ler o banco. */
export async function anualDaEmpresa(
  companyId: string,
  estado: EstadoConta,
  agora = new Date(),
): Promise<OfertaDoAnual | null> {
  if (estado !== "PASSE" && estado !== "ATIVO") return null;

  const [recuperado, ultimoPasse, empresa] = await Promise.all([
    // Só o comprovado, como em todo lugar que mostra Dinheiro recuperado.
    prisma.recoveryEntry.aggregate({
      where: {
        companyId,
        attributed: true,
        returnedAt: { gte: new Date(agora.getTime() - JANELA_DA_PROVA_DIAS * DIA_MS) },
      },
      _sum: { valueCents: true },
    }),
    // O passe que termina por último diz como a conta paga: quem já comprou o
    // anual para depois do Pix não recebe a oferta de novo.
    estado === "PASSE"
      ? prisma.passePago.findFirst({
          where: { companyId, reembolsadoEm: null },
          orderBy: { fim: "desc" },
          select: { plano: true },
        })
      : null,
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);

  const comoPaga: ComoPaga =
    estado === "ATIVO" ? "CARTAO" : ultimoPasse?.plano === "anual" ? "ANUAL" : "PIX_30";
  const suporte =
    linkDoWhatsAppDeSuporte(
      process.env,
      `Oi! Quero trocar a assinatura mensal da Nexora (${empresa?.name ?? "minha conta"}) pelo anual.`,
    ) ?? linkDeSuporte(FORNECEDOR);

  return ofertaDoAnual({
    estado,
    comoPaga,
    recuperado30dCents: recuperado._sum.valueCents ?? 0,
    suporte,
  });
}
