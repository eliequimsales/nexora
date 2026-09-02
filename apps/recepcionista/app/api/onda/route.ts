import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { exigirAcesso } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { deveSilenciar, MOTIVOS_PULO } from "@/lib/recuperacao/pulo";
import { montarOndaDaSemana } from "@/lib/recuperacao/servico";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { ehAtribuivel } from "@/lib/recuperacao/atribuicao";
import { calcularCiclo, medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import {
  MAX_DIAS_PARA_COBRAR,
  MIN_DIAS_PARA_COBRAR,
  vencidosParaPerguntar,
} from "@/lib/recuperacao/desfecho";

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
  // AGUARDANDO entra na lista: "enviei" NAO e "nao respondeu". Gravar
  // SEM_RESPOSTA no instante do envio perdia todo retorno que acontecia
  // depois -- ver lib/recuperacao/desfecho.ts.
  resultado: z.enum(["AGUARDANDO", "VOLTOU", "MARCOU", "RESPONDEU", "SEM_RESPOSTA", "PULADO"]),
  valorCents: z.number().int().min(0).optional(),
  motivoPulo: z
    .enum(MOTIVOS_PULO)
    .optional(),
});

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("onda", companyId, LIMITES.pesado)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  // Gerar a onda é a ação de saída que o produto vende. É ela que trava sem
  // assinatura — nunca a leitura da base, que é dado do próprio dono.
  const barrado = await exigirAcesso(companyId, "GERAR_ONDA");
  if (barrado) return barrado;

  try {
    const onda = await montarOndaDaSemana(companyId);

    // OS PENDENTES DA SEMANA PASSADA.
    //
    // "Enviei" agora grava AGUARDANDO, que é a verdade — mas sem alguém
    // perguntar depois, tudo ficaria AGUARDANDO para sempre e o Livro-Caixa
    // ficaria mais vazio do que antes. Esta lista é a outra metade do conserto.
    const pendentes = await prisma.recoveryTouch.findMany({
      where: {
        companyId,
        outcome: "AGUARDANDO",
        sentAt: {
          gte: new Date(Date.now() - (MAX_DIAS_PARA_COBRAR + 1) * 86_400_000),
          lte: new Date(Date.now() - MIN_DIAS_PARA_COBRAR * 86_400_000),
        },
      },
      select: {
        id: true,
        customerId: true,
        touchNumber: true,
        esteira: true,
        sentAt: true,
        customer: { select: { name: true, visits: { select: { valueCents: true }, take: 20 } } },
      },
      orderBy: { sentAt: "asc" },
    });

    const perguntar = vencidosParaPerguntar(
      pendentes.map((t) => ({
        id: t.id,
        clienteId: t.customerId,
        nome: t.customer?.name ?? "cliente",
        toqueNumero: t.touchNumber,
        esteira: t.esteira,
        ticketMedioCents:
          t.customer && t.customer.visits.length > 0
            ? Math.round(
                t.customer.visits.reduce((s, v) => s + v.valueCents, 0) / t.customer.visits.length,
              )
            : 0,
        enviadoEm: t.sentAt,
      })),
    );

    return NextResponse.json({ ...onda, perguntar });
  } catch (error) {
    await logError("onda-get", error, companyId);
    return NextResponse.json({ error: "Não consegui montar a onda agora" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("onda", companyId, LIMITES.pesado)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

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
        // Histórico, e não só a última visita: sem ele não dá para calcular o
        // ciclo pessoal, e sem ciclo não dá para dizer se ele voltou porque a
        // Nexora chamou ou porque já estava na hora dele.
        visits: { orderBy: { occurredAt: "desc" }, take: 40, select: { occurredAt: true } },
        // O toque que originou este retorno, para medir a janela de 21 dias.
        touches: {
          where: { touchNumber: toque },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { sentAt: true },
        },
      },
    });
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    // RESOLVE o toque pendente em vez de criar outro.
    //
    // Antes esta rota sempre criava. Como "Enviei" agora grava AGUARDANDO e a
    // tela pergunta depois "quem apareceu?", criar de novo produziria DOIS
    // toques para o mesmo contato: um AGUARDANDO eterno na lista de perguntas,
    // e um segundo com o desfecho. O contador de toques do cliente também
    // andaria sozinho, e ele receberia o toque 3 sem nunca ter recebido o 2.
    const pendente = await prisma.recoveryTouch.findFirst({
      where: { companyId, customerId: clienteId, touchNumber: toque, outcome: "AGUARDANDO" },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });

    if (pendente) {
      await prisma.recoveryTouch.update({
        where: { id: pendente.id },
        data: {
          esteira,
          outcome: resultado,
          // AGUARDANDO continua sem data de desfecho: ela marca quando a
          // história acabou, e ela ainda não acabou.
          outcomeAt: resultado === "AGUARDANDO" ? null : new Date(),
          skipReason: motivoPulo ?? "",
        },
      });
    } else {
      await prisma.recoveryTouch.create({
        data: {
          companyId,
          customerId: clienteId,
          touchNumber: toque,
          esteira,
          outcome: resultado,
          outcomeAt: resultado === "AGUARDANDO" ? null : new Date(),
          skipReason: motivoPulo ?? "",
        },
      });
    }

    // Sai da fila de vez — a próxima onda fica mais limpa, e isso é dito ao
    // dono na resposta. Quem decide é lib/recuperacao/pulo.ts: antes a regra
    // era um `!== "OUTRO"` aqui, e "pediu para parar" nem existia como motivo,
    // então o cliente que exercia o direito dele caía em OUTRO e continuava
    // recebendo mensagem.
    if (resultado === "PULADO" && deveSilenciar(motivoPulo)) {
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

      // ATRIBUIÇÃO. Antes este campo caía no @default(true) do schema e TODO
      // retorno era contado como recuperado pela Nexora — inclusive quem ia
      // voltar sozinho. A tela de assinatura, enquanto isso, afirmava aplicar
      // a janela de 21 dias. Ver lib/recuperacao/atribuicao.ts.
      const ciclo = calcularCiclo(
        cliente.visits.map((v) => v.occurredAt),
        medianaDoSegmento(null),
      );
      const enviadoEm = cliente.touches[0]?.sentAt ?? null;
      const diasDesdeOToque = enviadoEm
        ? Math.floor((Date.now() - enviadoEm.getTime()) / (24 * 60 * 60 * 1000))
        : Number.POSITIVE_INFINITY;

      const atribuido = ehAtribuivel({
        diasDesdeOToque,
        diasSumido: diasAway,
        // Ciclo de confiança baixa não sustenta a afirmação de que ele estava
        // fora do ritmo. Na dúvida o extrato fica menor, nunca maior.
        cicloDias: ciclo.confianca === "alta" ? ciclo.dias : 0,
      });

      await prisma.recoveryEntry.create({
        data: {
          companyId,
          customerId: clienteId,
          valueCents: valorCents,
          daysAway: diasAway,
          esteira,
          touchNumber: toque,
          attributed: atribuido,
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
