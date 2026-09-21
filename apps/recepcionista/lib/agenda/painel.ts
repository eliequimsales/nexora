import { prisma } from "@/lib/db";
import { calcularCiclo, medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { proximoRetornoProvavel } from "@/lib/agenda/disponibilidade";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";

const MIN_MS = 60 * 1000;
const OFFSET_BRASILIA = -180; // UTC-3 em minutos

export type Profissional = {
  id: string;
  nome: string;
  cargo: string;
};

export const PROFISSIONAIS_PADRAO: Profissional[] = [
  { id: "prof_1", nome: "Profissional Carlos", cargo: "Profissional" },
];

export function sanitizarProfissional(p: unknown): Profissional {
  const item = typeof p === "object" && p !== null ? (p as Record<string, unknown>) : {};
  let nome = String(item.nome || "").trim();
  let cargo = String(item.cargo || "").trim();

  // Elimina qualquer menção residual a termos de barbearia (Barbeiro, Barber, Breno)
  if (/barbeir|barber|breno/i.test(nome) || !nome) {
    nome = "Profissional Carlos";
  }
  if (/barbeir|barber/i.test(cargo) || !cargo) {
    cargo = "Profissional";
  }

  return {
    id: String(item.id || `prof_${Math.random().toString(36).slice(2, 9)}`),
    nome,
    cargo,
  };
}

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

/**
 * Lista os profissionais da equipe da empresa.
 */
export async function listarProfissionais(companyId: string): Promise<Profissional[]> {
  try {
    const profile = await prisma.companyProfile.findUnique({
      where: { companyId },
      select: { serviceRules: true },
    });

    if (profile?.serviceRules && profile.serviceRules.trim().startsWith("[")) {
      const parsed = JSON.parse(profile.serviceRules);
      if (Array.isArray(parsed)) {
        // Se a lista foi salva (mesmo se vazia []), respeitamos a escolha do lojista
        const sanitizados = parsed.map(sanitizarProfissional);

        // Se o banco continha termos residuais de barbearia, atualiza silenciosamente
        if (JSON.stringify(parsed) !== JSON.stringify(sanitizados)) {
          void prisma.companyProfile
            .update({
              where: { companyId },
              data: { serviceRules: JSON.stringify(sanitizados) },
            })
            .catch(() => {});
        }

        return sanitizados;
      }
    }
  } catch {
    // fallback
  }

  return PROFISSIONAIS_PADRAO;
}

/**
 * Salva a lista de profissionais da equipe da empresa.
 */
export async function salvarProfissionais(
  companyId: string,
  profissionais: Profissional[],
): Promise<Profissional[]> {
  const sanitizados = profissionais.map(sanitizarProfissional);
  const payload = JSON.stringify(sanitizados);
  await prisma.companyProfile.upsert({
    where: { companyId },
    create: { companyId, serviceRules: payload },
    update: { serviceRules: payload },
  });
  return sanitizados;
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
  profissionalNome?: string | null;
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

  const profissional = input.profissionalNome?.trim() || "Profissional";

  // Serializa profissional e observações no campo notes de forma segura
  const payloadNotes = JSON.stringify({
    profissional,
    observacoes: input.observacoes?.trim() || "",
  });

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
        notes: payloadNotes,
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

    let profissional = "Atendimento Principal";
    let observacoes = ag.notes;
    let lembreteEnviado = false;
    let lembreteEnviadoEm: string | null = null;
    let lembreteStatus = "PENDENTE";

    if (ag.notes && ag.notes.startsWith("{")) {
      try {
        const parsed = JSON.parse(ag.notes);
        if (parsed.profissional) profissional = parsed.profissional;
        if (parsed.observacoes !== undefined) observacoes = parsed.observacoes;
        if (parsed.lembreteEnviado !== undefined) lembreteEnviado = Boolean(parsed.lembreteEnviado);
        if (parsed.lembreteEnviadoEm) lembreteEnviadoEm = parsed.lembreteEnviadoEm;
        if (parsed.lembreteStatus) lembreteStatus = parsed.lembreteStatus;
      } catch {
        // mantém texto bruto
      }
    }

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
      profissional,
      status: ag.status,
      source: ag.source,
      observacoes,
      lembreteEnviado,
      lembreteEnviadoEm,
      lembreteStatus,
      historicoVisitas: visitas.length,
      cicloDias: ciclo.dias,
      cicloConfianca: ciclo.confianca,
      proximoRetornoEsperado: proximoEsperado ? formatarDataLocal(proximoEsperado) : null,
    };
  });
}

/**
 * Monta a grade horária em colunas (exatamente como na imagem de referência).
 * - Linhas: horários das 08:00 às 20:00 (em passos de 15 minutos).
 * - Colunas: profissionais da equipe (ex: Profissional 1, Profissional 2).
 * - Células: agendamentos alocados ou slots livres com "+".
 */
