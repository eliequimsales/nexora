import { NextResponse } from "next/server";
import { z } from "zod";
import { calcularSlots, type Horario } from "@/lib/agenda/disponibilidade";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

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
  serviceId: z.string().trim().min(1),
  // "2026-06-01"
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  // "09:30"
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
});

async function carregarNegocio(slug: string) {
  return prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      profile: { select: { businessHours: true, address: true } },
      services: {
        where: { active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, durationMin: true, priceCents: true },
      },
    },
  });
}

function horariosDoPerfil(businessHours: unknown): Horario[] {
  if (!Array.isArray(businessHours)) return [];
  return businessHours as Horario[];
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
  try {
    const negocio = await carregarNegocio(params.slug);
    if (!negocio) {
      return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
    }

    const url = new URL(request.url);
    const serviceId = url.searchParams.get("serviceId");
    const servico = serviceId
      ? negocio.services.find((s) => s.id === serviceId)
      : negocio.services[0];

    if (!servico) {
      return NextResponse.json({
        negocio: { nome: negocio.name, endereco: negocio.profile?.address ?? "" },
        servicos: negocio.services,
        dias: [],
      });
    }

    const agora = new Date();
    const dias = proximosDias(agora, DIAS_VISIVEIS);

    const ocupados = await prisma.appointment.findMany({
      where: {
        companyId: negocio.id,
        status: { in: ["MARCADO", "CONFIRMADO"] },
        startsAt: { gte: agora, lte: new Date(dias.at(-1)!.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: { startsAt: true, endsAt: true },
    });

    const horarios = horariosDoPerfil(negocio.profile?.businessHours);

    const agenda = dias
      .map((dia) => ({
        dia: dia.toISOString().slice(0, 10),
        horas: calcularSlots({
          dia,
          horarios,
          duracaoMin: servico.durationMin,
          ocupados,
          agora,
          antecedenciaMinutos: ANTECEDENCIA_MIN,
        }),
      }))
      .filter((d) => d.horas.length > 0);

    return NextResponse.json({
      negocio: { nome: negocio.name, endereco: negocio.profile?.address ?? "" },
      servicos: negocio.services,
      servicoSelecionado: servico.id,
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
  // Rota pública: limite por slug protege contra alguém entupir a agenda.
  if (!rateLimit(`agendar:${params.slug}`, { limit: 20, windowMs: 5 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = agendarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }
    const { nome, telefone, serviceId, dia, hora } = parsed.data;

    const negocio = await carregarNegocio(params.slug);
    if (!negocio) {
      return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
    }

    const servico = negocio.services.find((s) => s.id === serviceId);
    if (!servico) {
      return NextResponse.json({ error: "Serviço indisponível" }, { status: 400 });
    }

    const diaData = new Date(`${dia}T00:00:00.000Z`);
    const agora = new Date();

    const ocupados = await prisma.appointment.findMany({
      where: {
        companyId: negocio.id,
        status: { in: ["MARCADO", "CONFIRMADO"] },
        startsAt: {
          gte: diaData,
          lt: new Date(diaData.getTime() + 48 * 60 * 60 * 1000),
        },
      },
      select: { startsAt: true, endsAt: true },
    });

    // Recalcula no servidor: a lista que o navegador viu pode estar velha, e
    // dupla marcação é o pior defeito possível numa agenda — o cliente aparece
    // e não tem cadeira.
    const livres = calcularSlots({
      dia: diaData,
      horarios: horariosDoPerfil(negocio.profile?.businessHours),
      duracaoMin: servico.durationMin,
      ocupados,
      agora,
      antecedenciaMinutos: ANTECEDENCIA_MIN,
    });

    if (!livres.includes(hora)) {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolhe outro?" },
        { status: 409 },
      );
    }

    const [h, m] = hora.split(":").map(Number);
    // Horário local de Brasília convertido para o instante UTC.
    const startsAt = new Date(diaData.getTime() + (h * 60 + m + 180) * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + servico.durationMin * 60 * 1000);

    const cliente = await prisma.customer.upsert({
      where: { companyId_phone: { companyId: negocio.id, phone: telefone } },
      update: { name: nome },
      create: { companyId: negocio.id, name: nome, phone: telefone, source: "LINK" },
      select: { id: true },
    });

    await prisma.appointment.create({
      data: {
        companyId: negocio.id,
        customerId: cliente.id,
        serviceId: servico.id,
        startsAt,
        endsAt,
        source: "LINK",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        confirmacao: {
          negocio: negocio.name,
          servico: servico.name,
          dia,
          hora,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await logError("agendar-criar", error);
    return NextResponse.json({ error: "Não consegui marcar agora" }, { status: 500 });
  }
}
