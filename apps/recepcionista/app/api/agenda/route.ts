import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import {
  criarAgendamento,
  formatarDataLocal,
  listarAgendamentos,
  listarServicos,
  obterResumoDaAgenda,
} from "@/lib/agenda/painel";

export const dynamic = "force-dynamic";

const agendamentoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente").max(100),
  telefone: z
    .string()
    .trim()
    .transform((t) => t.replace(/\D/g, ""))
    .refine((t) => t.length >= 10 && t.length <= 13, "Telefone inválido"),
  serviceId: z.string().trim().optional().nullable(),
  servicoNome: z.string().trim().max(100).optional().nullable(),
  valorCents: z.number().int().nonnegative().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (formato YYYY-MM-DD)"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido (formato HH:MM)"),
  duracaoMin: z.number().int().positive().max(720).optional(),
  observacoes: z.string().max(500).optional(),
  jaAtendido: z.boolean().optional(),
});

/**
 * GET /api/agenda
 * Retorna os agendamentos e métricas da data solicitada (ou de hoje).
 */
export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-listar", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const dataParam = url.searchParams.get("data");
    const dataSelecionada =
      dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)
        ? dataParam
        : formatarDataLocal(new Date());

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true, name: true },
    });

    const [agendamentos, resumo, servicos] = await Promise.all([
      listarAgendamentos(companyId, { data: dataSelecionada }),
      obterResumoDaAgenda(companyId, dataSelecionada),
      listarServicos(companyId),
    ]);

    const appUrl = process.env.APP_URL || "https://www.meunexora.com.br";
    const linkPublico = empresa?.slug ? `${appUrl}/agendar/${empresa.slug}` : null;

    return NextResponse.json({
      ok: true,
      data: dataSelecionada,
      agendamentos,
      resumo,
      servicos,
      empresaNome: empresa?.name,
      slug: empresa?.slug,
      linkPublico,
    });
  } catch (error) {
    await logError("agenda-get", error, companyId);
    return NextResponse.json({ error: "Não consegui carregar a agenda" }, { status: 500 });
  }
}

/**
 * POST /api/agenda
 * Cria um novo agendamento, auto-cadastrando o cliente caso ele ainda não exista.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-criar", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const json = await request.json();
    const parsed = agendamentoSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados do agendamento inválidos" },
        { status: 400 },
      );
    }

    const agendamento = await criarAgendamento(companyId, parsed.data);

    return NextResponse.json(
      {
        ok: true,
        agendamento,
        mensagem: parsed.data.jaAtendido
          ? "Atendimento registrado e concluído! O valor entrou no seu caixa e o cliente está sob monitoramento."
          : "Horário marcado com sucesso! O cliente foi salvo e está monitorado pela Nexora.",
      },
      { status: 201 },
    );
  } catch (error) {
    await logError("agenda-post", error, companyId);
    return NextResponse.json({ error: "Não consegui agendar o cliente agora" }, { status: 500 });
  }
}
