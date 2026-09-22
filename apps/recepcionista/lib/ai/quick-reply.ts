import type { BusinessHour } from "@/lib/validation";

/**
 * Peças de texto sem IA que o Atendente Virtual usa: os termos de pedido de
 * pessoa, o reconhecimento de cumprimento puro e o horário compacto que vai
 * nos fatos da empresa. As respostas saem de lib/atendente/motor.ts.
 */

/** Termos que SEMPRE viram pedido de pessoa, sem chamar IA (além dos da empresa). */
export const DEFAULT_HANDOFF_TERMS = [
  "falar com atendente",
  "falar com um atendente",
  "atendente",
  "humano",
  "falar com alguem",
  "falar com uma pessoa",
  "quero falar com pessoa",
  "suporte",
  "responsavel",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "oi", "boa noite", "olá tudo bem" — nada além de cumprimento. */
export function isPureGreeting(text: string): boolean {
  const t = normalize(text);
  return /^(oi+|ola+|oie|opa|eai|e ai|bom dia|boa tarde|boa noite)( (tudo bem|td bem|tudo bom|como vai))?$/.test(
    t,
  );
}

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // seg → dom, como se fala

/** "seg a sex das 08:00 às 18:00; sáb das 08:00 às 12:00; dom fechado" */
export function formatBusinessHoursCompact(hours: BusinessHour[]): string {
  if (!hours.length) return "";
  const byDay = new Map(hours.map((h) => [h.day, h]));

  const groups: { start: number; end: number; key: string; entry: BusinessHour }[] = [];
  for (const day of DAY_ORDER) {
    const entry = byDay.get(day);
    if (!entry) continue;
    const key = entry.closed ? "fechado" : `${entry.open}-${entry.close}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.end = day;
    else groups.push({ start: day, end: day, key, entry });
  }

  return groups
    .map((g) => {
      const label =
        g.start === g.end ? DAY_LABELS[g.start] : `${DAY_LABELS[g.start]} a ${DAY_LABELS[g.end]}`;
      return g.entry.closed || g.key === "fechado"
        ? `${label} fechado`
        : `${label} das ${g.entry.open} às ${g.entry.close}`;
    })
    .join("; ");
}
