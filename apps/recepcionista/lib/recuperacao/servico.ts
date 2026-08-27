/**
 * Monta a Onda de Segunda a partir do banco: lê a base de clientes, calcula o
 * ciclo pessoal de cada um, classifica nas três esteiras e devolve os 12 com
 * o porquê auditável e a mensagem pronta.
 *
 * Regra Zero: nenhum card volta daqui sem uma ação executável junto.
 */

import { prisma } from "@/lib/db";
import { calcularCiclo, medianaDoSegmento, type Ciclo } from "./ciclo";
import { classificar, type Esteira } from "./esteiras";
import { montarOnda, TAMANHO_DA_ONDA } from "./onda";
import { mensagemDoToque, proximoToque } from "./toques";

export type CardDaOnda = {
  id: string;
  clienteId: string;
  nome: string;
  telefone: string;
  esteira: Esteira;
  diasDesdeUltima: number;
  diasAlemDoCiclo: number;
  cicloDias: number;
  confianca: "alta" | "baixa";
  /** Texto do porquê auditável, em português, para o dono conferir. */
  porque: string;
  visitas: number;
  ticketMedioCents: number;
  valorCents: number;
  toque: number;
  mensagem: string;
};

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function textoDoPorque(
  ciclo: Ciclo,
  diasDesdeUltima: number,
  diasAlemDoCiclo: number,
  visitas: number,
  ticketCents: number,
): string {
  if (ciclo.confianca === "baixa") {
    return `${ciclo.motivo} Trate como palpite, não como previsão — você conhece ele melhor que a gente.`;
  }
  const ticket = (ticketCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `O ciclo dele é de ${ciclo.dias} dias. Está ${diasAlemDoCiclo} dias além do normal dele. ${visitas} visitas registradas · ticket médio ${ticket}.`;
}

export async function montarOndaDaSemana(
  companyId: string,
  opcoes: { tamanho?: number; hoje?: Date } = {},
): Promise<{ cards: CardDaOnda[]; totalEmJogoCents: number; composicao: Record<string, number> }> {
  const hoje = opcoes.hoje ?? new Date();
  const tamanho = opcoes.tamanho ?? TAMANHO_DA_ONDA;

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, slug: true, profile: { select: { segments: true } } },
  });

  const segmentos = Array.isArray(empresa?.profile?.segments)
    ? (empresa!.profile!.segments as string[])
    : [];
  const medianaSegmento = medianaDoSegmento(
    segmentos[0]?.toLowerCase().replace(/\s+/g, "-") ?? null,
  );

  const clientes = await prisma.customer.findMany({
    where: { companyId, optOut: false },
    select: {
      id: true,
      name: true,
      phone: true,
      visits: {
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true, valueCents: true },
      },
      appointments: {
        where: { startsAt: { gte: hoje }, status: { in: ["MARCADO", "CONFIRMADO"] } },
        select: { id: true },
      },
      touches: { select: { touchNumber: true, sentAt: true, outcome: true } },
    },
  });

  const candidatos = clientes.map((c) => {
    const datas = c.visits.map((v) => v.occurredAt);
    const ciclo = calcularCiclo(datas, medianaSegmento);
    const classificacao = classificar({
      ultimaVisita: datas[0] ?? null,
      ciclo,
      temAgendamentoFuturo: c.appointments.length > 0,
      hoje,
    });

    const gasto = c.visits.reduce((s, v) => s + v.valueCents, 0);
    const ticketMedio = c.visits.length > 0 ? Math.round(gasto / c.visits.length) : 0;

    // Sequência ainda viva? Quem já respondeu ou voltou sai da fila.
    const respondeu = c.touches.some((t) =>
      ["VOLTOU", "MARCOU", "RESPONDEU"].includes(t.outcome),
    );
    const enviados = c.touches
      .filter((t) => t.outcome !== "PULADO")
      .map((t) => ({ touchNumber: t.touchNumber, sentAt: t.sentAt }));
    const proximo = respondeu ? null : proximoToque(enviados, hoje);

    return {
      id: c.id,
      clienteId: c.id,
      nome: c.name,
      telefone: c.phone,
      esteira: classificacao.esteira,
      diasDesdeUltima: classificacao.diasDesdeUltima,
      diasAlemDoCiclo: classificacao.diasAlemDoCiclo,
      cicloDias: ciclo.dias,
      confianca: ciclo.confianca,
      porque: textoDoPorque(
        ciclo,
        classificacao.diasDesdeUltima,
        classificacao.diasAlemDoCiclo,
        ciclo.visitas,
        ticketMedio,
      ),
      visitas: ciclo.visitas,
      ticketMedioCents: ticketMedio,
      // Dinheiro em jogo = o que ele JÁ gastou por visita. Fato, não projeção.
      valorCents: ticketMedio,
      toqueVencido: proximo?.vencido ?? false,
      proximoToqueNumero: proximo?.numero ?? null,
      esgotouSequencia: proximo === null,
    };
  });

  const elegiveis = candidatos.filter((c) => !c.esgotouSequencia);
  const escolhidos = montarOnda(elegiveis, tamanho);

  const link = empresa?.slug ? `nexora.app/agendar/${empresa.slug}` : "";

  const cards: CardDaOnda[] = escolhidos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    nome: c.nome,
    telefone: c.telefone,
    esteira: c.esteira,
    diasDesdeUltima: c.diasDesdeUltima,
    diasAlemDoCiclo: c.diasAlemDoCiclo,
    cicloDias: c.cicloDias,
    confianca: c.confianca,
    porque: c.porque,
    visitas: c.visitas,
    ticketMedioCents: c.ticketMedioCents,
    valorCents: c.valorCents,
    toque: c.proximoToqueNumero ?? 1,
    mensagem: mensagemDoToque(c.proximoToqueNumero ?? 1, {
      primeiroNome: primeiroNome(c.nome),
      negocio: empresa?.name ?? "",
      link,
    }),
  }));

  const composicao = cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.esteira] = (acc[c.esteira] ?? 0) + 1;
    return acc;
  }, {});

  return {
    cards,
    totalEmJogoCents: cards.reduce((s, c) => s + c.valorCents, 0),
    composicao,
  };
}
