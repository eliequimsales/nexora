import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { montarOndaDaSemana } from "@/lib/recuperacao/servico";

export const dynamic = "force-dynamic";

/**
 * A ONDA DE SEGUNDA — 12 clientes, ~9 minutos de copiar e colar.
 *
 * GET  devolve a onda da semana com o porquê auditável e a mensagem pronta.
 * POST marca o resultado de um contato. A marcação é o "investimento" do loop:
 *      alimenta o Livro-Caixa, agenda o próximo toque e limpa a fila seguinte —
 *      e o sistema DIZ na hora o que melhorou, senão vira formulário.
 */

const marcarSchema = z.object({
  clienteId: z.string().min(1),
  toque: z.number().int().min(1).max(4),
  esteira: z.enum(["PRE_ATRASO", "ATRASO", "RESGATE"]),
  resultado: z.enum(["VOLTOU", "MARCOU", "RESPONDEU", "SEM_RESPOSTA", "PULADO"]),
  valorCents: z.number().int().min(0).optional(),
  motivoPulo: z
    .enum(["MUDOU_CIDADE", "NAO_E_CLIENTE", "FALECEU", "EVENTO", "OUTRO"])
    .optional(),
});

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const onda = await montarOndaDaSemana(companyId);
    return NextResponse.json(onda);
  } catch (error) {
    await logError("onda-get", error, companyId);
    return NextResponse.json({ error: "Não consegui montar a onda agora" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const parsed = marcarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }
    const { clienteId, toque, esteira, resultado, valorCents, motivoPulo } = parsed.data;

    const cliente = await prisma.customer.findFirst({
      where: { id: clienteId, companyId },
      select: {
        id: true,
        visits: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      },
    });
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    await prisma.recoveryTouch.create({
      data: {
        companyId,
        customerId: clienteId,
        touchNumber: toque,
        esteira,
        outcome: resultado,
        outcomeAt: new Date(),
        skipReason: motivoPulo ?? "",
      },
    });

    // Pulou por "não é mais cliente"? Sai da fila de vez — a próxima onda fica
    // mais limpa, e isso é dito ao dono na resposta.
    if (resultado === "PULADO" && motivoPulo && motivoPulo !== "OUTRO") {
      await prisma.customer.update({
        where: { id: clienteId },
        data: { optOut: true, optOutAt: new Date() },
      });
    }

    // Só entra no Livro-Caixa o que voltou COM valor marcado pela mão do dono.
    // Nada é inferido: inflar o extrato é a forma mais rápida de perder o cliente.
    let entradaCriada = false;
    if (resultado === "VOLTOU" && typeof valorCents === "number" && valorCents > 0) {
      const ultima = cliente.visits[0]?.occurredAt ?? null;
      const diasAway = ultima
        ? Math.floor((Date.now() - ultima.getTime()) / (24 * 60 * 60 * 1000))
        : 0;

      await prisma.recoveryEntry.create({
        data: {
          companyId,
          customerId: clienteId,
          valueCents: valorCents,
          daysAway: diasAway,
          esteira,
          touchNumber: toque,
        },
      });
      await prisma.visit.create({
        data: { customerId: clienteId, occurredAt: new Date(), valueCents: valorCents },
      });
      entradaCriada = true;
    }

    return NextResponse.json({
      ok: true,
      entrouNoLivroCaixa: entradaCriada,
      // A devolução do investimento, em texto, na hora.
      efeito:
        resultado === "PULADO"
          ? "Ele sai da fila de vez. Sua próxima onda fica mais limpa."
          : resultado === "SEM_RESPOSTA"
            ? toque < 4
              ? `Anotado. O toque ${toque + 1} entra na frente da próxima onda.`
              : "Sequência encerrada. Ele não recebe mais mensagem automática."
            : entradaCriada
              ? "Anotado no Livro-Caixa. Esse número só sobe quando o dinheiro entra."
              : "Anotado. Ele sai da sequência.",
    });
  } catch (error) {
    await logError("onda-marcar", error, companyId);
    return NextResponse.json({ error: "Não consegui marcar agora" }, { status: 500 });
  }
}
