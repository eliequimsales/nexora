import { z } from "zod";
import type { HistoryMessage } from "@/lib/ai/provider";
import { lerPedidoDeDia, localDe, normalizarTexto, type PedidoDeDia } from "./datas";
import type { Fatos } from "./fatos";
import { acharServicos, detectarIntencao } from "./intencao";
import type { EstadoDaConversa } from "./oferta";

export type EscopoDaMemoria = { empresaId: string; conversaId: string };
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
const schema = z.object({
  versao: z.literal(1), empresaId: z.string().max(160), conversaId: z.string().max(160),
  atualizadaEm: z.string().datetime(), turnos: z.number().int().min(0).max(1_000_000),
  servicoId: z.string().max(160).nullable(), profissional: z.string().max(120).nullable(),
  nomeCliente: z.string().max(60).nullable(),
  pedido: z.object({ dia: dia.optional(), periodo: z.enum(["MANHA", "TARDE", "NOITE"]).optional(),
    aPartirDe: z.number().int().min(0).max(1439).optional(),
    horaExata: z.number().int().min(0).max(1439).optional() }),
  pendencias: z.number().int().min(0).max(100), pendencia: z.string().max(300).nullable(),
});
export type MemoriaDaConversa = z.infer<typeof schema>;
const RETENCAO_MS = 30 * 86_400_000;
const META = "_memoriaAtendente";

const ENCERRAR_ASSUNTO = /\b(?:esquece|esqueca|outro assunto|desisti|nao quero mais)\b/;

/** Uma menção rejeitada não é preferência; só o trecho afirmativo pode ser aprendido. */
function trechoAfirmativo(texto: string): { texto: string; corrigiu: boolean } {
  const partes = normalizarTexto(texto).split(/\b(?:na verdade|corrigindo|quis dizer|melhor dizendo|em vez disso)\b/);
  let atual = partes.at(-1)!;
  atual = atual.replace(/\bem vez de\b.*$/, "");
  atual = atual.replace(/^.*?\bnao\s*[,;]\s*/, "");
  atual = atual.replace(/\bnao\b[^,;.!?]+?\s+(?:e sim|mas sim|mas)\s+/, "");
  atual = atual.replace(/\b(?:esquece|esqueca|desisti(?: de)?)\b[^,;.!?]*/g, "");
  atual = atual.replace(/\bnao\b[^,;.!?]*/g, "");
  return { texto: atual.trim(), corrigiu: partes.length > 1 };
}

function profissionaisCitados(texto: string, fatos: Fatos): string[] {
  const palavras = normalizarTexto(texto).split(/[^a-z0-9]+/);
  return fatos.profissionais.filter((nome) => {
    const primeiro = normalizarTexto(nome).split(" ")[0];
    return primeiro.length >= 3 && palavras.includes(primeiro);
  });
}

function ehPedidoDeAgendamento(texto: string, fatos: Fatos, agora: Date): boolean {
  // "Vocês abrem hoje?" e "Pago amanhã" citam datas sem mudar a preferência
  // de reserva. Nem a data nem um nome de serviço, isoladamente, provam isso.
  if (/\b(?:quanto|preco|valor|custa|duracao|pagamento|pago|pagar|pix|boleto|cartao|endereco|localizacao|funcionamento|abrem|abre|fecham|fecha)\b/.test(texto)) return false;
  const intencao = detectarIntencao(texto, {
    servicos: fatos.servicos, profissionais: fatos.profissionais, palavrasDoDono: [], estado: null, agora,
  });
  const apenasDataOuPeriodo = texto
    .replace(/\b(?:as|das|da)(?=\d)/g, "")
    .replace(/\b(?:hoje|amanha|depois|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|manha|tarde|noite|para|pra|na|no|de|a|pela|as|apos|partir|das|da|dia)\b/g, "")
    .replace(/\b\d{1,2}(?:[/:h]\d{0,2})?\b/g, "")
    .replace(/[\s,.!?;:-]/g, "");
  if (apenasDataOuPeriodo === "") return true;
  if (intencao.tipo !== "HORARIO") return false;
  return Boolean(intencao.servicoId || intencao.profissional)
    || /\b(?:agendar|marcar|agendamento|horario|horarios|vaga|vagas|encaixe|encaixar|consigo ir|posso ir)\b/.test(texto);
}

