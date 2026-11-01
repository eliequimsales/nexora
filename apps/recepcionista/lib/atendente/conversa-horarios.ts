import { z } from "zod";
import type { HorarioNexa } from "./configuracao-schema";

const HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const grupoHorarioDaConversaSchema = z.object({
  dias: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(dias => new Set(dias).size === dias.length),
  abre: z.string().regex(HORA).nullable(), fecha: z.string().regex(HORA).nullable(),
  fechado: z.boolean(), evidencia: z.string().trim().min(1).max(6000),
}).strict().refine(g => g.fechado ? g.abre === null && g.fecha === null
  : g.abre !== null && g.fecha !== null && g.abre < g.fecha);
export const horariosDaConversaSchema = z.array(grupoHorarioDaConversaSchema).max(14).default([]);
export type GrupoHorarioDaConversa = z.infer<typeof grupoHorarioDaConversaSchema>;

export const FORMATO_HORARIOS_DA_CONVERSA = {
  type: "array", items: { type: "object", additionalProperties: false,
    properties: {
      dias: { type: "array", items: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6] } },
      abre: { anyOf: [{ type: "string" }, { type: "null" }] },
      fecha: { anyOf: [{ type: "string" }, { type: "null" }] },
      fechado: { type: "boolean" }, evidencia: { type: "string" },
    }, required: ["dias", "abre", "fecha", "fechado", "evidencia"],
  },
} as const;

const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const DIA = "(?:domingo|dom|segunda(?:-feira)?|seg|terca(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sabado|sab)";
const numeroDia = (dia: string) => ["dom", "seg", "ter", "qua", "qui", "sex", "sab"].findIndex(prefixo => dia.startsWith(prefixo));

function diasExplicitos(texto: string): Set<number> {
  if (/\b(?:todos os dias|todo dia|diariamente|domingo a domingo)\b/.test(texto)) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const dias = new Set<number>();
  for (const m of texto.matchAll(new RegExp(`\\b(${DIA})\\.?\\s*(?:a|ate|-)\\s*(${DIA})\\b`, "g"))) {
    const inicio = numeroDia(m[1]); const fim = numeroDia(m[2]);
    for (let d = inicio, n = 0; n < 7; d = (d + 1) % 7, n++) { dias.add(d); if (d === fim) break; }
  }
  for (const m of texto.matchAll(new RegExp(`\\b${DIA}\\b`, "g"))) dias.add(numeroDia(m[0]));
  return dias;
}

function horaLiteral(hora: string, minuto?: string): string | null {
  const h = Number(hora); const m = Number(minuto ?? 0);
  return Number.isInteger(h) && h >= 0 && h <= 23 && Number.isInteger(m) && m >= 0 && m <= 59
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null;
}

function intervalosExplicitos(texto: string): Array<[string, string]> {
  const pares: Array<[string, string]> = [];
  const token = "(\\d{1,2})(?:(?:h|:)(\\d{2})|h)?";
  for (const m of texto.matchAll(new RegExp(`(?<![\\d$])\\b${token}\\s*(?:as|ate|a|-)\\s*${token}\\b`, "g"))) {
    const antes = texto.slice(Math.max(0, m.index! - 5), m.index);
    if (/r\$\s*$/.test(antes)) continue;
    const abre = horaLiteral(m[1], m[2]); const fecha = horaLiteral(m[3], m[4]);
    if (abre && fecha && abre < fecha) pares.push([abre, fecha]);
  }
  const abertura = texto.match(new RegExp(`\\b(?:abro|abre|abrimos|abertura)\\b[^.;!?\\d]{0,20}${token}\\b`));
  const fechamento = texto.match(new RegExp(`\\b(?:fecho|fecha|fechamos|fechamento)\\b[^.;!?\\d]{0,20}${token}\\b`));
  if (abertura && fechamento) {
    const abre = horaLiteral(abertura[1], abertura[2]); const fecha = horaLiteral(fechamento[1], fechamento[2]);
    if (abre && fecha && abre < fecha) pares.push([abre, fecha]);
  }
  return [...new Map(pares.map(par => [par.join("/"), par])).values()];
}

/** Aplica somente grupos comprovados. Contradições entre grupos recusam a mensagem inteira. */
export function aplicarHorariosDaConversa(base: HorarioNexa[], grupos: GrupoHorarioDaConversa[], declarado: (evidencia: string) => boolean): HorarioNexa[] | null {
  const candidatos = grupos.flatMap(entrada => {
    const parsed = grupoHorarioDaConversaSchema.safeParse(entrada);
    if (!parsed.success || !declarado(parsed.data.evidencia)) return [];
    const g = parsed.data; const texto = normalizar(g.evidencia);
    const dias = diasExplicitos(texto);
    const fechamento = /\bfechad[oa]s?\b|\bnao (?:atend|funcion|abr|trabalh)[a-z]*\b/.test(texto);
    const restantes = /\b(?:restantes|demais|outros) dias\b|\bdias (?:restantes|demais)\b/.test(texto);
    if (g.fechado ? !fechamento : fechamento && !/\b(?:domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)\b.*\bfechad/.test(texto)) return [];
    if (!g.fechado) {
      const pares = intervalosExplicitos(texto);
      // Evidência com dois expedientes diferentes precisa ser dividida pelo modelo.
      if (pares.length !== 1 || pares[0][0] !== g.abre || pares[0][1] !== g.fecha) return [];
    }
    if (!g.fechado || !restantes) {
      if (!g.dias.every(dia => dias.has(dia))) return [];
    }
    return [{ g, dias, restantes }];
  });
  const explicitos = new Set(candidatos.filter(c => !c.restantes).flatMap(c => c.g.dias));
  const novos = new Map<number, HorarioNexa>();
  for (const { g, dias, restantes } of candidatos) {
    if (restantes && g.fechado) {
      const referencia = dias.size ? dias : explicitos.size ? explicitos : new Set(base.filter(h => !h.closed).map(h => h.day));
      if (!referencia.size) continue;
      const esperados = [0, 1, 2, 3, 4, 5, 6].filter(dia => !referencia.has(dia));
      if (esperados.length !== g.dias.length || !g.dias.every(dia => esperados.includes(dia))) continue;
    }
    for (const dia of g.dias) {
      const horario: HorarioNexa = { day: dia, open: g.fechado ? "" : g.abre!, close: g.fechado ? "" : g.fecha!, closed: g.fechado };
      const anterior = novos.get(dia);
      if (anterior && JSON.stringify(anterior) !== JSON.stringify(horario)) return null;
      novos.set(dia, horario);
    }
  }
  if (!novos.size) return null;
  const unidos = new Map(base.map(h => [h.day, { ...h }]));
  for (const [dia, horario] of novos) unidos.set(dia, horario);
  return [...unidos.values()].sort((a, b) => a.day - b.day);
}
