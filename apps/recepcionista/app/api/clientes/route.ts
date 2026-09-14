import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { calcularCiclo, medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";

export const dynamic = "force-dynamic";

/**
 * LISTA DE CLIENTES COM PRIORIDADE DE RISCO E CICLO REAL
 *
 * Devolve os clientes cadastrados da empresa calculando os dias desde a última
 * visita e o nível de risco de sumiço conforme o ciclo mediano do segmento e
 * o histórico pessoal do cliente.
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
    select: {
      name: true,
      profile: { select: { segments: true } },
    },
  });

  const segmentos = Array.isArray(empresa?.profile?.segments)
    ? (empresa!.profile!.segments as string[])
    : [];
  const medianaSegmento = medianaDoSegmento(
    segmentos[0]?.toLowerCase().replace(/\s+/g, "-") ?? null,
  );

  // Consulta limitada com take para evitar carga irrestrita de memória
  const clientes = await prisma.customer.findMany({
    where: { companyId },
    take: 300,
    orderBy: { createdAt: "desc" },
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
  const nomeEmpresa = empresa?.name || "nosso espaço";

  const lista = clientes.map((c) => {
    const datas = c.visits.map((v) => v.occurredAt);
    const ultimaVisita = datas[0] ?? null;
    const ciclo = calcularCiclo(datas, medianaSegmento);

    const valorTotalCents = c.visits.reduce((acc, v) => acc + v.valueCents, 0);
    const totalVisitas = c.visits.length;
    const ticketMedioCents = totalVisitas > 0 ? Math.round(valorTotalCents / totalVisitas) : 0;

    const primeiroNome = c.name.trim().split(/\s+/)[0] ?? c.name;

    let status: "RISCO_CRITICO" | "ATRASADO" | "PRE_ATRASO" | "EM_DIA" | "SEM_HISTORICO" = "EM_DIA";
    let rotuloStatus = "Em dia";
    let explicacaoRisco = "Cliente atendido recentemente.";
    let diasSemVoltar = 0;
    let semDataRegistrada = false;
    let mensagemReativacao = "";

    if (!ultimaVisita) {
      status = "SEM_HISTORICO";
      rotuloStatus = "Sem visitas anotadas";
      explicacaoRisco = "Cliente cadastrado sem histórico de visitas.";
      semDataRegistrada = true;
      diasSemVoltar = 0;
      mensagemReativacao = `Olá ${primeiroNome}, tudo bem? Passando para te dar as boas-vindas ao ${nomeEmpresa} e saber se podemos agendar um atendimento para você!`;
    } else {
      diasSemVoltar = Math.max(0, Math.floor((hoje.getTime() - new Date(ultimaVisita).getTime()) / (1000 * 60 * 60 * 24)));
      const classificacao = classificar({
        ultimaVisita,
        ciclo,
        temAgendamentoFuturo: false,
        hoje,
      });

      if (classificacao.esteira === "RESGATE") {
        status = "RISCO_CRITICO";
        rotuloStatus = "Em risco de perder";
        explicacaoRisco = `${diasSemVoltar} dias sem voltar (${classificacao.diasAlemDoCiclo} dias além do normal) — alto risco de sumiço.`;
        mensagemReativacao = `Olá ${primeiroNome}, tudo bem? Faz um tempinho que não te vemos aqui no ${nomeEmpresa}. Sentimos sua falta! Separamos um horário especial para você nesta semana.`;
      } else if (classificacao.esteira === "ATRASO") {
        status = "ATRASADO";
        rotuloStatus = "Atrasado";
        explicacaoRisco = `${diasSemVoltar} dias sem voltar (${classificacao.diasAlemDoCiclo} dias além do ciclo esperado).`;
        mensagemReativacao = `Olá ${primeiroNome}, tudo bem? Faz um tempinho que não te vemos aqui no ${nomeEmpresa}. Como você está? Separamos um horário especial para você nesta semana!`;
      } else if (classificacao.esteira === "PRE_ATRASO") {
        status = "PRE_ATRASO";
        rotuloStatus = "Pode sumir em breve";
        explicacaoRisco = `${diasSemVoltar} dias desde a última visita — janela ideal para lembrar (ciclo de ${ciclo.dias} dias).`;
        mensagemReativacao = `Olá ${primeiroNome}, tudo bem? Passando para saber como você está e se precisa renovar seu atendimento aqui no ${nomeEmpresa}!`;
      } else {
        status = "EM_DIA";
        rotuloStatus = "Em dia";
        explicacaoRisco = `${diasSemVoltar} dias atrás — cliente ainda em dia.`;
        mensagemReativacao = `Olá ${primeiroNome}, tudo bem? Passando para saber como você está e agradecer pela confiança no ${nomeEmpresa}!`;
      }
    }

    return {
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      optOut: c.optOut,
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita).toISOString() : null,
      diasSemVoltar,
      semDataRegistrada,
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
  // 5. Em dia.
  // 6. Sem histórico por último.
  const prioridadeStatus: Record<string, number> = {
    RISCO_CRITICO: 0,
    ATRASADO: 1,
    PRE_ATRASO: 2,
    EM_DIA: 3,
    SEM_HISTORICO: 4,
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
