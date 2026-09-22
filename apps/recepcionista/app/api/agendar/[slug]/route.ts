import { NextResponse } from "next/server";
import { z } from "zod";
import {
  calcularSlots,
  gerarGoogleCalendarLink,
  separarSlotsPorTurno,
} from "@/lib/agenda/disponibilidade";
import { horarioDaEmpresa } from "@/lib/agenda/horario";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { respostaDeLimite } from "@/lib/limites";
import { entradaPorLink } from "@/lib/agenda/entrada-publica";
import { hashTelefone } from "@/lib/dados/excluir";
import { ehConflitoDeConcorrencia } from "@/lib/agenda/concorrencia";
import { extrairProfissional, gerarTextoLembrete, listarProfissionais } from "@/lib/agenda/painel";

/** Sinaliza, de dentro da transação, que o horário foi ocupado no caminho. */
class ConflitoDeHorario extends Error {}

export const dynamic = "force-dynamic";

/**
 * A BASE VIVA — página pública de agendamento.
 *
 * Rota SEM autenticação: quem usa é o cliente final do negócio. Ele escolhe o
 * horário e digita o próprio nome e telefone, e é por isso que o dono nunca
 * precisa cadastrar cliente nenhum. Cada agendamento por aqui engorda a base,
 * que é o ativo em cima do qual todo o resto da Nexora roda.
 *
 * Pedimos só nome e telefone: cada campo a mais derruba conversão, e o cálculo
 * de recuperação não precisa de mais nada.
 */

const ANTECEDENCIA_MIN = 60;
const DIAS_VISIVEIS = 21;

const agendarSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
  telefone: z
    .string()
    .trim()
    .transform((t) => t.replace(/\D/g, ""))
    .refine((t) => t.length >= 10 && t.length <= 13, "Telefone inválido"),
  serviceId: z.string().trim().optional().nullable(),
  servicoNome: z.string().trim().max(100).optional().nullable(),
  // "2026-06-01"
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  // "09:30"
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  profissional: z.string().trim().max(80).optional(),
});

async function carregarNegocio(slug: string) {
  // Limpeza preventiva: desativa qualquer resquício de "lavagem de cabelo"
  await prisma.service
    .updateMany({
      where: { name: { contains: "lavagem de cabelo", mode: "insensitive" } },
      data: { active: false },
    })
    .catch(() => {});

  return prisma.company.findFirst({
    where: {
      OR: [
        { slug },
        { id: slug },
      ],
    },
    select: {
      id: true,
      name: true,
      profile: { select: { businessHours: true, address: true } },
      services: {
        where: {
          active: true,
          NOT: { name: { contains: "lavagem de cabelo", mode: "insensitive" } },
        },
        orderBy: { order: "asc" },
        select: { id: true, name: true, durationMin: true, priceCents: true },
      },
    },
  });
}

/** Datas dos próximos dias, à meia-noite UTC, como o motor de slots espera. */
function proximosDias(a_partir_de: Date, quantidade: number): Date[] {
  const base = Date.UTC(
    a_partir_de.getUTCFullYear(),
    a_partir_de.getUTCMonth(),
    a_partir_de.getUTCDate(),
  );
  return Array.from(
    { length: quantidade },
    (_, i) => new Date(base + i * 24 * 60 * 60 * 1000),
  );
}

