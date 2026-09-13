import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * LISTA DE CLIENTES COM PRIORIDADE DE RISCO
 *
 * Devolve os clientes cadastrados da empresa calculando os dias desde a última
 * visita e o nível de risco de sumiço.
 *
 * REGRA: Os clientes que estão há mais tempo sem voltar e em maior risco de sumir
 * sobem para o TOPO da lista, permitindo que o lojista veja imediatamente quem
 * está prestes a ser perdido para sempre e tome ação.
 */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!rateLimit(`clientes:listar:${companyId}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const clientes = await prisma.customer.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      phone: true,
      optOut: true,
      createdAt: true,
      visits: {
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true, valueCents: true },
      },
    },
  });

  const hoje = new Date();

  const lista = clientes.map((c) => {
    const ultimaVisita = c.visits[0]?.occurredAt ?? null;
    const diasSemVoltar = ultimaVisita
      ? Math.max(0, Math.floor((hoje.getTime() - new Date(ultimaVisita).getTime()) / (1000 * 60 * 60 * 24)))
      : 999;

    const valorTotalCents = c.visits.reduce((acc, v) => acc + v.valueCents, 0);
    const totalVisitas = c.visits.length;
    const ticketMedioCents = totalVisitas > 0 ? Math.round(valorTotalCents / totalVisitas) : 0;

    // CLASSIFICAÇÃO DE RISCO
    let status: "RISCO_CRITICO" | "ATRASADO" | "PRE_ATRASO" | "EM_DIA" = "EM_DIA";
    let rotuloStatus = "Em dia";
    let explicacaoRisco = "Cliente atendido recentemente.";

    if (diasSemVoltar >= 60) {
      status = "RISCO_CRITICO";
      rotuloStatus = "Em risco de perder";
      explicacaoRisco = `${diasSemVoltar} dias sem voltar — alto risco de sumiço definitivo.`;
    } else if (diasSemVoltar >= 30) {
      status = "ATRASADO";
      rotuloStatus = "Atrasado";
      explicacaoRisco = `${diasSemVoltar} dias sem voltar — passou do tempo normal de retorno.`;
    } else if (diasSemVoltar >= 15) {
      status = "PRE_ATRASO";
      rotuloStatus = "Pode sumir em breve";
      explicacaoRisco = `${diasSemVoltar} dias desde a última visita — janela ideal para lembrar.`;
    } else {
      rotuloStatus = "Em dia";
      explicacaoRisco = `${diasSemVoltar} dias atrás — cliente ainda em dia.`;
    }

    // Mensagem pronta para WhatsApp caso o lojista queira chamar em 1 clique
    const primeiroNome = c.name.trim().split(/\s+/)[0] ?? c.name;
    const nomeEmpresa = empresa?.name || "nosso espaço";
    const mensagemReativacao =
      diasSemVoltar >= 30
        ? `Olá ${primeiroNome}, tudo bem? Faz um tempinho que não te vemos aqui no ${nomeEmpresa}. Como você está? Separamos um horário especial para você nesta semana!`
        : `Olá ${primeiroNome}, tudo bem? Passando para saber como você está e se precisa renovar seu atendimento aqui no ${nomeEmpresa}!`;

    return {
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      optOut: c.optOut,
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita).toISOString() : null,
      diasSemVoltar: diasSemVoltar === 999 ? 0 : diasSemVoltar,
      semDataRegistrada: diasSemVoltar === 999,
      valorTotalCents,
      ticketMedioCents,
      totalVisitas,
      status,
      rotuloStatus,
      explicacaoRisco,
      mensagemReativacao,
    };
  });

  // ORDENAÇÃO PRIORITÁRIA:
  // 1. Quem NÃO pediu opt-out vem primeiro.
  // 2. Quem está em risco crítico (mais tempo sem voltar) SUBINDO AO TOPO!
  // 3. Atrasados.
  // 4. Prestes a sumir.
  // 5. Em dia por último.
  const prioridadeStatus: Record<string, number> = {
    RISCO_CRITICO: 0,
    ATRASADO: 1,
    PRE_ATRASO: 2,
    EM_DIA: 3,
  };

  lista.sort((a, b) => {
    if (a.optOut !== b.optOut) return a.optOut ? 1 : -1;

    const pa = prioridadeStatus[a.status] ?? 99;
    const pb = prioridadeStatus[b.status] ?? 99;
    if (pa !== pb) return pa - pb;

    // Dentro do mesmo status, quem está há mais tempo sem voltar fica no topo
    if (a.diasSemVoltar !== b.diasSemVoltar) return b.diasSemVoltar - a.diasSemVoltar;

    // Empate: quem mais gasta
    return b.valorTotalCents - a.valorTotalCents;
  });

  return NextResponse.json({
    clientes: lista,
    total: lista.length,
    emRisco: lista.filter((c) => c.status === "RISCO_CRITICO" || c.status === "ATRASADO").length,
  });
}
