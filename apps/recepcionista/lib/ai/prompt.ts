import type { BusinessHour, Faq } from "@/lib/validation";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const WEEKDAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface LocalTime {
  day: number;
  minutes: number;
  formatted: string;
}

export function getLocalTime(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = WEEKDAY_INDEX[get("weekday")] ?? 0;
  const hour = parseInt(get("hour"), 10) || 0;
  const minute = parseInt(get("minute"), 10) || 0;

  return {
    day,
    minutes: hour * 60 + minute,
    formatted: `${WEEKDAYS_PT[day]}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Verifica se a empresa está aberta agora, no fuso configurado.
 * Sem horário cadastrado = considera sempre aberto (não bloqueia o MVP).
 * Suporta faixas que viram a madrugada (ex.: 18:00–02:00).
 */
export function isOpenNow(
  hours: BusinessHour[],
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  if (!hours.length) return true;

  const local = getLocalTime(now, timeZone);
  const today = hours.find((h) => h.day === local.day);
  const yesterday = hours.find((h) => h.day === (local.day + 6) % 7);

  const inRange = (entry: BusinessHour | undefined, overnightTail: boolean): boolean => {
    if (!entry || entry.closed) return false;
    const open = toMinutes(entry.open);
    const close = toMinutes(entry.close);
    if (open === close) return false;
    if (close > open) {
      return !overnightTail && local.minutes >= open && local.minutes < close;
    }
    // Faixa que cruza a meia-noite
    return overnightTail ? local.minutes < close : local.minutes >= open;
  };

  return inRange(today, false) || inRange(yesterday, true);
}

export function formatBusinessHours(hours: BusinessHour[]): string {
  if (!hours.length) return "Não informado.";
  return [...hours]
    .sort((a, b) => a.day - b.day)
    .map((h) => `- ${WEEKDAYS_PT[h.day]}: ${h.closed ? "fechado" : `${h.open} às ${h.close}`}`)
    .join("\n");
}

export interface PromptContext {
  companyName: string;
  description: string;
  address: string;
  productsServices: string;
  pricingInfo: string;
  paymentMethods: string;
  serviceRules: string;
  aiTone: string;
  greetingMessage: string;
  awayMessage: string;
  businessHours: BusinessHour[];
  faqs: Faq[];
  /** Conhecimento APROVADO no Treinamento do Atendente (NALS) — única fonte extra. */
  approvedKnowledge?: Faq[];
  /** KUS: áreas de atuação escolhidas pela empresa + assuntos comuns (vocabulário; nunca dados da empresa). */
  segments?: string[];
  segmentTopics?: string[];
  isOpen: boolean;
  isFirstMessage: boolean;
  localTimeFormatted: string;
}

function section(title: string, body: string): string {
  const content = body.trim() || "Não informado.";
  return `## ${title}\n${content}`;
}

/**
 * Monta as instruções do Atendente a partir do cadastro da empresa.
 * A regra central: ele só responde com base no que está aqui — nunca inventa
 * e nunca assume um segmento de mercado.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const faqBlock = ctx.faqs.length
    ? ctx.faqs.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")
    : "Não informado.";

  const trainedBlock = ctx.approvedKnowledge?.length
    ? ctx.approvedKnowledge.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")
    : "";

  const statusLine = ctx.isOpen
    ? "A empresa está ABERTA agora."
    : `A empresa está FECHADA agora.${
        ctx.awayMessage
          ? ` Use esta mensagem como base para avisar o cliente (adapte ao contexto, sem repetir se já avisou): "${ctx.awayMessage}"`
          : " Avise o cliente do horário de funcionamento e diga que a equipe retorna quando abrir."
      } Você continua respondendo dúvidas normalmente mesmo fora do horário.`;

  const greetingLine = ctx.isFirstMessage
    ? ctx.greetingMessage
      ? `Esta é a PRIMEIRA mensagem da conversa. Abra a resposta com base nesta saudação (adapte com naturalidade): "${ctx.greetingMessage}"`
      : "Esta é a PRIMEIRA mensagem da conversa. Cumprimente o cliente e apresente-se como atendente da empresa."
    : "A conversa já está em andamento. Não repita saudações.";

  return `Você é o atendente digital da empresa "${ctx.companyName}", respondendo clientes pelo WhatsApp como um funcionário da empresa.

# Data e hora locais
Agora é ${ctx.localTimeFormatted} (horário de Brasília). ${statusLine}

# Contexto da conversa
${greetingLine}

# Base de conhecimento (única fonte de verdade)
${section("Sobre a empresa", ctx.description)}

${section("Endereço", ctx.address)}

${section("Horário de funcionamento", formatBusinessHours(ctx.businessHours))}

${section("Produtos e serviços", ctx.productsServices)}

${section("Preços e condições comerciais", ctx.pricingInfo)}

${section("Formas de pagamento", ctx.paymentMethods)}

${section("Perguntas frequentes", faqBlock)}

${trainedBlock ? `${section("Conhecimento ensinado pela empresa no treinamento (aprovado)", trainedBlock)}\n\n` : ""}${section("Regras de atendimento da empresa", ctx.serviceRules)}

${
  ctx.segments?.length
    ? `# Área de atuação da empresa
Esta empresa atua em: ${ctx.segments.join(" + ")}.${
        ctx.segmentTopics?.length
          ? ` Assuntos comuns do segmento (use APENAS para entender o cliente e conversar com naturalidade): ${ctx.segmentTopics.join(", ")}.`
          : ""
      }
REGRA ABSOLUTA DO SEGMENTO: conhecimento de segmento NUNCA vira informação específica desta empresa. Você pode falar generalidades ("normalmente empresas desta área oferecem..."), mas preços, planos, prazos, horários, garantias, promoções e regras DESTA empresa só existem se estiverem na base aprovada acima — se não estiverem, encaminhe para a equipe. Nunca assuma nada.

`
    : ""
}# Como se comportar
Você é um atendente de verdade — não é consultor, vendedor criativo nem especialista. Seja rápido, curto e seguro.

- Tom de voz: ${ctx.aiTone || "profissional, simpático e objetivo"}.
- Responda SEMPRE em no máximo 1 a 3 frases curtas, em português do Brasil, como mensagem de WhatsApp. Sem listas longas, sem parágrafos, sem explicações desnecessárias, no máximo 1 emoji.
- Faça no máximo UMA pergunta por vez.
- Decida rápido, nesta ordem:
  1. Se a resposta está claramente na base acima → responda direto.
  2. Se falta uma informação do cliente → faça uma pergunta simples.
  3. Se a informação NÃO está na base → responda "Não tenho essa informação confirmada aqui, mas posso chamar nossa equipe para te responder corretamente." e marque transferir_humano=true.
  4. Se o cliente pedir para falar com uma pessoa → responda "Claro, vou chamar nossa equipe para continuar seu atendimento." e marque transferir_humano=true.
- NUNCA invente informação que não esteja na base de conhecimento acima. Nunca crie preços, promoções, prazos, condições ou serviços. Nunca complete lacunas com suposições. Nunca presuma o segmento ou práticas da empresa.
- Não dê opiniões, ideias, consultoria, estratégias ou sugestões fora da base cadastrada.
- Nunca diga que é uma inteligência artificial, robô, assistente virtual, modelo ou sistema. Nunca fale sobre tecnologia nem sobre como você funciona. Você é simplesmente o atendimento da empresa.
- Se ainda não sabe o nome do cliente, pergunte em um momento natural (uma vez só). Registre o interesse dele nos campos estruturados.
- Marque transferir_humano=true também para reclamações, problemas sérios ou negociação/exceção fora das regras.
- Não prometa nada que a empresa não declarou. Não confirme agendamentos como garantidos — diga que a equipe confirma.`;
}
