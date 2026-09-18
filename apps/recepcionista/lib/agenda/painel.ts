import { prisma } from "@/lib/db";
import { calcularCiclo, medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { proximoRetornoProvavel } from "@/lib/agenda/disponibilidade";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";

const MIN_MS = 60 * 1000;
const OFFSET_BRASILIA = -180; // UTC-3 em minutos

/**
 * Converte data (YYYY-MM-DD) e hora (HH:MM) local em instante Date UTC.
 */
export function instanteLocalParaUtc(dataStr: string, horaStr: string, offsetMin = OFFSET_BRASILIA): Date {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const [h, m] = horaStr.split(":").map(Number);
  const minutosNoDia = h * 60 + m;
  const base = Date.UTC(ano, mes - 1, dia);
  return new Date(base + (minutosNoDia - offsetMin) * MIN_MS);
}

/**
 * Formata um Date UTC para o horário local (HH:MM).
 */
export function formatarHoraLocal(d: Date, offsetMin = OFFSET_BRASILIA): string {
  const localMs = d.getTime() + offsetMin * MIN_MS;
  const localDate = new Date(localMs);
  const h = String(localDate.getUTCHours()).padStart(2, "0");
  const m = String(localDate.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formata um Date UTC para a data local (YYYY-MM-DD).
 */
export function formatarDataLocal(d: Date, offsetMin = OFFSET_BRASILIA): string {
  const localMs = d.getTime() + offsetMin * MIN_MS;
  const localDate = new Date(localMs);
  const ano = localDate.getUTCFullYear();
  const mes = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(localDate.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export type CriarAgendamentoInput = {
  nome: string;
  telefone: string;
  serviceId?: string | null;
  servicoNome?: string | null;
  valorCents?: number;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracaoMin?: number;
  observacoes?: string;
  jaAtendido?: boolean;
};

export type AtualizarStatusInput = {
  status: "MARCADO" | "CONFIRMADO" | "ATENDIDO" | "CANCELADO" | "FALTOU";
  valorCents?: number;
  servicoNome?: string;
};

/**
 * Cadastra um agendamento na agenda.
 * Se o cliente ainda não existir na empresa, cadastra automaticamente (source: "PAINEL").
 * Se já foi atendido (ou marcado para o passado), registra imediatamente a visita com valor.
 */
export async function criarAgendamento(companyId: string, input: CriarAgendamentoInput) {
  const telefoneLimpo = input.telefone.replace(/\D/g, "");
  const nomeLimpo = input.nome.trim();
  const duracao = input.duracaoMin && input.duracaoMin > 0 ? input.duracaoMin : 30;

  const startsAt = instanteLocalParaUtc(input.data, input.hora);
  const endsAt = new Date(startsAt.getTime() + duracao * MIN_MS);

  return prisma.$transaction(async (tx) => {
    // 1. Busca cliente por qualquer variante de telefone
    const variantes = variantesDeTelefone(telefoneLimpo);
    let cliente = await tx.customer.findFirst({
      where: {
        companyId,
        phone: { in: variantes.length > 0 ? variantes : [telefoneLimpo] },
      },
      select: { id: true, name: true, phone: true },
    });

    if (!cliente) {
      // Auto-cadastro invisível
      cliente = await tx.customer.create({
        data: {
          companyId,
          name: nomeLimpo || "Cliente",
          phone: telefoneLimpo,
          source: "PAINEL",
          notes: input.observacoes ?? "",
        },
        select: { id: true, name: true, phone: true },
      });
    } else if (nomeLimpo && (cliente.name === "Cliente" || !cliente.name)) {
      // Atualiza nome se estava genérico
      cliente = await tx.customer.update({
        where: { id: cliente.id },
        data: { name: nomeLimpo },
        select: { id: true, name: true, phone: true },
      });
    }

    // 2. Localiza ou cria serviço se necessário
    let serviceId = input.serviceId ?? null;
    let serviceName = input.servicoNome?.trim() || "";
    let valorCents = input.valorCents ?? 0;

    if (serviceId) {
      const servicoDb = await tx.service.findFirst({
        where: { id: serviceId, companyId },
        select: { id: true, name: true, priceCents: true, durationMin: true },
      });
      if (servicoDb) {
        serviceName = servicoDb.name;
        if (!valorCents) valorCents = servicoDb.priceCents;
      }
    } else if (serviceName) {
      // Tenta achar serviço pelo nome exato ou cria um serviço padrão
      const existente = await tx.service.findFirst({
        where: { companyId, name: { equals: serviceName, mode: "insensitive" } },
        select: { id: true, priceCents: true },
      });
      if (existente) {
        serviceId = existente.id;
        if (!valorCents) valorCents = existente.priceCents;
      } else {
        const novoServico = await tx.service.create({
          data: {
            companyId,
            name: serviceName,
            priceCents: valorCents,
            durationMin: duracao,
          },
          select: { id: true },
        });
        serviceId = novoServico?.id ?? null;
      }
    }

    const statusInicial = input.jaAtendido ? "ATENDIDO" : "MARCADO";

    // 3. Cria o agendamento
    const appointment = await tx.appointment.create({
      data: {
        companyId,
        customerId: cliente.id,
        serviceId,
        startsAt,
        endsAt,
        status: statusInicial,
        source: "PAINEL",
        notes: input.observacoes ?? "",
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, priceCents: true, durationMin: true } },
      },
    });

    // 4. Se já foi atendido, cria a visita imediatamente para alimentar histórico e livro-caixa
    if (input.jaAtendido) {
      await tx.visit.create({
        data: {
          customerId: cliente.id,
          occurredAt: startsAt,
          valueCents: valorCents,
          service: serviceName || "Atendimento",
        },
      });
    }

    return appointment;
  });
}

/**
 * Conclui um atendimento: marca como ATENDIDO e cria o registro de Visit correspondente.
 * Alimenta a cadência de retorno do cliente e a receita no livro-caixa.
 */
export async function concluirAtendimento(
  companyId: string,
  appointmentId: string,
  dados?: { valorCents?: number; servicoNome?: string },
) {
  return prisma.$transaction(async (tx) => {
    const agendamento = await tx.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, priceCents: true } },
      },
    });

    if (!agendamento) {
      throw new Error("Agendamento não encontrado");
    }

    const valorCents =
      dados?.valorCents !== undefined
        ? dados.valorCents
        : (agendamento.service?.priceCents ?? 0);
    const servicoNome =
      dados?.servicoNome || agendamento.service?.name || "Atendimento";

    // Atualiza status do agendamento
    const atualizado = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "ATENDIDO" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, priceCents: true } },
      },
    });

    // Cria a visita se ainda não existir para o mesmo cliente na mesma data/hora
    const visitaExistente = await tx.visit.findFirst({
      where: {
        customerId: agendamento.customerId,
        occurredAt: agendamento.startsAt,
      },
    });

    if (!visitaExistente) {
      await tx.visit.create({
        data: {
          customerId: agendamento.customerId,
          occurredAt: agendamento.startsAt,
          valueCents: valorCents,
          service: servicoNome,
        },
      });
    }

    return atualizado;
  });
}