/** GET — serviços do negócio e horários livres dos próximos dias. */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  // Rota pública: protege a leitura de horários e consulta ao banco contra scrapers/inundação
  const ip = clientIp(request);
  const politicaGet = { limit: 60, windowMs: 60_000 };
  if (!rateLimit(`agendar-slots:ip:${ip}`, politicaGet)) {
    return respostaDeLimite(politicaGet);
  }

  try {
    const negocio = await carregarNegocio(params.slug);
    if (!negocio) {
      return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
    }

    const url = new URL(request.url);
    const serviceId = url.searchParams.get("serviceId");
    const profissionalFiltro = url.searchParams.get("profissional")?.trim();

    const servicosDisponiveis = negocio.services.length > 0
      ? negocio.services
      : [{ id: "atendimento", name: "Atendimento Geral", durationMin: 30, priceCents: 0 }];

    const servico = serviceId
      ? servicosDisponiveis.find((s) => s.id === serviceId) || servicosDisponiveis[0]
      : servicosDisponiveis[0];

    const agora = new Date();
    const dias = proximosDias(agora, DIAS_VISIVEIS);

    const todosAgendamentos = await prisma.appointment.findMany({
      where: {
        companyId: negocio.id,
        status: { in: ["MARCADO", "CONFIRMADO"] },
        startsAt: { gte: agora, lte: new Date(dias.at(-1)!.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: { startsAt: true, endsAt: true, notes: true },
    });

    const horarios = horarioDaEmpresa(negocio.profile?.businessHours);
    const profissionais = await listarProfissionais(negocio.id);

    const agenda = dias
      .map((dia) => {
        let horas: string[] = [];

        if (profissionalFiltro && profissionalFiltro !== "Primeiro disponível") {
          // Filtro por profissional específico: apenas agendamentos deste profissional ocupam o horário
          const ocupadosProf = todosAgendamentos
            .filter((a) => extrairProfissional(a.notes).toLowerCase() === profissionalFiltro.toLowerCase())
            .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));

          horas = calcularSlots({
            dia,
            horarios,
            duracaoMin: servico.durationMin,
            ocupados: ocupadosProf,
            agora,
            antecedenciaMinutos: ANTECEDENCIA_MIN,
          });
        } else if (profissionais.length > 0) {
          // "Primeiro disponível" com múltiplos profissionais:
          // Um horário está livre se pelo menos UM profissional estiver livre.
          // Só fica indisponível se TODOS os profissionais estiverem ocupados.
          const slotsDisponiveis = new Set<string>();

          for (const p of profissionais) {
            const ocupadosP = todosAgendamentos
              .filter((a) => extrairProfissional(a.notes).toLowerCase() === p.nome.toLowerCase())
              .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));

            const slotsP = calcularSlots({
              dia,
              horarios,
              duracaoMin: servico.durationMin,
              ocupados: ocupadosP,
              agora,
              antecedenciaMinutos: ANTECEDENCIA_MIN,
            });

            for (const s of slotsP) {
              slotsDisponiveis.add(s);
            }
          }

          horas = Array.from(slotsDisponiveis).sort();
        } else {
          // Sem profissionais cadastrados (atendimento geral / 1 vaga por horário)
          const ocupadosGeral = todosAgendamentos.map((a) => ({
            startsAt: a.startsAt,
            endsAt: a.endsAt,
          }));

          horas = calcularSlots({
            dia,
            horarios,
            duracaoMin: servico.durationMin,
            ocupados: ocupadosGeral,
            agora,
            antecedenciaMinutos: ANTECEDENCIA_MIN,
          });
        }

        return {
          dia: dia.toISOString().slice(0, 10),
          horas,
          turnos: separarSlotsPorTurno(horas),
        };
      })
      .filter((d) => d.horas.length > 0);

    return NextResponse.json({
      negocio: { nome: negocio.name, endereco: negocio.profile?.address ?? "" },
      servicos: servicosDisponiveis,
      servicoSelecionado: servico.id,
      profissionais,
      dias: agenda,
    });
  } catch (error) {
    await logError("agendar-slots", error);
    return NextResponse.json({ error: "Não consegui carregar os horários" }, { status: 500 });
  }
}

