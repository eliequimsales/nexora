import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { planejarExclusaoDeCliente } from "@/lib/dados/excluir";
import { prisma } from "@/lib/db";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ELIMINAÇÃO A PEDIDO DO TITULAR — LGPD art. 18, VI.
 *
 * O Contrato de Operador promete executar em até 15 dias. Enquanto isso
 * dependesse de alguém lembrar de rodar DELETE na mão, era intenção, não
 * promessa. Aqui o dono — que é o CONTROLADOR da base dele — executa sozinho.
 *
 * Sem `exigirAcesso`: cumprir direito de titular não pode depender de a
 * assinatura estar em dia. Travar a exclusão de quem parou de pagar
 * transformaria dado de terceiro em alavanca de cobrança.
 *
 * O que este endpoint NÃO faz, e por quê:
 *   - não apaga RecoveryEntry: é o Livro-Caixa do dono, registro financeiro
 *     dele. A pessoa some da entrada (SetNull); o valor fica.
 *   - não some com o opt-out: se a pessoa tinha pedido PARAR, o HMAC do
 *     telefone vai para Supressao, senão ela volta na próxima importação da
 *     mesma planilha e é contatada de novo.
 */

const schema = z
  .object({
    customerId: z.string().min(1).optional(),
    // O caso real é o telefone: a pessoa liga para a barbearia e pede para ser
    // apagada. O dono tem o número dela na mão, não um cuid.
    telefone: z.string().min(8).optional(),
  // Exclusão não tem desfazer. Confirmação explícita, no corpo, para que um
  // clique errado na tela não apague a vida de um cliente.
    confirmo: z.literal(true, {
      errorMap: () => ({ message: "Confirme a exclusão para continuar" }),
    }),
  })
  .refine((d) => d.customerId || d.telefone, {
    message: "Informe o telefone do cliente que pediu para ser apagado",
  });

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!rateLimit(`excluir-cliente:${companyId}`, { limit: 30, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    // companyId no WHERE, nunca só o id: o id vem do cliente e sozinho
    // permitiria apagar o cliente de outra empresa.
    // O mesmo cliente existe com três grafias de telefone dentro do sistema
    // (com e sem 55, com e sem nono dígito). Buscar por igualdade exata acha
    // zero e não reclama — a pior forma de falhar, porque parece que deu certo.
    const porTelefone = parsed.data.telefone
      ? { phone: { in: variantesDeTelefone(parsed.data.telefone) } }
      : {};

    const cliente = await prisma.customer.findFirst({
      where: {
        companyId,
        ...(parsed.data.customerId ? { id: parsed.data.customerId } : porTelefone),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        optOut: true,
        _count: { select: { visits: true, touches: true } },
        appointments: { where: { startsAt: { gte: new Date() } }, select: { id: true } },
        recoveries: { select: { id: true, valueCents: true } },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const plano = planejarExclusaoDeCliente({
      id: cliente.id,
      telefone: cliente.phone,
      optOut: cliente.optOut,
      visitas: cliente._count.visits,
      toques: cliente._count.touches,
      agendamentosFuturos: cliente.appointments.length,
      recuperacoes: cliente.recoveries.map((r) => ({ id: r.id, valorCents: r.valueCents })),
    });

    // Transação: se a supressão falhasse depois do delete, a pessoa sumiria do
    // banco E perderia a proteção do opt-out — o pior dos dois mundos.
    await prisma.$transaction(async (tx) => {
      if (plano.suprimir) {
        await tx.supressao.upsert({
          where: { companyId_telefoneHash: { companyId, telefoneHash: plano.suprimir } },
          create: { companyId, telefoneHash: plano.suprimir },
          update: {},
        });
      }

      // Visits, touches e appointments saem por cascade. RecoveryEntry tem
      // SetNull: perde a pessoa, mantém o valor.
      await tx.customer.delete({ where: { id: cliente.id } });
    });

    return NextResponse.json({
      excluido: true,
      // Devolver os números é o que permite ao dono responder ao titular o que
      // exatamente foi apagado — que é a resposta que o art. 18 exige dele.
      visitasApagadas: plano.apagar.visitas,
      toquesApagados: plano.apagar.toques,
      agendamentosCancelados: plano.apagar.agendamentos,
      entradasAnonimizadas: plano.anonimizar.length,
      valorPreservadoCents: plano.valorPreservadoCents,
      naoSeraRecontatado: plano.suprimir !== null,
    });
  } catch (error) {
    await logError("excluir-cliente", error, companyId);
    return NextResponse.json({ error: "Não consegui excluir esse cliente agora" }, { status: 500 });
  }
}
