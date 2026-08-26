import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { getTemplatesForSegments, startInterview } from "@/lib/segments";
import { asSegments } from "@/lib/training";
import { interviewSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Inicia a entrevista de integração: os tópicos que a EMPRESA escolheu viram
 * perguntas na fila de treinamento (mesmo ciclo: responder → estruturar → aprovar).
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = interviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Tópicos inválidos" }, { status: 400 });

  try {
    const profile = await prisma.companyProfile.findUniqueOrThrow({
      where: { companyId },
      select: { segments: true },
    });
    const segments = asSegments(profile.segments);
    if (!segments.length) {
      return NextResponse.json(
        { error: "Escolha as áreas de atuação em Meu Atendente primeiro" },
        { status: 400 },
      );
    }

    const combined = await getTemplatesForSegments(segments);
    if (!combined) {
      return NextResponse.json({ error: "Não encontrei o roteiro dessas áreas" }, { status: 404 });
    }

    const chosen = new Set(parsed.data.topics);
    const topics = combined.topics.filter((t) => chosen.has(t.topic));
    if (!topics.length) return NextResponse.json({ error: "Escolha ao menos um assunto" }, { status: 400 });

    const created = await startInterview(companyId, topics);
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    await logError("training-interview", error, companyId);
    return NextResponse.json({ error: "Erro ao iniciar a entrevista" }, { status: 500 });
  }
}
