import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { lerConfiguracaoPublicada } from "@/lib/atendente/configuracao";
import { calcularSlots } from "./disponibilidade";
import { ehConflitoDeConcorrencia } from "./concorrencia";
import { horarioDaEmpresa, lerDiasFechados } from "./horario";
import { ANTECEDENCIA_MINUTOS } from "./livres";
import { extrairProfissional, formatarDataLocal, formatarHoraLocal } from "./painel";

export type PoliticaGestaoReservas = { cancelar: boolean; remarcar: boolean; antecedenciaHoras: number | null };
export type ReservaDoCliente = {
  id: string; servicoId: string | null; servicoNome: string;
  inicio: string; fim: string; profissional: string | null; versao: string;
};
export type PedidoGestaoReserva = {
  companyId: string; conversaId: string; operacaoId: string; telefone: string;
  acao: "CANCELAR" | "REMARCAR"; reserva: ReservaDoCliente;
  novaOpcao?: { inicio: string; fim: string; profissional: string | null };
  agora: Date;
};
export type ResultadoGestaoReserva =
  | { estado: "CONCLUIDA"; acao: "CANCELAR" | "REMARCAR"; reserva: ReservaDoCliente; reutilizada: boolean }
  | { estado: "INDISPONIVEL"; motivo: "AUTORIZACAO" | "CLIENTE" | "RESERVA" | "ANTECEDENCIA" | "OCUPADO" | "ALTERADA" }
  | { estado: "DESCONHECIDA" };

const ATIVAS = ["MARCADO", "CONFIRMADO"];
const selecionar = { id: true, serviceId: true, startsAt: true, endsAt: true, notes: true, updatedAt: true,
  status: true, customerId: true, service: { select: { name: true, companyId: true } } } as const;
type Registro = { id: string; serviceId: string | null; startsAt: Date; endsAt: Date; notes: string;
  updatedAt: Date; status: string; customerId: string; service: { name: string; companyId: string } | null };

function notas(texto: string): Record<string, unknown> {
  try { const v = JSON.parse(texto); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* anotação antiga */ }
  return texto ? { observacoes: texto } : {};
}
function representar(a: Registro): ReservaDoCliente {
  const dados = notas(a.notes);
  return { id: a.id, servicoId: a.serviceId, servicoNome: a.service?.name || (typeof dados.servicoNome === "string" ? dados.servicoNome : "Atendimento"),
    inicio: a.startsAt.toISOString(), fim: a.endsAt.toISOString(), profissional: extrairProfissional(a.notes) || null,
    versao: a.updatedAt.toISOString() };
}
function telefones(telefone: string): string[] {
  const limpo = telefone.replace(/\D/g, "");
  return /^\d{10,15}$/.test(limpo) ? [...new Set([limpo, ...variantesDeTelefone(limpo)])] : [];
}
export function politicaPermite(politica: PoliticaGestaoReservas | undefined, acao: "CANCELAR" | "REMARCAR", inicio: string, agora: Date): boolean {
  const horas = politica?.antecedenciaHoras;
  const data = new Date(inicio).getTime();
  return Boolean(politica && politica[acao === "CANCELAR" ? "cancelar" : "remarcar"] === true
    && typeof horas === "number" && Number.isInteger(horas) && horas >= 0 && horas <= 8760
    && Number.isFinite(data) && data > agora.getTime() && data - agora.getTime() >= horas * 3_600_000);
}

/** A identidade vem do canal; texto digitado pelo cliente nunca escolhe outro titular. */
export async function listarReservasDoCliente(p: { companyId: string; telefone: string; agora: Date }): Promise<ReservaDoCliente[]> {
  const variantes = telefones(p.telefone);
  if (!p.companyId.trim() || !variantes.length) return [];
  const agendamentos = await prisma.appointment.findMany({
    where: { companyId: p.companyId, customer: { companyId: p.companyId, phone: { in: variantes } },
      status: { in: ATIVAS }, startsAt: { gt: p.agora } },
    orderBy: { startsAt: "asc" }, take: 9, select: selecionar,
  });
  return agendamentos.filter(a => !a.service || a.service.companyId === p.companyId).map(representar);
}

