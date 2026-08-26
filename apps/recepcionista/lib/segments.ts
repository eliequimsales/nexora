import { z } from "zod";
import { prisma } from "./db";
import { logError } from "./errors";
import { jsonCompletion } from "./ai/provider";
import { normalizeQuestionKey } from "./training";

/**
 * KUS — Conhecimento Universal do Segmento.
 *
 * Arquitetura híbrida: a Nexora mantém templates-semente curados; para
 * segmentos novos a IA gera o template UMA vez e ele fica salvo como ativo
 * global da Nexora (SegmentTemplate), reutilizado por todas as empresas.
 *
 * Regra absoluta: template NUNCA vira resposta pronta. Ele só orienta a
 * entrevista de integração, o vocabulário do Atendente e o treinamento.
 */

export interface SegmentTopic {
  topic: string;
  question: string;
}

/** "Pet Shop" → "pet-shop" (chave global do template). */
export function slugifySegment(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ——— Templates-semente (curadoria Nexora) ———

export const SEED_TEMPLATES: Record<string, { name: string; topics: SegmentTopic[] }> = {
  academia: {
    name: "Academia",
    topics: [
      { topic: "Planos e mensalidades", question: "Quais planos vocês oferecem (mensal, trimestral, anual) e como funcionam?" },
      { topic: "Matrícula", question: "Como funciona a matrícula? Tem taxa?" },
      { topic: "Horários de funcionamento", question: "Quais os horários de funcionamento, incluindo fins de semana?" },
      { topic: "Musculação", question: "Como funciona a área de musculação?" },
      { topic: "Aulas coletivas", question: "Vocês têm aulas coletivas? Quais e em que horários?" },
      { topic: "Personal trainer", question: "Vocês trabalham com personal trainer? Como funciona?" },
      { topic: "Avaliação física", question: "Existe avaliação física? Está inclusa no plano?" },
      { topic: "Cancelamento e trancamento", question: "Como funcionam cancelamento e trancamento de plano?" },
      { topic: "Formas de pagamento", question: "Quais formas de pagamento vocês aceitam?" },
      { topic: "Aula experimental", question: "Vocês oferecem aula experimental ou dia grátis?" },
    ],
  },
  restaurante: {
    name: "Restaurante",
    topics: [
      { topic: "Cardápio", question: "Quais os principais pratos e faixas de preço do cardápio?" },
      { topic: "Delivery", question: "Vocês fazem delivery? Qual a área e a taxa de entrega?" },
      { topic: "Retirada", question: "Vocês trabalham com retirada no balcão?" },
      { topic: "Reservas", question: "Vocês aceitam reservas? Como funciona?" },
      { topic: "Horários", question: "Quais os horários de funcionamento e dias de fechamento?" },
      { topic: "Bebidas e sobremesas", question: "Quais bebidas e sobremesas vocês servem?" },
      { topic: "Formas de pagamento", question: "Quais formas de pagamento vocês aceitam?" },
      { topic: "Opções especiais", question: "Vocês têm opções vegetarianas, veganas ou sem glúten?" },
      { topic: "Eventos e grupos", question: "Vocês atendem grupos grandes ou eventos?" },
    ],
  },
  imobiliaria: {
    name: "Imobiliária",
    topics: [
      { topic: "Aluguel", question: "Como funciona o processo de aluguel (documentos, garantias, prazos)?" },
      { topic: "Venda", question: "Como funciona a compra e venda de imóveis com vocês?" },
      { topic: "Financiamento", question: "Vocês auxiliam com financiamento? Quais bancos/parceiros?" },
      { topic: "Documentação", question: "Quais documentos o cliente precisa apresentar?" },
      { topic: "Visitas", question: "Como agendar visitas aos imóveis?" },
      { topic: "IPTU e condomínio", question: "Como funcionam IPTU e condomínio nos contratos?" },
      { topic: "Taxas e comissões", question: "Quais taxas e comissões vocês cobram?" },
      { topic: "Administração de imóveis", question: "Vocês administram imóveis para proprietários?" },
      { topic: "Regiões atendidas", question: "Em quais bairros/regiões vocês atuam?" },
    ],
  },
  "pet-shop": {
    name: "Pet Shop",
    topics: [
      { topic: "Banho e tosa", question: "Como funcionam banho e tosa (preços por porte, agendamento)?" },
      { topic: "Consulta veterinária", question: "Vocês têm atendimento veterinário? Como funciona?" },
      { topic: "Vacinação", question: "Quais vacinas vocês aplicam e como agendar?" },
      { topic: "Vermifugação", question: "Vocês fazem vermifugação? Como funciona?" },
      { topic: "Hotel e creche", question: "Vocês têm hotel ou creche para pets?" },
      { topic: "Táxi pet", question: "Vocês buscam e levam os pets (táxi pet)?" },
      { topic: "Produtos", question: "Quais produtos vocês vendem (ração, acessórios, medicamentos)?" },
      { topic: "Horários", question: "Quais os horários de funcionamento?" },
      { topic: "Formas de pagamento", question: "Quais formas de pagamento vocês aceitam?" },
    ],
  },
  clinica: {
    name: "Clínica",
    topics: [
      { topic: "Especialidades e serviços", question: "Quais especialidades e procedimentos vocês oferecem?" },
      { topic: "Agendamento", question: "Como funciona o agendamento de consultas?" },
      { topic: "Convênios", question: "Quais convênios vocês aceitam?" },
      { topic: "Valores particulares", question: "Quais os valores das consultas e procedimentos particulares?" },
      { topic: "Horários", question: "Quais os horários de atendimento?" },
      { topic: "Retornos", question: "Como funcionam os retornos? Têm custo?" },
      { topic: "Urgências", question: "Vocês atendem urgências ou encaixes?" },
      { topic: "Formas de pagamento", question: "Quais formas de pagamento e parcelamentos vocês aceitam?" },
      { topic: "Preparo e documentos", question: "O paciente precisa levar algo ou fazer algum preparo?" },
    ],
  },
};

// ——— Parsers puros (testáveis) ———

export interface SegmentHypothesis {
  area: string;
  confidence: number;
}

const hypothesesSchema = z.object({
  hipoteses: z
    .array(
      z.object({
        area: z.string().trim().min(3).max(60),
        confianca: z.number().min(0).max(100),
      }),
    )
    .max(5),
});

/** Hipóteses ranqueadas de área de atuação — sugestão, nunca decisão. (puro) */
export function parseSegmentHypotheses(raw: string): SegmentHypothesis[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  const parsed = hypothesesSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
  if (!parsed.success) return [];
  return parsed.data.hipoteses
    .map((h) => ({ area: h.area.trim(), confidence: Math.round(h.confianca) }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

const topicsSchema = z.object({
  topicos: z
    .array(
      z.object({
        assunto: z.string().trim().min(2).max(80),
        pergunta: z.string().trim().min(8).max(200),
      }),
    )
    .min(3)
    .max(15),
});

export function parseSegmentTopics(raw: string): SegmentTopic[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Template sem JSON");
  const parsed = topicsSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
  if (!parsed.success) throw new Error("Template fora do formato");
  return parsed.data.topicos.slice(0, 12).map((t) => ({ topic: t.assunto, question: t.pergunta }));
}

// ——— Descoberta Assistida: a IA gera hipóteses, a EMPRESA decide ———

const SUGGEST_PROMPT = `Você ajuda a descobrir a área de atuação de uma empresa. Gere HIPÓTESES, nunca uma decisão.
Devolva SOMENTE JSON: {"hipoteses":[{"area":"...","confianca":94}, ...]}
- Até 3 hipóteses, da mais provável para a menos provável.
- "area": rótulo curto em português (ex.: "Academia", "Restaurante", "Imobiliária", "Pet Shop", "Clínica", "Salão de Beleza", "Autoescola", "Energia Solar", "Loja de Roupas"...).
- "confianca": número de 0 a 100.
- Se não houver informação suficiente, devolva {"hipoteses":[]}. Nunca invente.`;

export async function suggestSegments(
  companyName: string,
  description: string,
): Promise<SegmentHypothesis[]> {
  try {
    const content = await jsonCompletion(
      SUGGEST_PROMPT,
      `Nome da empresa: ${companyName}\nDescrição: ${description || "(sem descrição)"}`,
      300,
    );
    return parseSegmentHypotheses(content);
  } catch (error) {
    await logError("segment-suggest", error);
    return [];
  }
}

/** Combina os tópicos de vários templates, sem duplicar assuntos. (puro) */
export function mergeTopics(lists: SegmentTopic[][], cap = 18): SegmentTopic[] {
  const seen = new Set<string>();
  const merged: SegmentTopic[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = normalizeQuestionKey(item.question);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= cap) return merged;
    }
  }
  return merged;
}

/** Templates das áreas escolhidas pela empresa, combinados (Template Universal ∪). */
export async function getTemplatesForSegments(
  labels: string[],
): Promise<{ names: string[]; topics: SegmentTopic[] } | null> {
  const results = await Promise.all(labels.slice(0, 3).map((label) => getOrCreateTemplate(label)));
  const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
  if (!found.length) return null;
  return { names: found.map((f) => f.name), topics: mergeTopics(found.map((f) => f.topics)) };
}

// ——— Template: semente ou gerado uma vez ———

const GENERATE_PROMPT = `Você prepara o roteiro de integração de um novo atendente que vai trabalhar em uma empresa de um segmento específico.
Liste os assuntos que um atendente experiente DESSE SEGMENTO normalmente domina, com uma pergunta de entrevista para a empresa responder sobre cada um.
Devolva SOMENTE JSON: {"topicos":[{"assunto":"...","pergunta":"..."}]}
- 8 a 12 assuntos, do mais comum ao menos comum.
- Perguntas diretas, em português, na segunda pessoa ("Vocês...").
- Assuntos UNIVERSAIS do segmento (serviços típicos, horários, pagamento, políticas comuns) — nunca dados específicos de uma empresa.`;

/** Busca o template global do segmento; semeia da curadoria ou gera por IA (uma vez). */
export async function getOrCreateTemplate(
  label: string,
): Promise<{ slug: string; name: string; topics: SegmentTopic[] } | null> {
  const slug = slugifySegment(label);
  if (!slug) return null;

  const existing = await prisma.segmentTemplate.findUnique({ where: { slug } });
  if (existing) {
    return { slug, name: existing.name, topics: existing.topics as unknown as SegmentTopic[] };
  }

  const seed = SEED_TEMPLATES[slug];
  if (seed) {
    await prisma.segmentTemplate.create({
      data: { slug, name: seed.name, topics: seed.topics as object[], source: "SEED" },
    });
    return { slug, name: seed.name, topics: seed.topics };
  }

  try {
    const content = await jsonCompletion(GENERATE_PROMPT, `Segmento: ${label}`, 1024);
    const topics = parseSegmentTopics(content);
    const name = label.trim().slice(0, 60);
    await prisma.segmentTemplate.create({
      data: { slug, name, topics: topics as unknown as object[], source: "AI_GENERATED" },
    });
    return { slug, name, topics };
  } catch (error) {
    await logError("segment-template", error);
    return null;
  }
}

/**
 * Inicia a entrevista de integração: cada tópico escolhido vira uma pergunta
 * na fila de treinamento (source INTERVIEW, prioridade abaixo das dúvidas de
 * clientes reais). Passa pelo MESMO ciclo: responder → estruturar → aprovar.
 */
export async function startInterview(companyId: string, topics: SegmentTopic[]): Promise<number> {
  let created = 0;
  for (const item of topics.slice(0, 15)) {
    const questionKey = normalizeQuestionKey(item.question);
    if (questionKey.length < 4) continue;
    try {
      await prisma.knowledgeGap.upsert({
        where: { companyId_questionKey: { companyId, questionKey } },
        create: {
          companyId,
          questionKey,
          question: item.question,
          source: "INTERVIEW",
          reason: `Integração — ${item.topic}`,
          askCount: 0,
        },
        update: {},
      });
      created += 1;
    } catch (error) {
      await logError("segment-interview", error, companyId);
    }
  }

  await prisma.companyProfile.update({
    where: { companyId },
    data: { interviewStartedAt: new Date() },
  });
  return created;
}