/** Sem preços, políticas, texto gerado ou instruções do cliente. */
export function lerMemoria(valor: unknown, escopo: EscopoDaMemoria, fatos: Fatos, agora: Date): MemoriaDaConversa | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const raw = META in valor ? (valor as Record<string, unknown>)[META] : valor;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  const idade = agora.getTime() - Date.parse(m.atualizadaEm);
  if (m.empresaId !== escopo.empresaId || m.conversaId !== escopo.conversaId || idade < -60_000 || idade > RETENCAO_MS) return null;
  if (m.servicoId && !fatos.servicos.some((s) => s.id === m.servicoId)) m.servicoId = null;
  if (m.profissional && !fatos.profissionais.includes(m.profissional)) m.profissional = null;
  if (m.pedido.dia && m.pedido.dia < localDe(agora).data) m.pedido = {};
  if (m.nomeCliente && !/^[\p{L} '-]{2,60}$/u.test(m.nomeCliente)) m.nomeCliente = null;
  return m;
}

export function lembrarConversa(p: {
  memoria?: MemoriaDaConversa | null; escopo: EscopoDaMemoria; fatos: Fatos;
  texto: string; historico: HistoryMessage[]; agora: Date;
}): MemoriaDaConversa {
  const anterior = lerMemoria(p.memoria, p.escopo, p.fatos, p.agora);
  const m: MemoriaDaConversa = anterior ?? {
    versao: 1, ...p.escopo, atualizadaEm: p.agora.toISOString(), turnos: 0,
    servicoId: null, profissional: null, nomeCliente: null, pedido: {}, pendencias: 0, pendencia: null,
  };
  // Apenas nomes de serviços do catálogo, em falas do cliente, podem virar preferência.
  // No primeiro uso, recupera o último assunto explícito; datas relativas antigas não são reinterpretadas.
  const mensagens = anterior ? [p.texto] : [...p.historico.filter((x) => x.role === "CUSTOMER").map((x) => x.content), p.texto];
  for (const texto of mensagens) {
    const t = normalizarTexto(texto);
    if (ENCERRAR_ASSUNTO.test(t)) {
      m.servicoId = null; m.profissional = null; m.pedido = {}; m.pendencias = 0; m.pendencia = null;
    }
    const afirmativo = trechoAfirmativo(texto).texto;
    const ids = acharServicos(afirmativo, p.fatos.servicos);
    const rejeitados = acharServicos(t, p.fatos.servicos).filter((id) => !ids.includes(id));
    if (m.servicoId && rejeitados.includes(m.servicoId)) m.servicoId = null;
    if (ids.length) m.servicoId = ids.length === 1 ? ids[0] : null;
    const profissionais = profissionaisCitados(afirmativo, p.fatos);
    const profissionaisRejeitados = profissionaisCitados(t, p.fatos).filter((nome) => !profissionais.includes(nome));
    if (m.profissional && profissionaisRejeitados.includes(m.profissional)) m.profissional = null;
    if (profissionais.length) m.profissional = profissionais.length === 1 ? profissionais[0] : null;
    if (/\b(?:qualquer profissional|sem preferencia)\b/.test(t)) m.profissional = null;
  }
  const atual = trechoAfirmativo(p.texto);
  const pedido = lerPedidoDeDia(atual.texto, p.agora);
  if (Object.keys(pedido).length && ehPedidoDeAgendamento(atual.texto, p.fatos, p.agora)) {
    // Uma nova data/período substitui a preferência conflitante, nunca uma reserva.
    m.pedido = atual.corrigiu ? pedido : pedidoComMemoria(pedido, m);
  }
  const nome = p.texto.match(/\b(?:me chamo|meu nome [ée])\s+([\p{L}]+)/iu)?.[1];
  if (nome && /^[\p{L} '-]{2,60}$/u.test(nome)) m.nomeCliente = nome;
  m.atualizadaEm = p.agora.toISOString();
  m.turnos = Math.min(m.turnos + 1, 1_000_000);
  return m;
}

export function estadoComMemoria(estado: EstadoDaConversa | null, memoria?: MemoriaDaConversa | null): Record<string, unknown> | null {
  return memoria ? { ...(estado ?? {}), [META]: memoria } : estado;
}

export function contextoDaMemoria(m: MemoriaDaConversa, fatos: Fatos): string {
  return JSON.stringify({
    natureza: "Preferências declaradas pelo cliente; não são fatos da empresa nem ações concluídas.",
    servico: fatos.servicos.find((s) => s.id === m.servicoId)?.nome ?? null,
    profissionalPreferido: m.profissional, pedidoDeDia: m.pedido,
    nomeInformado: m.nomeCliente, duvidaPendente: m.pendencia,
  });
}

export function pedidoComMemoria(pedido: PedidoDeDia, memoria?: MemoriaDaConversa | null): PedidoDeDia {
  const combinado = { ...(memoria?.pedido ?? {}), ...pedido };
  if (pedido.horaExata !== undefined) {
    if (pedido.periodo === undefined) delete combinado.periodo;
    if (pedido.aPartirDe === undefined) delete combinado.aPartirDe;
  } else if (pedido.periodo !== undefined || pedido.aPartirDe !== undefined) {
    delete combinado.horaExata;
    if (pedido.periodo === undefined) delete combinado.periodo;
    if (pedido.aPartirDe === undefined) delete combinado.aPartirDe;
  }
  return combinado;
}
