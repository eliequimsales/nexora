import { prisma } from "@/lib/db";
import { localDe } from "./datas";
import { fimDaSemanaGratis } from "./portao";

/**
 * O USO DO ATENDENTE — CONTADO EM CONVERSAS ATENDIDAS POR DIA.
 *
 * Uma conversa atendida num dia de Brasília é uma linha em
 * `AtendenteAtendimento`: a mesma pessoa em dois dias conta duas. É o que dá
 * para contar sem ambiguidade, e o que o painel mostra ao dono ("37 de 200
 * conversas neste mês").
 */

export function mesDoDia(dia: string): string {
  return dia.slice(0, 7);
}

export async function usoDoAtendente(
  companyId: string,
  agora: Date,
): Promise<{ conversasNoMes: number; conversasNaSemana: number; primeiraVezEm: Date | null }> {
  const perfil = await prisma.companyProfile.findUnique({
    where: { companyId },
    select: { atendenteLigadoPrimeiraVezEm: true },
  });
  const primeiraVezEm = perfil?.atendenteLigadoPrimeiraVezEm ?? null;

  // Só linha com resposta é conversa atendida: o aviso de teto grava zero
  // respostas, para marcar o dia sem entrar na conta.
  const conversasNoMes = await prisma.atendenteAtendimento.count({
    where: { companyId, respostas: { gt: 0 }, dia: { startsWith: mesDoDia(localDe(agora).data) } },
  });
  const conversasNaSemana = primeiraVezEm
    ? await prisma.atendenteAtendimento.count({
        where: {
          companyId,
          respostas: { gt: 0 },
          criadoEm: { gte: primeiraVezEm, lt: fimDaSemanaGratis(primeiraVezEm) },
        },
      })
    : 0;

  return { conversasNoMes, conversasNaSemana, primeiraVezEm };
}

export type RegistroDeAtendimento = {
  companyId: string;
  conversationId: string;
  dia: string;
  foraDoHorario: boolean;
  clienteNome: string | null;
  clienteTelefone: string;
  respostas: number;
  marcados?: number;
  valorMarcadoCents?: number;
  precisaDoDono?: boolean;
  motivo?: string;
  urgente?: boolean;
};

/** Soma na linha da conversa do dia; cria a linha na primeira resposta. */
export async function registrarAtendimento(r: RegistroDeAtendimento): Promise<void> {
  const marcados = r.marcados ?? 0;
  const valor = r.valorMarcadoCents ?? 0;
  await prisma.atendenteAtendimento.upsert({
    where: { conversationId_dia: { conversationId: r.conversationId, dia: r.dia } },
    create: {
      companyId: r.companyId,
      conversationId: r.conversationId,
      dia: r.dia,
      foraDoHorario: r.foraDoHorario,
      clienteNome: r.clienteNome,
      clienteTelefone: r.clienteTelefone,
      respostas: r.respostas,
      marcados,
      valorMarcadoCents: valor,
      precisaDoDono: r.precisaDoDono ?? false,
      motivo: (r.motivo ?? "").slice(0, 200),
      urgente: r.urgente ?? false,
    },
    update: {
      respostas: { increment: r.respostas },
      marcados: { increment: marcados },
      valorMarcadoCents: { increment: valor },
      ...(r.clienteNome ? { clienteNome: r.clienteNome } : {}),
      // Uma anotação nova volta para a fila do dono, mesmo que a anterior já
      // tenha sido resolvida.
      ...(r.precisaDoDono ? { precisaDoDono: true, motivo: (r.motivo ?? "").slice(0, 200), resolvidoEm: null } : {}),
      ...(r.urgente ? { urgente: true } : {}),
    },
  });
}

/** A linha da conversa no dia, para saber se já houve apresentação e quantas respostas. */
export async function atendimentoDoDia(conversationId: string, dia: string) {
  return prisma.atendenteAtendimento.findUnique({
    where: { conversationId_dia: { conversationId, dia } },
    select: { respostas: true },
  });
}
