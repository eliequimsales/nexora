import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { criarServico, listarServicos } from "@/lib/agenda/painel";

export const dynamic = "force-dynamic";

const servicoSchema = z.object({
  nome: z.string().trim().min(2, "Nome do serviço é obrigatório").max(80),
  duracaoMin: z.number().int().positive().max(720).optional(),
  precoCents: z.number().int().nonnegative().optional(),
});

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const servicos = await listarServicos(companyId);
    return NextResponse.json({ ok: true, servicos });
  } catch (error) {
    await logError("agenda-servicos-get", error, companyId);
    return NextResponse.json({ error: "Não consegui carregar os serviços" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-servicos-criar", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const json = await request.json();
    const parsed = servicoSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const servico = await criarServico(companyId, {
      name: parsed.data.nome,
      durationMin: parsed.data.duracaoMin,
      priceCents: parsed.data.precoCents,
    });

    return NextResponse.json({ ok: true, servico }, { status: 201 });
  } catch (error) {
    await logError("agenda-servicos-post", error, companyId);
    return NextResponse.json({ error: "Não consegui salvar o serviço" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID do serviço não informado" }, { status: 400 });
    }

    await prisma.service.updateMany({
      where: { id, companyId },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("agenda-servicos-delete", error, companyId);
    return NextResponse.json({ error: "Não consegui remover o serviço" }, { status: 500 });
  }
}