/** POST — o cliente final marca. Cria (ou reaproveita) o cadastro dele. */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  // Rota pública: proteção em camadas.
  // 1. Teto por IP: impede um único atacante de consumir todos os agendamentos
  const ip = clientIp(request);
  const politicaIp = { limit: 10, windowMs: 10 * 60_000 };
  if (!rateLimit(`agendar:ip:${ip}`, politicaIp)) {
    return respostaDeLimite(politicaIp);
  }

  // 2. Teto por negócio (slug): proteção geral contra tráfego excessivo
  const politicaSlug = { limit: 60, windowMs: 5 * 60_000 };
  if (!rateLimit(`agendar:slug:${params.slug}`, politicaSlug)) {
    return respostaDeLimite(politicaSlug);
  }

  try {
    const parsed = agendarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }
    const { nome, telefone, serviceId, servicoNome, dia, hora } = parsed.data;

    // 3. Teto por telefone: impede disparos em massa fingindo ser o mesmo cliente
    const politicaTel = { limit: 5, windowMs: 15 * 60_000 };
    if (!rateLimit(`agendar:tel:${telefone}`, politicaTel)) {
      return respostaDeLimite(politicaTel);
    }

    const negocio = await carregarNegocio(params.slug);
    if (!negocio) {
      return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
    }

    const servicosDisponiveis = negocio.services.length > 0
      ? negocio.services
      : [{ id: "atendimento", name: "Atendimento Geral", durationMin: 30, priceCents: 0 }];

    const servicoNomeInformado = servicoNome?.trim();
    const servico = (serviceId ? servicosDisponiveis.find((s) => s.id === serviceId) : null) ?? {
      id: "atendimento",
      name: servicoNomeInformado || "Atendimento Geral",
      durationMin: 30,
      priceCents: 0,
    };

    const diaData = new Date(`${dia}T00:00:00.000Z`);
    const agora = new Date();

    // A MARCAÇÃO INTEIRA NUMA TRANSAÇÃO SERIALIZÁVEL.
    //
    // Antes, a rota checava `livres.includes(hora)` e só depois criava o
    // agendamento. Entre as duas coisas havia uma janela em que outra
    // requisição pegava o mesmo horário — e não existe constraint no banco
    // para impedir, só um índice. O comentário logo abaixo já dizia que dupla
    // marcação é o pior defeito possível numa agenda; a corrida produzia
    // exatamente isso, por um endpoint PÚBLICO, e dava para provocá-la de
    // propósito para sabotar a agenda de um negócio.
    //
    // Constraint única em (companyId, startsAt) não serviria: agendamento
    // CANCELADO ou FALTOU libera o horário, e a constraint bloquearia a
    // remarcação legítima. Serializável resolve sem mentir sobre o domínio —
    // o Postgres aborta a transação perdedora, que vira o mesmo 409 de sempre.
    let ocupou = false;
    let profissionalFinal = "Profissional";

    try {
      await prisma.$transaction(
        async (tx) => {
          const ocupadosDia = await tx.appointment.findMany({
            where: {
              companyId: negocio.id,
              status: { in: ["MARCADO", "CONFIRMADO"] },
              startsAt: {
                gte: diaData,
                lt: new Date(diaData.getTime() + 48 * 60 * 60 * 1000),
              },
            },
            select: { startsAt: true, endsAt: true, notes: true },
          });

          const listaProfs = await listarProfissionais(negocio.id);
          const [h, m] = hora.split(":").map(Number);
          const startsAt = new Date(diaData.getTime() + (h * 60 + m + 180) * 60 * 1000);
          const endsAt = new Date(startsAt.getTime() + servico.durationMin * 60 * 1000);

          let profissionalEscolhido: string;

          if (parsed.data.profissional && parsed.data.profissional !== "Primeiro disponível") {
            const profAlvo = parsed.data.profissional.trim();

            // 1. Checa se o profissional escolhido já tem agendamento que sobreponha esse horário
            const conflito = ocupadosDia.some((ag) => {
              if (extrairProfissional(ag.notes).toLowerCase() !== profAlvo.toLowerCase()) {
                return false;
              }
              return startsAt.getTime() < ag.endsAt.getTime() && endsAt.getTime() > ag.startsAt.getTime();
            });

            if (conflito) {
              ocupou = true;
              throw new ConflitoDeHorario();
            }

            // 2. Valida contra o expediente da empresa
            const ocupadosProf = ocupadosDia
              .filter((ag) => extrairProfissional(ag.notes).toLowerCase() === profAlvo.toLowerCase())
              .map((ag) => ({ startsAt: ag.startsAt, endsAt: ag.endsAt }));

            const livres = calcularSlots({
              dia: diaData,
              horarios: horarioDaEmpresa(negocio.profile?.businessHours),
              duracaoMin: servico.durationMin,
              ocupados: ocupadosProf,
              agora,
              antecedenciaMinutos: ANTECEDENCIA_MIN,
            });

            if (!livres.includes(hora)) {
              ocupou = true;
              throw new ConflitoDeHorario();
            }

            profissionalEscolhido = profAlvo;
          } else if (listaProfs.length > 0) {
            // "Primeiro disponível": encontra o primeiro profissional da equipe livre no horário
            const profLivre = listaProfs.find((p) => {
              const temSobreposicao = ocupadosDia.some((ag) => {
                if (extrairProfissional(ag.notes).toLowerCase() !== p.nome.toLowerCase()) {
                  return false;
                }
                return startsAt.getTime() < ag.endsAt.getTime() && endsAt.getTime() > ag.startsAt.getTime();
              });
              if (temSobreposicao) return false;

              const ocupadosP = ocupadosDia
                .filter((ag) => extrairProfissional(ag.notes).toLowerCase() === p.nome.toLowerCase())
                .map((ag) => ({ startsAt: ag.startsAt, endsAt: ag.endsAt }));

              const livresP = calcularSlots({
                dia: diaData,
                horarios: horarioDaEmpresa(negocio.profile?.businessHours),
                duracaoMin: servico.durationMin,
                ocupados: ocupadosP,
                agora,
                antecedenciaMinutos: ANTECEDENCIA_MIN,
              });

              return livresP.includes(hora);
            });

            if (!profLivre) {
              ocupou = true;
              throw new ConflitoDeHorario();
            }

            profissionalEscolhido = profLivre.nome;
          } else {
            // Sem equipe cadastrada: agenda única
            const conflito = ocupadosDia.some((ag) => {
              return startsAt.getTime() < ag.endsAt.getTime() && endsAt.getTime() > ag.startsAt.getTime();
            });

            if (conflito) {
              ocupou = true;
              throw new ConflitoDeHorario();
            }

            const ocupadosGeral = ocupadosDia.map((ag) => ({
              startsAt: ag.startsAt,
              endsAt: ag.endsAt,
            }));

            const livres = calcularSlots({
              dia: diaData,
              horarios: horarioDaEmpresa(negocio.profile?.businessHours),
              duracaoMin: servico.durationMin,
              ocupados: ocupadosGeral,
              agora,
              antecedenciaMinutos: ANTECEDENCIA_MIN,
            });

            if (!livres.includes(hora)) {
              ocupou = true;
              throw new ConflitoDeHorario();
            }

            profissionalEscolhido = "Atendimento Geral";
          }

          profissionalFinal = profissionalEscolhido;

          // Esta rota é PÚBLICA e escreve na base do assinante. O que ela pode
          // gravar está em entradaPorLink, com o porquê de cada regra: agendar
          // não revoga o PARAR, e formulário público não reescreve a caderneta.
          const existente = await tx.customer.findUnique({
            where: { companyId_phone: { companyId: negocio.id, phone: telefone } },
            select: { id: true },
          });

          const hash = hashTelefone(telefone);
          const suprimido = hash
            ? (await tx.supressao.count({
                where: { companyId: negocio.id, telefoneHash: hash },
              })) > 0
            : false;

          const entrada = entradaPorLink({
            existe: Boolean(existente),
            nomeInformado: nome,
            suprimido,
          });

          const cliente =
            existente ??
            (await tx.customer.create({
              data: {
                companyId: negocio.id,
                phone: telefone,
                source: "LINK",
                ...entrada.criar!,
                ...(entrada.criar!.optOut ? { optOutAt: new Date() } : {}),
              },
              select: { id: true },
            }));

          await tx.appointment.create({
            data: {
              companyId: negocio.id,
              customerId: cliente.id,
              serviceId: servico.id === "atendimento" ? null : servico.id,
              startsAt,
              endsAt,
              source: "LINK",
              notes: JSON.stringify({
                profissional: profissionalEscolhido,
                servicoNome: servico.name,
              }),
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (erro) {
      // Perder a corrida não é falha do sistema: é o horário ter acabado de ser
      // ocupado — que é o que a pessoa precisa ler, e não um 500.
      if (ocupou || ehConflitoDeConcorrencia(erro)) {
        return NextResponse.json(
          { error: "Esse horário acabou de ser ocupado. Escolhe outro?" },
          { status: 409 },
        );
      }
      throw erro;
    }

    const [h, m] = hora.split(":").map(Number);
    const startsAt = new Date(diaData.getTime() + (h * 60 + m + 180) * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + servico.durationMin * 60 * 1000);

    const googleCalendarUrl = gerarGoogleCalendarLink({
      titulo: `${servico.name} - ${negocio.name}`,
      descricao: `Agendamento com ${profissionalFinal}.\nEstabelecimento: ${negocio.name}`,
      localizacao: negocio.profile?.address ?? "",
      startsAt,
      endsAt,
    });

    const mensagemWhatsApp = gerarTextoLembrete({
      clienteNome: nome,
      empresaNome: negocio.name,
      servicoNome: servico.name,
      profissionalNome: profissionalFinal,
      dataIso: dia,
      hora,
      endereco: negocio.profile?.address ?? "",
    });

    return NextResponse.json(
      {
        ok: true,
        confirmacao: {
          negocio: negocio.name,
          servico: servico.name,
          profissional: profissionalFinal,
          dia,
          hora,
          googleCalendarUrl,
          mensagemWhatsApp,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await logError("agendar-criar", error);
    return NextResponse.json({ error: "Não consegui marcar agora" }, { status: 500 });
  }
}
