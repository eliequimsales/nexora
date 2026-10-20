import type { BusinessHour } from "@/lib/validation";

/**
 * Peças de texto sem IA que o Atendente Virtual usa: os termos de pedido de
 * pessoa, o reconhecimento de cumprimento puro e o horário compacto que vai
 * nos fatos da empresa. As respostas saem de lib/atendente/motor.ts.
 */

/** Vocabulário de encaminhamento; uma menção isolada no meio de uma pergunta não é pedido. */
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

const PAPEL_HUMANO = "(?:atendente|humano|humana|pessoa|alguem|suporte|responsavel|gerente|dono|dona|equipe)";
const ARTIGO = "(?:(?:(?:de|para|pra|a) )?(?:um|uma|o|a|os|as|algum|alguma) |(?:do|da|de|ao|aos) )?";

/** Reconhece o pedido, sem confundir identidade, negação ou uma pergunta sobre a equipe. */
export function pedeAtendimentoHumano(text: string, customTerms: string[] = []): boolean {
  const clauses = text.split(/[.!?;\n]+|,\s*(?=(?:quero|preciso|prefiro|chame)\b)|\b(?:mas|porém|porem)\b/i).map(normalize).filter(Boolean);
  return clauses.some((clause) => {
    const t = clause.replace(/^(?:oi|ola|bom dia|boa tarde|boa noite)\s+/, "");
    if (/\b(?:nao (?:quero|preciso|precisa|desejo|gostaria|chame|chama|encaminhe|transfira|me transfira|me encaminhe|vou falar|vou conversar)|sem (?:chamar|falar|transferir|encaminhar))\b/.test(t)) {
      return false;
    }
    if (/\b(?:nao (?:falar|conversar|chamar|transferir|encaminhar)|nao sei se|se (?:eu )?(?:precisar|quiser)|caso (?:eu )?(?:precise|queira))\b/.test(t)) return false;
    if (new RegExp(`\\b(?:falar|conversar) com ${ARTIGO}${PAPEL_HUMANO}\\b`).test(t)) return true;
    if (new RegExp(`\\b(?:quero|preciso|chame|chama|chamar|chamem|aguardo|prefiro|gostaria de) ${ARTIGO}${PAPEL_HUMANO}\\b`).test(t)) return true;
    if (new RegExp(`\\b(?:transfira|transferir|encaminhe|encaminhar|passe|passar|chame|chama)(?: me)? (?:para |pra |pro |a )?${ARTIGO}${PAPEL_HUMANO}\\b`).test(t)) return true;
    if (/\b(?:nao|sem)\b/.test(t)) return false;

    // Palavras específicas cadastradas pelo dono continuam sendo gatilhos. As
    // palavras genéricas acima seguem exigindo um pedido, mesmo se cadastradas.
    return customTerms.some((term) => {
      const normalized = normalize(term);
      if (!normalized || DEFAULT_HANDOFF_TERMS.includes(normalized) || new RegExp(`^${PAPEL_HUMANO}$`).test(normalized)) return false;
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`).test(t);
    });
  });
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
