import { NextResponse } from "next/server";
import { Prisma } from "@nexora/recepcionista-prisma";
import { pedidoDeLigar } from "@/lib/atendente/entrada";
import { telaDoAtendente } from "@/lib/atendente/tela";
import { getSessionCompanyId } from "@/lib/auth";
import { exigirAcesso } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { validarAtivacaoConfiguracao } from "@/lib/atendente/configuracao";

export const dynamic = "force-dynamic";

/**
 * Ligar e desligar o Atendente no WhatsApp do dono.
 *
 * Ligar confere o WhatsApp ligado (é por ele que o Atendente responde) e o
 * acesso da conta (plano, teste ou a primeira semana por nossa conta).
 * Desligar é sempre possível, sem conferir nada.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ligar", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const parsed = pedidoDeLigar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  try {
    if (!parsed.data.ligar) {
      await prisma.companyProfile.update({ where: { companyId }, data: { plantaoAtivo: false } });
      return NextResponse.json(await telaDoAtendente(companyId));
    }

    const perfil = await prisma.companyProfile.findUnique({
      where: { companyId },
      select: { whatsappStatus: true, whatsappInstance: true, atendenteConfiguracao: true },
    });
    if (!perfil?.whatsappInstance || perfil?.whatsappStatus !== "CONNECTED") {
      return NextResponse.json(
        { error: "Ligue o seu WhatsApp primeiro: é por ele que o Atendente responde.", faltando: "WHATSAPP" },
        { status: 409 },
      );
    }

    const recusa = await exigirAcesso(companyId, "LIGAR_ATENDENTE");
    if (recusa) return recusa;

    const pendencias = await validarAtivacaoConfiguracao(companyId);
    if (pendencias.some((p) => p.bloqueia)) {
      return NextResponse.json({ error: "Revise a configuração antes de ativar o atendimento.", faltando: "CONFIGURACAO", pendencias }, { status: 409 });
    }
    const ativada = await prisma.companyProfile.updateMany({
      where: { companyId, atendenteConfiguracao: { equals: perfil.atendenteConfiguracao ?? Prisma.DbNull } },
      data: { plantaoAtivo: true },
    });
    if (!ativada.count) {
      return NextResponse.json({ error: "A configuração mudou durante a ativação. Recarregue e revise novamente." }, { status: 409 });
    }
    // A primeira semana por nossa conta começa na primeira vez que liga — uma
    // vez só, mesmo com duas abas ou dois cliques.
    await prisma.companyProfile.updateMany({
      where: { companyId, atendenteLigadoPrimeiraVezEm: null },
      data: { atendenteLigadoPrimeiraVezEm: new Date() },
    });

    return NextResponse.json(await telaDoAtendente(companyId));
  } catch (erro) {
    await logError("atendente-ligar", erro, companyId);
    return NextResponse.json({ error: "Não consegui ligar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