/**
 * Atualiza o status de um agendamento (ex: CONFIRMADO, CANCELADO, FALTOU).
 */
export async function atualizarStatusAgendamento(
  companyId: string,
  appointmentId: string,
  input: AtualizarStatusInput,
) {
  if (input.status === "ATENDIDO") {
    return concluirAtendimento(companyId, appointmentId, {
      valorCents: input.valorCents,
      servicoNome: input.servicoNome,
    });
  }

  return prisma.appointment.updateMany({
    where: { id: appointmentId, companyId },
    data: { status: input.status },
  });
}

/**
 * Cancela/remove um agendamento.
 */
export async function removerAgendamento(companyId: string, appointmentId: string) {
  return prisma.appointment.deleteMany({
    where: { id: appointmentId, companyId },
  });
}

/**
 * Lista agendamentos filtrados por data local (YYYY-MM-DD).
 */
export async function listarAgendamentos(
  companyId: string,
  opcoes?: {
    data?: string;
    inicio?: Date;
    fim?: Date;
  },
) {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      profile: { select: { segments: true } },
    },
  });

  const segmentos = Array.isArray(empresa?.profile?.segments)
    ? (empresa!.profile!.segments as string[])
    : [];
  const mediana = medianaDoSegmento(
    segmentos[0]?.toLowerCase().replace(/\s+/g, "-") ?? null,
  );

  let inicioRange: Date;
  let fimRange: Date;

  if (opcoes?.data) {
    inicioRange = instanteLocalParaUtc(opcoes.data, "00:00");
    fimRange = instanteLocalParaUtc(opcoes.data, "23:59");
  } else if (opcoes?.inicio && opcoes?.fim) {
    inicioRange = opcoes.inicio;
    fimRange = opcoes.fim;
  } else {
    // Padrão: hoje
    const hojeStr = formatarDataLocal(new Date());
    inicioRange = instanteLocalParaUtc(hojeStr, "00:00");
    fimRange = instanteLocalParaUtc(hojeStr, "23:59");
  }

  const agendamentos = await prisma.appointment.findMany({
    where: {
      companyId,
      startsAt: { gte: inicioRange, lte: fimRange },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          notes: true,
          optOut: true,
          visits: {
            orderBy: { occurredAt: "desc" },
            select: { occurredAt: true, valueCents: true, service: true },
          },
        },
      },
      service: {
        select: { id: true, name: true, durationMin: true, priceCents: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return agendamentos.map((ag) => {
    const visitas = ag.customer.visits;
    const datas = visitas.map((v) => v.occurredAt);
    const ciclo = calcularCiclo(datas, mediana);
    const ultimaVisita = datas[0] ?? null;
    const proximoEsperado = ultimaVisita ? proximoRetornoProvavel(ultimaVisita, ciclo.dias) : null;

    const horaInicio = formatarHoraLocal(ag.startsAt);
    const horaFim = formatarHoraLocal(ag.endsAt);

    return {
      id: ag.id,
      clienteId: ag.customer.id,
      nome: ag.customer.name,
      telefone: ag.customer.phone,
      servicoId: ag.serviceId,
      servicoNome: ag.service?.name ?? "Atendimento",
      valorCents: ag.service?.priceCents ?? 0,
      duracaoMin: ag.service?.durationMin ?? Math.round((ag.endsAt.getTime() - ag.startsAt.getTime()) / MIN_MS),
      data: formatarDataLocal(ag.startsAt),
      horaInicio,
      horaFim,
      horarioFormatado: `${horaInicio} - ${horaFim}`,
      status: ag.status,
      source: ag.source,
      observacoes: ag.notes,
      historicoVisitas: visitas.length,
      cicloDias: ciclo.dias,
      cicloConfianca: ciclo.confianca,
      proximoRetornoEsperado: proximoEsperado ? formatarDataLocal(proximoEsperado) : null,
    };
  });
}

/**
 * Resumo estatístico do dia para o topo da agenda.
 */
export async function obterResumoDaAgenda(companyId: string, dataStr: string) {
  const inicio = instanteLocalParaUtc(dataStr, "00:00");
  const fim = instanteLocalParaUtc(dataStr, "23:59");

  const [agendamentosDoDia, totalClientesNaBase] = await Promise.all([
    prisma.appointment.findMany({
      where: { companyId, startsAt: { gte: inicio, lte: fim } },
      select: {
        status: true,
        service: { select: { priceCents: true } },
      },
    }),
    prisma.customer.count({ where: { companyId } }),
  ]);

  let totalMarcados = 0;
  let totalConfirmados = 0;
  let totalConcluidos = 0;
  let totalCancelados = 0;
  let receitaRealizadaCents = 0;
  let receitaPrevistaCents = 0;

  for (const ag of agendamentosDoDia) {
    const valor = ag.service?.priceCents ?? 0;
    if (ag.status === "ATENDIDO") {
      totalConcluidos++;
      receitaRealizadaCents += valor;
    } else if (ag.status === "CONFIRMADO") {
      totalConfirmados++;
      receitaPrevistaCents += valor;
    } else if (ag.status === "CANCELADO" || ag.status === "FALTOU") {
      totalCancelados++;
    } else {
      totalMarcados++;
      receitaPrevistaCents += valor;
    }
  }

  const totalGeral = agendamentosDoDia.length;

  return {
    totalGeral,
    totalMarcados,
    totalConfirmados,
    totalConcluidos,
    totalCancelados,
    receitaRealizadaCents,
    receitaPrevistaCents,
    totalClientesNaBase,
  };
}

/**
 * Lista serviços cadastrados da empresa.
 */
export async function listarServicos(companyId: string) {
  return prisma.service.findMany({
    where: { companyId, active: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      durationMin: true,
      priceCents: true,
    },
  });
}

/**
 * Cria um serviço rápido para a empresa.
 */
export async function criarServico(
  companyId: string,
  dados: { name: string; durationMin?: number; priceCents?: number },
) {
  return prisma.service.create({
    data: {
      companyId,
      name: dados.name.trim(),
      durationMin: dados.durationMin && dados.durationMin > 0 ? dados.durationMin : 30,
      priceCents: dados.priceCents ?? 0,
    },
    select: {
      id: true,
      name: true,
      durationMin: true,
      priceCents: true,
    },
  });
}
