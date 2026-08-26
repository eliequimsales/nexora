import type { BusinessHour } from "@/lib/validation";

/**
 * Respostas diretas sem IA — latência de milissegundos para as perguntas mais
 * comuns (saudação, horário, endereço, pagamento) quando a resposta está
 * claramente no cadastro. Em qualquer ambiguidade, retorna null e a conversa
 * segue para o modelo.
 */

/** Termos que SEMPRE encaminham para a equipe, sem chamar IA (além dos da empresa). */
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

export interface QuickReplyContext {
  companyName: string;
  greetingMessage: string;
  businessHours: BusinessHour[];
  address: string;
  paymentMethods: string;
  isFirstMessage: boolean;
}

const MAX_QUICK_LENGTH = 120; // mensagens longas são complexas demais para atalho

/**
 * Retorna a resposta pronta (sem IA) ou null para seguir ao modelo.
 * Regra: só responde direto quando a mensagem tem UMA intenção clara e o
 * cadastro tem o dado. Nunca arrisca.
 */
export function matchQuickReply(text: string, ctx: QuickReplyContext): string | null {
  const t = normalize(text);
  if (!t || text.length > MAX_QUICK_LENGTH) return null;

  if (ctx.isFirstMessage && isPureGreeting(text)) {
    return (
      ctx.greetingMessage.trim() ||
      `Olá! Aqui é o atendimento da ${ctx.companyName}. Como posso ajudar? 😊`
    );
  }

  const wantsHours =
    /\b(horario|horarios|funcionamento|que horas|abre|abrem|fecha|fecham|aberto|abertos|aberta|abertas)\b/.test(t);
  const wantsAddress =
    /\b(endereco|localizacao|como chegar)\b/.test(t) || /\bonde (fica|ficam|estao|voces ficam|e a loja)\b/.test(t);
  const wantsPayment =
    /formas? de pagamento/.test(t) ||
    /\b(como pagar|posso pagar|parcela|parcelam|parcelamento)\b/.test(t) ||
    /\baceitam?\b.*\b(cartao|pix|dinheiro|boleto|credito|debito)\b/.test(t);

  const intents = [wantsHours, wantsAddress, wantsPayment].filter(Boolean).length;
  if (intents !== 1) return null; // zero ou várias intenções → deixa para o modelo

  if (wantsHours && ctx.businessHours.length > 0) {
    return `Nosso horário de atendimento é ${formatBusinessHoursCompact(ctx.businessHours)}. Posso ajudar em mais alguma coisa?`;
  }
  if (wantsAddress && ctx.address.trim()) {
    return `Estamos em ${ctx.address.trim()}. Posso ajudar em mais alguma coisa?`;
  }
  if (wantsPayment && ctx.paymentMethods.trim()) {
    return `Sobre pagamento: ${ctx.paymentMethods.trim()}. Posso ajudar em mais alguma coisa?`;
  }

  return null; // intenção clara mas cadastro vazio → o modelo trata (e encaminha se preciso)
}
