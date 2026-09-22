import type { Livre } from "@/lib/agenda/livres";
import { VALIDADE_DA_OFERTA_MS } from "./constantes";
import { diaCurto, horaFalada, localDe, type PedidoDeDia } from "./datas";

export type { Livre };

/**
 * A OFERTA DE HORÁRIOS — TRÊS OPÇÕES DE VERDADE, MONTADAS POR CÓDIGO.
 *
 * Os horários livres vêm da agenda (lib/agenda/livres.ts, a mesma regra da
 * página pública). Aqui só se escolhe quais três mostrar e como escrevê-los.
 * O bloco numerado nunca passa pela IA: por isso não tem como aparecer um
 * horário que não existe.
 *
 * A oferta fica guardada na conversa (`Conversation.atendenteEstado`) por duas
 * horas. É ela que faz um "2" virar marcação.
 */

const FOLGA_MS = 90 * 60_000;

const PERIODOS: Record<NonNullable<PedidoDeDia["periodo"]>, [number, number]> = {
  MANHA: [0, 12 * 60],
  TARDE: [12 * 60, 18 * 60],
  NOITE: [18 * 60, 24 * 60],
};

function atendePeriodo(livre: Livre, pedido: PedidoDeDia): boolean {
  const { minutos } = localDe(livre.inicio);
  if (pedido.periodo) {
    const [de, ate] = PERIODOS[pedido.periodo];
    if (minutos < de || minutos >= ate) return false;
  }
  if (pedido.aPartirDe !== undefined && minutos < pedido.aPartirDe) return false;
  return true;
}

/** A primeira livre, e as seguintes com folga de 90 minutos ou em outro dia; completa se faltar. */
function espalhar(candidatos: Livre[]): Livre[] {
  const escolhidos: Livre[] = [];
  for (const c of candidatos) {
    if (escolhidos.length === 3) break;
    const ultimo = escolhidos.at(-1);
    const outroDia = ultimo && localDe(ultimo.inicio).data !== localDe(c.inicio).data;
    if (!ultimo || outroDia || c.inicio.getTime() - ultimo.inicio.getTime() >= FOLGA_MS) {
      escolhidos.push(c);
    }
  }
  for (const c of candidatos) {
    if (escolhidos.length === 3) break;
    if (!escolhidos.includes(c)) escolhidos.push(c);
  }
  return escolhidos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/**
 * Três horários para o pedido do cliente. Sem vaga no dia pedido, tenta o mesmo
 * período nos dias seguintes e depois qualquer horário — e avisa, com
 * `noDiaPedido: false`, para o texto dizer que o dia pedido lotou.
 */
export function escolherTres(livres: Livre[], pedido: PedidoDeDia): { opcoes: Livre[]; noDiaPedido: boolean } {
  const ordenados = [...livres].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const exatos = ordenados.filter(
    (l) => (!pedido.dia || localDe(l.inicio).data === pedido.dia) && atendePeriodo(l, pedido),
  );
  if (exatos.length) return { opcoes: espalhar(exatos), noDiaPedido: true };

  const depois = pedido.dia ? ordenados.filter((l) => localDe(l.inicio).data > pedido.dia!) : ordenados;
  const mesmoPeriodo = depois.filter((l) => atendePeriodo(l, pedido));
  if (mesmoPeriodo.length) return { opcoes: espalhar(mesmoPeriodo), noDiaPedido: false };

  return { opcoes: espalhar(depois), noDiaPedido: false };
}

/** "1 · qua 23/09, 9h30 com Léo". */
export function formatarOpcao(n: number, livre: Livre): string {
  const local = localDe(livre.inicio);
  const quem = livre.profissional ? ` com ${livre.profissional}` : "";
  return `${n} · ${diaCurto(local.data)}, ${horaFalada(local.minutos)}${quem}`;
}

export type OpcaoDeServico = { n: number; servicoId: string; nome: string };
export type OpcaoDeHorario = { n: number; inicio: string; fim: string; profissional: string | null };

export type EstadoDaConversa =
  | { tipo: "SERVICO"; opcoes: OpcaoDeServico[]; pedido: PedidoDeDia; criadoEm: string }
  | {
      tipo: "HORARIO";
      servicoId: string | null;
      servicoNome: string;
      duracaoMin: number;
      opcoes: OpcaoDeHorario[];
      criadoEm: string;
    }
  | { tipo: "CONVITE"; criadoEm: string };

const ehTexto = (v: unknown): v is string => typeof v === "string";
const ehData = (v: unknown) => ehTexto(v) && !Number.isNaN(new Date(v).getTime());

/**
 * O estado guardado na conversa, validado — é Json no banco e pode ser qualquer
 * coisa. Oferta com mais de duas horas venceu: os horários podem ter sido
 * ocupados, e o cliente que voltou no dia seguinte merece uma oferta nova.
 */
export function lerEstado(valor: unknown, agora: Date): EstadoDaConversa | null {
  if (!valor || typeof valor !== "object") return null;
  const e = valor as Record<string, unknown>;
  if (!ehData(e.criadoEm)) return null;
  if (agora.getTime() - new Date(e.criadoEm as string).getTime() > VALIDADE_DA_OFERTA_MS) return null;

  if (e.tipo === "CONVITE") return { tipo: "CONVITE", criadoEm: e.criadoEm as string };

  if (e.tipo === "SERVICO" && Array.isArray(e.opcoes)) {
    const opcoes = e.opcoes.filter(
      (o): o is OpcaoDeServico =>
        !!o && typeof o.n === "number" && ehTexto(o.servicoId) && ehTexto(o.nome),
    );
    if (!opcoes.length) return null;
    const pedido = typeof e.pedido === "object" && e.pedido ? (e.pedido as PedidoDeDia) : {};
    return { tipo: "SERVICO", opcoes, pedido, criadoEm: e.criadoEm as string };
  }

  if (e.tipo === "HORARIO" && Array.isArray(e.opcoes) && ehTexto(e.servicoNome) && typeof e.duracaoMin === "number") {
    const opcoes = e.opcoes.filter(
      (o): o is OpcaoDeHorario =>
        !!o && typeof o.n === "number" && ehData(o.inicio) && ehData(o.fim) &&
        (o.profissional === null || ehTexto(o.profissional)),
    );
    if (!opcoes.length) return null;
    return {
      tipo: "HORARIO",
      servicoId: ehTexto(e.servicoId) ? e.servicoId : null,
      servicoNome: e.servicoNome,
      duracaoMin: e.duracaoMin,
      opcoes,
      criadoEm: e.criadoEm as string,
    };
  }

  return null;
}

/** As opções no formato que `detectarIntencao` usa para ler "2" ou "o das 11". */
export function opcoesParaEscolha(estado: EstadoDaConversa | null): { n: number; minutos: number }[] {
  if (!estado || estado.tipo === "CONVITE") return [];
  if (estado.tipo === "SERVICO") return estado.opcoes.map((o) => ({ n: o.n, minutos: -1 }));
  return estado.opcoes.map((o) => ({ n: o.n, minutos: localDe(new Date(o.inicio)).minutos }));
}