export async function obterGradeDoDia(companyId: string, dataStr: string) {
  const [profissionais, agendamentos] = await Promise.all([
    listarProfissionais(companyId),
    listarAgendamentos(companyId, { data: dataStr }),
  ]);

  // Gera horários das 08:00 até 20:00 com intervalos de 15 minutos (48 slots)
  const slotsHorario: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slotsHorario.push(`${hh}:${mm}`);
    }
  }

  // Agrupa agendamentos por [horario][profissional]
  const mapaGrade: Record<string, Record<string, any>> = {};
  for (const ag of agendamentos) {
    if (ag.status === "CANCELADO") continue;
    if (!mapaGrade[ag.horaInicio]) mapaGrade[ag.horaInicio] = {};
    mapaGrade[ag.horaInicio][ag.profissional] = ag;
  }

  return {
    data: dataStr,
    profissionais,
    slotsHorario,
    mapaGrade,
    agendamentos,
  };
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

/**
 * Formata data ISO (YYYY-MM-DD) para texto amigável em português (ex: "segunda-feira, 15 de junho").
 */
export function formatarDataPorExtensoBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  const diasSemana = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const nomeDia = diasSemana[data.getUTCDay()] ?? "";
  const nomeMes = meses[data.getUTCMonth()] ?? "";
  return `${nomeDia}, ${dia} de ${nomeMes}`;
}

export type DadosTextoLembrete = {
  clienteNome: string;
  empresaNome: string;
  servicoNome: string;
  profissionalNome: string;
  dataIso: string;
  hora: string;
  endereco?: string;
};

/**
 * Gera mensagem humanizada e universal para lembrete de agendamento via WhatsApp.
 * Funciona para qualquer nicho: barbearias, clínicas, salões, consultórios, estética.
 */
export function gerarTextoLembrete(dados: DadosTextoLembrete): string {
  const primeiroNome = dados.clienteNome.trim().split(" ")[0] || "Cliente";
  const dataExtenso = formatarDataPorExtensoBr(dados.dataIso);
  const enderecoLinha = dados.endereco?.trim() ? `\n📍 *Endereço:* ${dados.endereco.trim()}` : "";

  return `Olá, ${primeiroNome}! Tudo bem? 😊\n\nPassando para lembrar do seu horário na *${dados.empresaNome}*:\n\n📅 *Data:* ${dataExtenso}\n⏰ *Horário:* ${dados.hora}\n✨ *Atendimento:* ${dados.servicoNome}\n👤 *Profissional:* ${dados.profissionalNome}${enderecoLinha}\n\nCaso precise remarcar ou tirar alguma dúvida, basta nos responder por aqui. Te esperamos!`;
}

/**
 * Marca o lembrete como enviado no agendamento.
 */
export async function marcarLembreteEnviado(companyId: string, appointmentId: string) {
  const ag = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    select: { id: true, notes: true },
  });
  if (!ag) return null;

  let payloadNotes: Record<string, any> = {};
  if (ag.notes && ag.notes.startsWith("{")) {
    try {
      payloadNotes = JSON.parse(ag.notes);
    } catch {
      payloadNotes = { observacoes: ag.notes };
    }
  } else if (ag.notes) {
    payloadNotes = { observacoes: ag.notes };
  }

  payloadNotes.lembreteEnviado = true;
  payloadNotes.lembreteEnviadoEm = new Date().toISOString();
  payloadNotes.lembreteStatus = "ENVIADO";

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { notes: JSON.stringify(payloadNotes) },
  });
}

/**
 * Obtém agendamentos pendentes ou confirmados com textos de lembrete prontos e links de WhatsApp.
 */
export async function obterLembretes(companyId: string, dataIso?: string) {
  const dataAlvo = dataIso || formatarDataLocal(new Date());
  const agendamentos = await listarAgendamentos(companyId, { data: dataAlvo });
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, profile: { select: { address: true } } },
  });

  return agendamentos
    .filter((ag) => ag.status === "MARCADO" || ag.status === "CONFIRMADO")
    .map((ag) => {
      const mensagem = gerarTextoLembrete({
        clienteNome: ag.nome,
        empresaNome: empresa?.name || "Nosso Estabelecimento",
        servicoNome: ag.servicoNome,
        profissionalNome: ag.profissional,
        dataIso: ag.data,
        hora: ag.horaInicio,
        endereco: empresa?.profile?.address || "",
      });

      const telNumeros = ag.telefone.replace(/\D/g, "");
      const telComDdd =
        telNumeros.length <= 11 && !telNumeros.startsWith("55")
          ? `55${telNumeros}`
          : telNumeros;
      const whatsappUrl = `https://wa.me/${telComDdd}?text=${encodeURIComponent(mensagem)}`;

      return {
        ...ag,
        mensagemPronta: mensagem,
        whatsappUrl,
      };
    });
}

