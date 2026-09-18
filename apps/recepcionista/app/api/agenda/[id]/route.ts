import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { atualizarStatusAgendamento, removerAgendamento } from "@/lib/agenda/painel";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["MARCADO", "CONFIRMADO", "ATENDIDO", "CANCELADO", "FALTOU"]),
  valorCents: z.number().int().nonnegative().optional(),
  servicoNome: z.string().trim().optional(),
});

/**
 * PATCH /api/agenda/[id]
 * Atualiza status (ex: ATENDIDO conclui a visita e ativa o monitoramento de retorno).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-patch", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const resultado = await atualizarStatusAgendamento(companyId, params.id, parsed.data);

    let mensagem = "Status atualizado.";
    if (parsed.data.status === "ATENDIDO") {
      mensagem = "Atendimento concluído! Visita registrada no histórico e cliente monitorado pela Nexora.";
    } else if (parsed.data.status === "CONFIRMADO") {
      mensagem = "Horário confirmado com o cliente.";
    } else if (parsed.data.status === "CANCELADO") {
      mensagem = "Agendamento cancelado.";
    } else if (parsed.data.status === "FALTOU") {
      mensagem = "Falta registrada. O cliente continua no radar da Nexora.";
    }

    return NextResponse.json({ ok: true, mensagem, resultado });
  } catch (error) {
    await logError("agenda-patch", error, companyId);
    return NextResponse.json({ error: "Não consegui atualizar o agendamento" }, { status: 500 });
  }
}

/**
 * DELETE /api/agenda/[id]
 * Cancela/remove o agendamento.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-delete", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    await removerAgendamento(companyId, params.id);
    return NextResponse.json({ ok: true, mensagem: "Agendamento removido da agenda." });
  } catch (error) {
    await logError("agenda-delete", error, companyId);
    return NextResponse.json({ error: "Não consegui remover o agendamento" }, { status: 500 });
  }
}
