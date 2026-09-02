import { getSessionCompanyId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientesParaCsv } from "@/lib/dados/exportar";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * PORTABILIDADE E ACESSO — LGPD art. 18, II e V.
 *
 * Os Termos prometiam isto em dois pontos ("seus dados continuam acessíveis
 * para leitura e exportação", "você tem 15 dias para exportar seus dados")
 * antes de a rota existir. Agora existe.
 *
 * Sem `exigirAcesso` de propósito: pegar de volta o que é seu não pode
 * depender de a assinatura estar em dia. Bloquear a exportação de quem parou
 * de pagar é reter dado alheio como alavanca de cobrança, e é justamente o que
 * o art. 18 impede. O que a inadimplência trava é ENVIAR onda nova, não LER.
 */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("exportar", companyId, LIMITES.exportar)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const clientes = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: {
        name: true,
        phone: true,
        source: true,
        optOut: true,
        optOutAt: true,
        notes: true,
        createdAt: true,
        visits: {
          select: { occurredAt: true, valueCents: true, service: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });

    const csv = clientesParaCsv(
      clientes.map((c) => ({
        nome: c.name,
        telefone: c.phone,
        origem: c.source,
        optOut: c.optOut,
        optOutAt: c.optOutAt,
        observacoes: c.notes,
        criadoEm: c.createdAt,
        visitas: c.visits.map((v) => ({
          data: v.occurredAt,
          valorCents: v.valueCents,
          servico: v.service,
        })),
      })),
    );

    const hoje = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        // charset=utf-8 junto do BOM: um resolve o navegador, o outro resolve
        // o Excel. Faltando qualquer um dos dois, acento quebra.
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexora-clientes-${hoje}.csv"`,
        // Base de clientes não entra em cache de proxy nenhum.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await logError("exportar-dados", error, companyId);
    return NextResponse.json({ error: "Não consegui gerar a exportação agora" }, { status: 500 });
  }
}
