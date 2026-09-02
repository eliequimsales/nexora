import { NextResponse } from "next/server";
import { z } from "zod";
import { calcularSlots, type Horario } from "@/lib/agenda/disponibilidade";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { entradaPorLink } from "@/lib/agenda/entrada-publica";
import { hashTelefone } from "@/lib/dados/excluir";
import { ehConflitoDeConcorrencia } from "@/lib/agenda/concorrencia";

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

    try {
      await prisma.$transaction(
        async (tx) => {
          const ocupados = await tx.appointment.findMany({
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

          // Recalcula no servidor: a lista que o navegador viu pode estar
          // velha, e dupla marcação é o pior defeito possível numa agenda — o
          // cliente aparece e não tem cadeira.
          const livres = calcularSlots({
            dia: diaData,
            horarios: horariosDoPerfil(negocio.profile?.businessHours),
            duracaoMin: servico.durationMin,
            ocupados,
            agora,
            antecedenciaMinutos: ANTECEDENCIA_MIN,
          });

          if (!livres.includes(hora)) {
            ocupou = true;
            throw new ConflitoDeHorario();
          }

          const [h, m] = hora.split(":").map(Number);
          // Horário local de Brasília convertido para o instante UTC.
          const startsAt = new Date(diaData.getTime() + (h * 60 + m + 180) * 60 * 1000);
          const endsAt = new Date(startsAt.getTime() + servico.durationMin * 60 * 1000);

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
              serviceId: servico.id,
              startsAt,
              endsAt,
              source: "LINK",
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