/** Confirmação + versão da reserva + política publicada são revalidadas na transação. */
export async function alterarReservaNaAgenda(p: PedidoGestaoReserva): Promise<ResultadoGestaoReserva> {
  const variantes = telefones(p.telefone);
  if (![p.companyId, p.conversaId, p.operacaoId, p.reserva.id].every(v => typeof v === "string" && v.trim()) || !variantes.length
    || !Number.isFinite(p.agora.getTime())) return { estado: "INDISPONIVEL", motivo: "CLIENTE" };
  const chave = createHash("sha256").update(JSON.stringify([p.companyId, p.conversaId, p.operacaoId, p.acao])).digest("hex");
  const assinatura = createHash("sha256").update(JSON.stringify([p.reserva, p.novaOpcao ?? null, p.telefone.replace(/\D/g, "")])).digest("hex");
  const filtro = { id: p.reserva.id, companyId: p.companyId,
    customer: { companyId: p.companyId, phone: { in: variantes } } };
  type Leitor = Pick<typeof prisma, "appointment">;
  const recuperar = async (db: Leitor): Promise<ResultadoGestaoReserva | null> => {
    const atual = await db.appointment.findFirst({ where: filtro, select: selecionar });
    if (!atual) return null;
    const registros = notas(atual.notes)._nexoraGestao;
    if (!Array.isArray(registros)) return null;
    const operacao = registros.find((v: unknown) => !!v && typeof v === "object" && (v as Record<string, unknown>).chave === chave);
    if (!operacao) return null;
    if (operacao.assinatura !== assinatura || operacao.acao !== p.acao || operacao.versao !== atual.updatedAt.toISOString()
      || (p.acao === "CANCELAR" ? atual.status !== "CANCELADO" : !ATIVAS.includes(atual.status)
        || atual.startsAt.toISOString() !== p.novaOpcao?.inicio || atual.endsAt.toISOString() !== p.novaOpcao?.fim)) return { estado: "DESCONHECIDA" };
    return { estado: "CONCLUIDA", acao: p.acao, reserva: representar(atual), reutilizada: true };
  };
  try {
    return await prisma.$transaction(async tx => {
      const anterior = await recuperar(tx);
      if (anterior) return anterior;
      const atual = await tx.appointment.findFirst({ where: filtro, select: selecionar });
      if (!atual || !ATIVAS.includes(atual.status) || (atual.service && atual.service.companyId !== p.companyId)) return { estado: "INDISPONIVEL" as const, motivo: "RESERVA" as const };
      if (atual.updatedAt.toISOString() !== p.reserva.versao || atual.startsAt.toISOString() !== p.reserva.inicio
        || atual.endsAt.toISOString() !== p.reserva.fim || atual.serviceId !== p.reserva.servicoId) return { estado: "INDISPONIVEL" as const, motivo: "ALTERADA" as const };
      const perfil = await tx.companyProfile.findUnique({ where: { companyId: p.companyId },
        select: { atendenteConfiguracao: true, businessHours: true, diasFechados: true, serviceRules: true } });
      const publicada = lerConfiguracaoPublicada(perfil?.atendenteConfiguracao);
      const politica = publicada?.atendimento.gestaoReservas;
      const conversa = await tx.conversation.findFirst({ where: { id: p.conversaId, companyId: p.companyId, customerPhone: { in: variantes } },
        select: { status: true, donoAssumiuEm: true, messages: { where: { role: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } } });
      if (!conversa || conversa.status !== "AI" || conversa.donoAssumiuEm || conversa.messages[0]?.id !== p.operacaoId
        || publicada?.atendimento.agendamento !== "DIRETO" || !politica || politica[p.acao === "CANCELAR" ? "cancelar" : "remarcar"] !== true
        || politica.antecedenciaHoras === null) return { estado: "INDISPONIVEL" as const, motivo: "AUTORIZACAO" as const };
      if (!politicaPermite(politica, p.acao, atual.startsAt.toISOString(), p.agora)) return { estado: "INDISPONIVEL" as const, motivo: "ANTECEDENCIA" as const };
      let novaData: Date | undefined; let novoFim: Date | undefined;
      if (p.acao === "REMARCAR") {
        const nova = p.novaOpcao;
        if (!nova || !atual.serviceId) return { estado: "INDISPONIVEL" as const, motivo: "RESERVA" as const };
        const servico = publicada?.informacoes.servicos.find(s => s.id === atual.serviceId && s.situacao === "CONFIRMADO");
        const cadastro = await tx.service.findFirst({ where: { id: atual.serviceId, companyId: p.companyId, active: true, suggested: false }, select: { durationMin: true } });
        const duracao = (atual.endsAt.getTime() - atual.startsAt.getTime()) / 60_000;
        novaData = new Date(nova.inicio); novoFim = new Date(nova.fim);
        if (!servico || !cadastro || !Number.isInteger(duracao) || duracao <= 0 || cadastro.durationMin !== duracao || servico.duracaoMin !== duracao
          || !Number.isFinite(novaData.getTime()) || !Number.isFinite(novoFim.getTime()) || novoFim.getTime() - novaData.getTime() !== duracao * 60_000
          || (nova.profissional !== null && nova.profissional !== extrairProfissional(atual.notes))) return { estado: "INDISPONIVEL" as const, motivo: "ALTERADA" as const };
        const dia = formatarDataLocal(novaData);
        if (lerDiasFechados(perfil?.diasFechados).includes(dia)) return { estado: "INDISPONIVEL" as const, motivo: "OCUPADO" as const };
        const ocupados = await tx.appointment.findMany({ where: { companyId: p.companyId, id: { not: atual.id },
          status: { in: ATIVAS }, startsAt: { lt: novoFim }, endsAt: { gt: novaData } }, select: { startsAt: true, endsAt: true, notes: true } });
        const profissionalAtual = extrairProfissional(atual.notes);
        let capacidadeMultipla = false;
        try { const equipe = JSON.parse(perfil?.serviceRules ?? "[]"); capacidadeMultipla = Array.isArray(equipe) && equipe.length > 1; } catch { /* Sem equipe confiável: capacidade única. */ }
        const slots = calcularSlots({ dia: new Date(`${dia}T00:00:00.000Z`), horarios: horarioDaEmpresa(perfil?.businessHours), duracaoMin: duracao,
          ocupados: ocupados.filter(a => !capacidadeMultipla || extrairProfissional(a.notes) === profissionalAtual || !notas(a.notes).profissional),
          agora: p.agora, antecedenciaMinutos: ANTECEDENCIA_MINUTOS });
        if (!slots.includes(formatarHoraLocal(novaData)) || novaData.getUTCSeconds() !== 0 || novaData.getUTCMilliseconds() !== 0) return { estado: "INDISPONIVEL" as const, motivo: "OCUPADO" as const };
      }
      const versao = new Date(Math.max(Date.now(), atual.updatedAt.getTime() + 1));
      const dados = notas(atual.notes);
      const historico = Array.isArray(dados._nexoraGestao) ? dados._nexoraGestao.slice(-31) : [];
      const alteradas = await tx.appointment.updateMany({ where: { id: atual.id, companyId: p.companyId, customerId: atual.customerId,
        updatedAt: atual.updatedAt, status: atual.status }, data: {
          ...(p.acao === "CANCELAR" ? { status: "CANCELADO" } : { startsAt: novaData, endsAt: novoFim }), updatedAt: versao,
          notes: JSON.stringify({ ...dados, _nexoraGestao: [...historico, { chave, assinatura, acao: p.acao, versao: versao.toISOString(),
            anterior: { inicio: atual.startsAt.toISOString(), fim: atual.endsAt.toISOString() }, em: p.agora.toISOString() }] }),
        } });
      if (alteradas.count !== 1) return { estado: "INDISPONIVEL" as const, motivo: "ALTERADA" as const };
      const comprovada = await recuperar(tx);
      return comprovada?.estado === "CONCLUIDA" ? { ...comprovada, reutilizada: false } : { estado: "DESCONHECIDA" as const };
    }, { isolationLevel: "Serializable" });
  } catch (erro) {
    try { const anterior = await recuperar(prisma); if (anterior) return anterior; } catch { return { estado: "DESCONHECIDA" }; }
    return ehConflitoDeConcorrencia(erro) ? { estado: "INDISPONIVEL", motivo: "ALTERADA" } : { estado: "DESCONHECIDA" };
  }
}
