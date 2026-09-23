import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { gatilhoDaNoiteDaEmpresa } from "@/lib/plantao/noite-da-conta";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/plantao/gatilho
 * Devolve os dados do Gatilho da Noite (Fase 0 do Plantão) para a empresa da sessão.
 */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("plantao-gatilho", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const gatilho = await gatilhoDaNoiteDaEmpresa(companyId);
    return NextResponse.json(gatilho);
  } catch (error) {
    await logError("plantao-gatilho-get", error, companyId);
    return NextResponse.json({ error: "Não foi possível carregar o gatilho da noite" }, { status: 500 });
  }
}

/**
 * POST /api/plantao/gatilho
 * Registra o interesse do cliente na lista de espera do Nexora Completo / Plantão.
 */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("plantao-gatilho-espera", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    // Registra o interesse na lista de espera (Fase 0 do Plantão)
    await prisma.companyProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        serviceRules: "[LISTA_ESPERA_PLANTAO]",
      },
      update: {
        // Se já tiver serviceRules, anexa a tag se não estiver presente
        serviceRules: {
          set: "[LISTA_ESPERA_PLANTAO]",
        },
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Você está na lista de espera do Plantão. Avisaremos assim que liberar!",
    });
  } catch (error) {
    await logError("plantao-gatilho-post", error, companyId);
    return NextResponse.json({ error: "Não foi possível salvar na lista de espera" }, { status: 500 });
  }
}
