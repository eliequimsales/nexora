import { createHash } from "node:crypto";
import { z } from "zod";
import type { Livre } from "@/lib/agenda/livres";
import type { PedidoDeMarcacao, ResultadoDaMarcacao } from "@/lib/agenda/marcacao";
import { localDe } from "./datas";
import type { Fatos, ServicoDoAtendente } from "./fatos";

/** O modelo escolhe IDs e datas. Empresa, cliente, preço e autorização vêm do servidor. */
const id = z.string().trim().min(1).max(160);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const data = new Date(`${v}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === v;
}, "Dia inválido");
const instante = z.string().datetime({ offset: true }).refine((v) => {
  const data = new Date(v);
  return Number.isFinite(data.getTime()) && data.getUTCSeconds() === 0 && data.getUTCMilliseconds() === 0;
}, "Informe o início no minuto exato, com fuso horário");
const profissional = z.string().trim().min(1).max(120).nullable().optional();

export const AcaoAtendenteSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("consultar_horarios"), servicoId: id,
    dias: z.array(dia).min(1).max(14), profissional }).strict(),
  z.object({ acao: z.literal("reservar_horario"), servicoId: id,
    inicio: instante, profissional }).strict(),
  z.object({ acao: z.literal("solicitar_link_pagamento"), servicoId: id }).strict(),
]);
export type AcaoAtendente = z.infer<typeof AcaoAtendenteSchema>;

/** Produzida pelo fluxo de confirmação do servidor, nunca por argumentos da IA. */
export type ConfirmacaoDaAcao =
  | { acao: "reservar_horario"; mensagemClienteId: string; servicoId: string;
      inicio: string; profissional: string | null }
  | { acao: "solicitar_link_pagamento"; mensagemClienteId: string; servicoId: string };

export type ContextoDasAcoes = {
  companyId: string;
  conversaId: string;
  /** ID estável da solicitação original. Um retry deve conservar este ID. */
  operacaoId: string;
  fatos: Fatos;
  cliente: { nome: string; telefone: string };
  agora: Date;
  confirmacao?: ConfirmacaoDaAcao | null;
  simulacao?: boolean;
  /** Snapshot local fornecido pelo simulador. O despacho simulado não consulta banco ou rede. */
  horariosSimulados?: Livre[];
};

export type PedidoDeConsultaDaAcao = {
  companyId: string; servico: ServicoDoAtendente; dias: string[];
  profissional: string | null; agora: Date;
};

type ProvedorDePagamento = "STRIPE_CONNECT" | "MERCADO_PAGO";
export type PedidoDeLinkDaAcao = {
  companyId: string; merchantId: string; provedor: ProvedorDePagamento;
  servicoId: string; descricao: string; valorCents: number; moeda: "BRL";
  cliente: { nome: string; telefone: string }; chaveOperacao: string;
};

/**
 * Contrato futuro de cobrança do próprio estabelecimento. Não há adaptador
 * merchant no produto hoje; o billing da assinatura Nexora nunca é reutilizado.
 * O adaptador deve persistir a chave no provedor e reconciliar retries/timeouts.
 */
export type AdaptadorDePagamentoDaEmpresa = {
  companyId: string; merchantId: string; provedor: ProvedorDePagamento;
  status: "ATIVO"; idempotencia: "PERSISTENTE"; hostsPermitidos: readonly string[];
  criarLink: (pedido: PedidoDeLinkDaAcao) => Promise<
    | { estado: "CONCLUIDA"; companyId: string; merchantId: string; provedor: ProvedorDePagamento;
        servicoId: string; valorCents: number; moeda: "BRL"; chaveOperacao: string;
        cobrancaId: string; url: string; reutilizada?: boolean }
    | { estado: "INDISPONIVEL" | "PENDENTE" | "DESCONHECIDA" }
  >;
};

export type DependenciasDasAcoes = {
  agenda?: {
    /** Vinculada pelo servidor à mesma empresa autenticada do contexto. */
    companyId: string;
    livres: (pedido: PedidoDeConsultaDaAcao) => Promise<Livre[]>;
    /** Usar marcarNaAgenda: transação serializável e recuperação pela chave persistida. */
    marcar: (pedido: PedidoDeMarcacao) => Promise<ResultadoDaMarcacao>;
  };
  pagamento?: AdaptadorDePagamentoDaEmpresa;
};

type MotivoDaAcao = "ARGUMENTOS_INVALIDOS" | "CONTEXTO_INVALIDO" | "CAPACIDADE_INDISPONIVEL"
  | "SERVICO_NAO_AUTORIZADO" | "PROFISSIONAL_NAO_AUTORIZADO" | "DATA_INVALIDA"
  | "CONFIRMACAO_NECESSARIA" | "CLIENTE_INCOMPLETO" | "HORARIO_OCUPADO"
  | "CONSULTA_FALHOU" | "RESULTADO_NAO_COMPROVADO" | "AGUARDANDO_PROVEDOR";
export type ResultadoDaAcao =
  | { estado: "CONCLUIDA"; acao: "consultar_horarios"; horarios: Livre[]; fonte: "AGENDA" }
  | { estado: "CONCLUIDA"; acao: "reservar_horario"; reserva: Extract<ResultadoDaMarcacao, { ok: true }> & { appointmentId: string }; fonte: "AGENDA" }
  | { estado: "CONCLUIDA"; acao: "solicitar_link_pagamento"; cobrancaId: string; url: string;
      valorCents: number; reutilizada: boolean; fonte: "PROVEDOR_DA_EMPRESA" }
  | { estado: "SIMULADA"; acao: AcaoAtendente["acao"]; horarios?: Livre[] }
  | { estado: "INDISPONIVEL" | "PENDENTE" | "DESCONHECIDA"; acao?: AcaoAtendente["acao"]; motivo: MotivoDaAcao };

function pagamentoDisponivel(c: ContextoDasAcoes, d: DependenciasDasAcoes): boolean {
  const p = d.pagamento;
  return Boolean(p && p.companyId === c.companyId && p.merchantId?.trim()
    && ["STRIPE_CONNECT", "MERCADO_PAGO"].includes(p.provedor) && p.status === "ATIVO"
    && p.idempotencia === "PERSISTENTE" && p.hostsPermitidos?.length && typeof p.criarLink === "function");
}

export function capacidadesDoAtendente(c: ContextoDasAcoes, d: DependenciasDasAcoes) {
  const agenda = !c.fatos.configuracaoDivergente && c.fatos.agendamento !== "DESLIGADO" && c.fatos.horarios.length > 0
    && (c.simulacao ? Array.isArray(c.horariosSimulados) : d.agenda?.companyId === c.companyId);
  const servicoAgendavel = c.fatos.servicos.some((s) => Number.isInteger(s.duracaoMin) && s.duracaoMin > 0);
  return {
    consultar_horarios: Boolean(agenda && servicoAgendavel),
    reservar_horario: Boolean(agenda && servicoAgendavel && c.fatos.marcaDireto
      && (c.fatos.agendamento === undefined || c.fatos.agendamento === "DIRETO")),
    solicitar_link_pagamento: !c.simulacao && !c.fatos.configuracaoDivergente && pagamentoDisponivel(c, d)
      && c.fatos.servicos.some((s) => s.precoModo !== "SOB_CONSULTA" && Number.isSafeInteger(s.precoCents) && s.precoCents > 0),
  };
}

/** Chave estável por solicitação, sem telefone nem dados sensíveis em logs do provedor. */
export function chaveDaAcao(c: Pick<ContextoDasAcoes, "companyId" | "conversaId" | "operacaoId">,
  acao: AcaoAtendente["acao"]): string {
  return `atendente:${createHash("sha256").update(JSON.stringify([c.companyId, c.conversaId, c.operacaoId, acao])).digest("hex")}`;
}

function confirmada(a: AcaoAtendente, c: ContextoDasAcoes): boolean {
  const q = c.confirmacao;
  if (!q?.mensagemClienteId?.trim() || q.acao !== a.acao || q.servicoId !== a.servicoId) return false;
  if (a.acao !== "reservar_horario") return q.acao === "solicitar_link_pagamento";
  return q.acao === "reservar_horario" && new Date(q.inicio).getTime() === new Date(a.inicio).getTime()
    && (q.profissional ?? null) === (a.profissional ?? null);
}

function horarioValido(h: Livre, s: ServicoDoAtendente, c: ContextoDasAcoes, dias: string[], nome: string | null): boolean {
  return h.inicio instanceof Date && h.fim instanceof Date && Number.isFinite(h.inicio.getTime())
    && h.inicio > c.agora && h.fim.getTime() - h.inicio.getTime() === s.duracaoMin * 60_000
    && dias.includes(localDe(h.inicio).data) && !c.fatos.diasFechados.includes(localDe(h.inicio).data)
    && (!nome || h.profissional === nome)
    && (!h.profissional || !c.fatos.profissionais.length || c.fatos.profissionais.includes(h.profissional));
}

/**
 * Barreira única antes de executar uma chamada estruturada. Ausência de prova
 * nunca vira sucesso. Falha após iniciar escrita é DESCONHECIDA: não prometer
 * rollback, reenviar cobrança ou inventar ID. O mesmo retry conserva a chave.
 */
export async function executarAcaoAtendente(entrada: unknown, c: ContextoDasAcoes,
  d: DependenciasDasAcoes): Promise<ResultadoDaAcao> {
  const validada = AcaoAtendenteSchema.safeParse(entrada);
  if (!validada.success) return { estado: "INDISPONIVEL", motivo: "ARGUMENTOS_INVALIDOS" };
  const a = validada.data;
  const falha = (estado: "INDISPONIVEL" | "PENDENTE" | "DESCONHECIDA", motivo: MotivoDaAcao): ResultadoDaAcao => ({ estado, acao: a.acao, motivo });
  if (![c.companyId, c.conversaId, c.operacaoId].every((v) => typeof v === "string" && v.trim())
    || !(c.agora instanceof Date) || !Number.isFinite(c.agora.getTime())) return falha("INDISPONIVEL", "CONTEXTO_INVALIDO");
  const s = c.fatos.servicos.find((servico) => servico.id === a.servicoId);
  if (!s) return falha("INDISPONIVEL", "SERVICO_NAO_AUTORIZADO");
  const nome = a.acao === "solicitar_link_pagamento" ? null : a.profissional ?? null;
  if (nome && !c.fatos.profissionais.includes(nome)) return falha("INDISPONIVEL", "PROFISSIONAL_NAO_AUTORIZADO");
  if (a.acao !== "solicitar_link_pagamento" && (!Number.isInteger(s.duracaoMin) || s.duracaoMin <= 0)) {
    return falha("INDISPONIVEL", "SERVICO_NAO_AUTORIZADO");
  }
  if (!capacidadesDoAtendente(c, d)[a.acao]) return falha("INDISPONIVEL", "CAPACIDADE_INDISPONIVEL");

  if (a.acao === "consultar_horarios") {
    const hoje = localDe(c.agora).data;
    const dias = [...new Set(a.dias)].filter((v) => v >= hoje && !c.fatos.diasFechados.includes(v)).sort();
    if (!dias.length) return falha("INDISPONIVEL", "DATA_INVALIDA");
    try {
      const encontrados = c.simulacao ? c.horariosSimulados! : await d.agenda!.livres({
        companyId: c.companyId, servico: { ...s }, dias, profissional: nome, agora: c.agora,
      });
      const horarios = encontrados.filter((h) => horarioValido(h, s, c, dias, nome))
        .sort((h1, h2) => h1.inicio.getTime() - h2.inicio.getTime());
      return c.simulacao ? { estado: "SIMULADA", acao: a.acao, horarios }
        : { estado: "CONCLUIDA", acao: a.acao, horarios, fonte: "AGENDA" };
    } catch { return falha("INDISPONIVEL", "CONSULTA_FALHOU"); }
  }

  if (!confirmada(a, c)) return falha("PENDENTE", "CONFIRMACAO_NECESSARIA");
  if (!c.cliente.nome.trim() || !/^\d{10,15}$/.test(c.cliente.telefone.replace(/\D/g, ""))) {
    return falha("PENDENTE", "CLIENTE_INCOMPLETO");
  }
  const chaveOperacao = chaveDaAcao(c, a.acao);

  if (a.acao === "reservar_horario") {
    const inicio = new Date(a.inicio);
    const data = localDe(inicio).data;
    if (inicio <= c.agora || c.fatos.diasFechados.includes(data)) return falha("INDISPONIVEL", "DATA_INVALIDA");
    if (c.simulacao) {
      const livre = c.horariosSimulados!.some((h) => h.inicio.getTime() === inicio.getTime()
        && horarioValido(h, s, c, [data], nome));
      return livre ? { estado: "SIMULADA", acao: a.acao } : falha("INDISPONIVEL", "HORARIO_OCUPADO");
    }
    try {
      const r = await d.agenda!.marcar({ companyId: c.companyId,
        servico: { id: s.id, nome: s.nome, duracaoMin: s.duracaoMin }, inicio,
        profissional: nome, cliente: { ...c.cliente }, origem: "ATENDENTE", chaveOperacao, agora: c.agora,
      });
      if (!r.ok) return falha(r.motivo === "OCUPADO" ? "INDISPONIVEL" : "DESCONHECIDA",
        r.motivo === "OCUPADO" ? "HORARIO_OCUPADO" : "RESULTADO_NAO_COMPROVADO");
      if (!r.appointmentId?.trim() || !(r.inicio instanceof Date) || !(r.fim instanceof Date)
        || r.inicio.getTime() !== inicio.getTime() || r.fim.getTime() !== inicio.getTime() + s.duracaoMin * 60_000
        || !r.profissional?.trim() || (nome && r.profissional !== nome)) {
        return falha("DESCONHECIDA", "RESULTADO_NAO_COMPROVADO");
      }
      return { estado: "CONCLUIDA", acao: a.acao, reserva: { ...r, appointmentId: r.appointmentId }, fonte: "AGENDA" };
    } catch { return falha("DESCONHECIDA", "RESULTADO_NAO_COMPROVADO"); }
  }

  if (s.precoModo === "SOB_CONSULTA" || !Number.isSafeInteger(s.precoCents) || s.precoCents <= 0) {
    return falha("INDISPONIVEL", "SERVICO_NAO_AUTORIZADO");
  }
  const p = d.pagamento!;
  try {
    const r = await p.criarLink({ companyId: c.companyId, merchantId: p.merchantId, provedor: p.provedor,
      servicoId: s.id, descricao: s.nome, valorCents: s.precoCents, moeda: "BRL", cliente: { ...c.cliente }, chaveOperacao });
    if (r.estado !== "CONCLUIDA") return falha(r.estado,
      r.estado === "PENDENTE" ? "AGUARDANDO_PROVEDOR" : "RESULTADO_NAO_COMPROVADO");
    let linkValido = false;
    try {
      const url = new URL(r.url);
      linkValido = url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")
        && p.hostsPermitidos.includes(url.hostname);
    } catch { /* Resposta inválida do provedor não é um link de cobrança. */ }
    if (!r.cobrancaId?.trim() || r.companyId !== c.companyId || r.merchantId !== p.merchantId
      || r.provedor !== p.provedor || r.servicoId !== s.id || r.valorCents !== s.precoCents
      || r.moeda !== "BRL" || r.chaveOperacao !== chaveOperacao || !linkValido) {
      return falha("DESCONHECIDA", "RESULTADO_NAO_COMPROVADO");
    }
    return { estado: "CONCLUIDA", acao: a.acao, cobrancaId: r.cobrancaId, url: r.url,
      valorCents: s.precoCents, reutilizada: r.reutilizada === true, fonte: "PROVEDOR_DA_EMPRESA" };
  } catch { return falha("DESCONHECIDA", "RESULTADO_NAO_COMPROVADO"); }
}

/** Ferramentas só são anunciadas quando há implementação autorizada para a empresa. */
export function ferramentasDoAtendente(c: ContextoDasAcoes, d: DependenciasDasAcoes) {
  const capacidades = capacidadesDoAtendente(c, d);
  const ferramentas = [
    { name: "consultar_horarios" as const, description: "Consulta horários reais de um serviço autorizado; não reserva.",
      properties: { servicoId: { type: "string" }, dias: { type: "array", items: { type: "string", format: "date" }, minItems: 1, maxItems: 14 },
        profissional: { type: ["string", "null"] } }, required: ["servicoId", "dias", "profissional"] },
    { name: "reservar_horario" as const, description: "Reserva somente a escolha expressamente confirmada pelo cliente. A confirmação é validada pelo servidor.",
      properties: { servicoId: { type: "string" }, inicio: { type: "string", format: "date-time" }, profissional: { type: ["string", "null"] } },
      required: ["servicoId", "inicio", "profissional"] },
    { name: "solicitar_link_pagamento" as const, description: "Solicita link ao provedor da empresa, com preço do cadastro e confirmação explícita. Não confirma pagamento.",
      properties: { servicoId: { type: "string" } }, required: ["servicoId"] },
  ];
  return ferramentas.filter((f) => capacidades[f.name]).map(({ name, description, properties, required }) => ({
    type: "function" as const,
    function: { name, description, strict: true, parameters: { type: "object", properties, required, additionalProperties: false } },
  }));
}
