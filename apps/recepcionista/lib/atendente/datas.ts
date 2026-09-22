import type { BusinessHour } from "@/lib/validation";

/**
 * DIA E HORA DO JEITO QUE O CLIENTE FALA — E DO JEITO QUE O ATENDENTE RESPONDE.
 *
 * "amanhã de manhã", "sábado", "dia 25", "depois das 18h" viram um pedido que o
 * código entende; e o horário marcado volta como "quarta, 23/09, às 11h".
 *
 * Tudo em Brasília (UTC−3 o ano inteiro desde 2019), com o "agora" injetado:
 * agenda que trata fuso por acidente marca cliente no horário errado.
 */

const FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Periodo = "MANHA" | "TARDE" | "NOITE";

export type PedidoDeDia = {
  /** "AAAA-MM-DD" em Brasília. */
  dia?: string;
  periodo?: Periodo;
  /** Minutos locais a partir dos quais o cliente pode. */
  aPartirDe?: number;
};

const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DIAS_FALADOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** O dia, o dia da semana e os minutos de Brasília do instante informado. */
export function localDe(agora: Date): { data: string; diaDaSemana: number; minutos: number } {
  const local = new Date(agora.getTime() - FUSO_MS);
  return {
    data: `${local.getUTCFullYear()}-${doisDigitos(local.getUTCMonth() + 1)}-${doisDigitos(local.getUTCDate())}`,
    diaDaSemana: local.getUTCDay(),
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** Meia-noite UTC do dia local, como `calcularSlots` espera. */
export function diaUtc(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

export function somarDias(data: string, n: number): string {
  const d = new Date(diaUtc(data).getTime() + n * DIA_MS);
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
}

function diaDaSemanaDe(data: string): number {
  return diaUtc(data).getUTCDay();
}

/** O instante de uma hora local num dia local. */
export function instanteLocal(data: string, minutos: number): Date {
  return new Date(diaUtc(data).getTime() + minutos * 60_000 + FUSO_MS);
}

const SAUDACOES = /\b(bom dia|boa tarde|boa noite)\b/g;

/** O que o cliente pediu de dia, período e hora — o que não entender, deixa vazio. */
export function lerPedidoDeDia(texto: string, agora: Date): PedidoDeDia {
  const t = normalizarTexto(texto).replace(SAUDACOES, " ");
  const hoje = localDe(agora);
  const pedido: PedidoDeDia = {};

  if (/\bdepois de amanha\b/.test(t)) pedido.dia = somarDias(hoje.data, 2);
  else if (/\bamanha\b/.test(t)) pedido.dia = somarDias(hoje.data, 1);
  else if (/\bhoje\b/.test(t)) pedido.dia = hoje.data;
  else {
    const barra = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    const doMes = t.match(/\bdia (\d{1,2})\b/);
    const semana = DIAS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));

    if (barra) {
      const [dia, mes] = [Number(barra[1]), Number(barra[2])];
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
        let ano = Number(hoje.data.slice(0, 4));
        let candidato = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
        if (candidato < hoje.data) {
          ano += 1;
          candidato = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
        }
        pedido.dia = candidato;
      }
    } else if (doMes) {
      const dia = Number(doMes[1]);
      if (dia >= 1 && dia <= 31) {
        const [ano, mes] = hoje.data.split("-").map(Number);
        let candidato = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
        if (candidato < hoje.data) {
          const proximo = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
          candidato = `${proximo.ano}-${doisDigitos(proximo.mes)}-${doisDigitos(dia)}`;
        }
        pedido.dia = candidato;
      }
    } else if (semana >= 0) {
      let falta = (semana - hoje.diaDaSemana + 7) % 7;
      // O próprio dia só vale se ainda for cedo; de noite, é o da semana que vem.
      if (falta === 0 && hoje.minutos >= 17 * 60) falta = 7;
      pedido.dia = somarDias(hoje.data, falta);
    }
  }

  if (/\b(de manha|pela manha|a manha|manha|cedo)\b/.test(t)) pedido.periodo = "MANHA";
  else if (/\b(a tarde|de tarde|pela tarde|tarde)\b/.test(t)) pedido.periodo = "TARDE";
  else if (/\b(a noite|de noite|pela noite|noite)\b/.test(t)) pedido.periodo = "NOITE";

  const aPartir = t.match(/\b(?:depois das?|apos as?|a partir das?)\s*(\d{1,2})(?:[:h](\d{2}))?/);
  if (aPartir) {
    const hora = Number(aPartir[1]);
    const minuto = aPartir[2] ? Number(aPartir[2]) : 0;
    if (hora <= 23 && minuto <= 59) pedido.aPartirDe = hora * 60 + minuto;
  }

  return pedido;
}

/** 570 → "9h30"; 540 → "9h". */
export function horaFalada(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${doisDigitos(m)}` : `${h}h`;
}

/** "2026-09-23" → "qua 23/09". */
export function diaCurto(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${DIAS_CURTOS[diaDaSemanaDe(data)]} ${dia}/${mes}`;
}

/** O horário marcado por extenso: "quarta, 23/09, às 11h". */
export function quandoFalado(inicio: Date): string {
  const local = localDe(inicio);
  const [, mes, dia] = local.data.split("-");
  return `${DIAS_FALADOS[local.diaDaSemana]}, ${dia}/${mes}, às ${horaFalada(local.minutos)}`;
}

/** Minutos de "HH:MM". */
export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * A próxima vez que a loja abre, olhando a semana e os dias fechados. null quando
 * nada abre nos próximos oito dias — e aí nenhum texto promete hora.
 */
export function proximaAbertura(
  horarios: BusinessHour[],
  diasFechados: string[],
  agora: Date,
): Date | null {
  const hoje = localDe(agora).data;
  for (let i = 0; i <= 8; i++) {
    const data = somarDias(hoje, i);
    if (diasFechados.includes(data)) continue;
    const config = horarios.find((h) => h.day === diaDaSemanaDe(data));
    if (!config || config.closed || config.open === config.close) continue;
    const abre = instanteLocal(data, minutosDe(config.open));
    if (abre.getTime() > agora.getTime()) return abre;
  }
  return null;
}

/** "hoje às 14h", "amanhã às 9h", "segunda às 9h" ou "12/10 às 9h". */
export function textoDaVolta(abertura: Date | null, agora: Date): string | null {
  if (!abertura) return null;
  const hoje = localDe(agora).data;
  const alvo = localDe(abertura);
  const hora = horaFalada(alvo.minutos);
  if (alvo.data === hoje) return `hoje às ${hora}`;
  if (alvo.data === somarDias(hoje, 1)) return `amanhã às ${hora}`;
  for (let i = 2; i <= 6; i++) {
    if (alvo.data === somarDias(hoje, i)) return `${DIAS_FALADOS[alvo.diaDaSemana]} às ${hora}`;
  }
  const [, mes, dia] = alvo.data.split("-");
  return `${dia}/${mes} às ${hora}`;
}
