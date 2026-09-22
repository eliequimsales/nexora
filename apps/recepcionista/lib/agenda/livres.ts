import { prisma } from "@/lib/db";
import { calcularSlots, type Horario } from "./disponibilidade";
import { horarioDaEmpresa, lerDiasFechados } from "./horario";
import { extrairProfissional, listarProfissionais, PROFISSIONAIS_PADRAO, type Profissional } from "./painel";

/**
 * O QUE ESTÁ LIVRE NA AGENDA — E COM QUEM.
 *
 * A mesma regra da página pública (app/api/agendar/[slug]): um horário está
 * livre se ao menos um profissional estiver livre; sem equipe cadastrada, a
 * agenda é uma só. O Atendente usa isto para oferecer três horários, e a
 * marcação (lib/agenda/marcacao.ts) confere de novo dentro da transação.
 */

/** Antecedência mínima para marcar — a mesma da página pública. */
export const ANTECEDENCIA_MINUTOS = 60;

export type Livre = { inicio: Date; fim: Date; profissional: string | null };

type Agendado = { startsAt: Date; endsAt: Date; notes: string };

/** A equipe de exemplo que a agenda mostra antes de o dono cadastrar a dele. */
export function ehEquipeDeExemplo(equipe: Profissional[]): boolean {
  return (
    equipe.length === PROFISSIONAIS_PADRAO.length &&
    equipe.every((p, i) => p.id === PROFISSIONAIS_PADRAO[i].id && p.nome === PROFISSIONAIS_PADRAO[i].nome)
  );
}

function instante(dia: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(new Date(`${dia}T00:00:00.000Z`).getTime() + (h * 60 + m + 180) * 60_000);
}

/**
 * Os horários livres de um dia, cada um com o primeiro profissional livre (na
 * ordem da equipe). Com profissional pedido, só os dele. `mostrarProfissional`
 * falso é a equipe de exemplo: o horário vale, mas o nome não vai para o cliente.
 */
export function livresDoDia(p: {
  dia: string;
  horarios: Horario[];
  duracaoMin: number;
  agendamentos: Agendado[];
  profissionais: string[];
  mostrarProfissional: boolean;
  agora: Date;
  profissional?: string | null;
}): Livre[] {
  const diaData = new Date(`${p.dia}T00:00:00.000Z`);
  const slotsDe = (ocupados: Agendado[]) =>
    calcularSlots({
      dia: diaData,
      horarios: p.horarios,
      duracaoMin: p.duracaoMin,
      ocupados: ocupados.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
      agora: p.agora,
      antecedenciaMinutos: ANTECEDENCIA_MINUTOS,
    });
  const doProfissional = (nome: string) =>
    p.agendamentos.filter((a) => extrairProfissional(a.notes).toLowerCase() === nome.toLowerCase());
  const livre = (hhmm: string, profissional: string | null): Livre => {
    const inicio = instante(p.dia, hhmm);
    return {
      inicio,
      fim: new Date(inicio.getTime() + p.duracaoMin * 60_000),
      profissional: p.mostrarProfissional ? profissional : null,
    };
  };

  if (p.profissional) {
    return slotsDe(doProfissional(p.profissional)).map((h) => livre(h, p.profissional!));
  }

  if (p.profissionais.length === 0) {
    return slotsDe(p.agendamentos).map((h) => livre(h, null));
  }

  const primeiroLivre = new Map<string, string>();
  for (const nome of p.profissionais) {
    for (const h of slotsDe(doProfissional(nome))) {
      if (!primeiroLivre.has(h)) primeiroLivre.set(h, nome);
    }
  }
  return [...primeiroLivre.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([h, nome]) => livre(h, nome));
}

/** Os livres de vários dias, lendo a agenda e a equipe da empresa. */
export async function horariosLivres(p: {
  companyId: string;
  duracaoMin: number;
  dias: string[];
  agora: Date;
  profissional?: string | null;
}): Promise<Livre[]> {
  if (p.dias.length === 0) return [];
  const [perfil, equipe] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { companyId: p.companyId },
      select: { businessHours: true, diasFechados: true },
    }),
    listarProfissionais(p.companyId),
  ]);
  const horarios = horarioDaEmpresa(perfil?.businessHours);
  const fechados = lerDiasFechados(perfil?.diasFechados);
  const dias = p.dias.filter((d) => !fechados.includes(d));
  if (dias.length === 0) return [];

  const inicio = new Date(`${dias[0]}T00:00:00.000Z`);
  const fim = new Date(new Date(`${dias.at(-1)}T00:00:00.000Z`).getTime() + 48 * 60 * 60_000);
  const agendamentos = await prisma.appointment.findMany({
    where: {
      companyId: p.companyId,
      status: { in: ["MARCADO", "CONFIRMADO"] },
      startsAt: { gte: inicio, lt: fim },
    },
    select: { startsAt: true, endsAt: true, notes: true },
  });

  const mostrarProfissional = !ehEquipeDeExemplo(equipe);
  return dias.flatMap((dia) =>
    livresDoDia({
      dia,
      horarios,
      duracaoMin: p.duracaoMin,
      agendamentos,
      profissionais: equipe.map((e) => e.nome),
      mostrarProfissional,
      agora: p.agora,
      profissional: p.profissional,
    }),
  );
}
