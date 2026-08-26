import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Camada genérica de IA do Atendente.
 *
 * Provedor configurável por env (AI_PROVIDER): groq (padrão), openai,
 * anthropic, ollama. Todos retornam o mesmo formato estruturado
 * (ReceptionistReply); a validação é sempre feita com zod antes do uso.
 */

export interface HistoryMessage {
  role: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  content: string;
}

export interface ReceptionistInput {
  systemPrompt: string;
  history: HistoryMessage[];
}

const boolish = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean(),
);

// Atendente responde curto (1–3 frases). Este é o teto de segurança: se o
// modelo passar do limite, cortamos no fim da última frase completa.
export const MAX_REPLY_LENGTH = 500;

function truncateReply(text: string): string {
  if (text.length <= MAX_REPLY_LENGTH) return text;
  const slice = text.slice(0, MAX_REPLY_LENGTH);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  return lastSentenceEnd > 120 ? slice.slice(0, lastSentenceEnd + 1).trim() : `${slice.trim()}…`;
}

export const receptionistReplySchema = z.object({
  resposta: z.string().trim().min(1).transform(truncateReply),
  transferir_humano: boolish,
  motivo_transferencia: z.string().trim().default(""),
  nome_cliente: z.string().trim().default(""),
  interesse: z.string().trim().default(""),
});

export type ReceptionistReply = z.infer<typeof receptionistReplySchema>;

// Contexto enxuto = resposta rápida: só as últimas mensagens relevantes,
// cada uma com teto de caracteres. O cadastro da empresa vai no system prompt.
export const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS_PER_MESSAGE = 600;
const MAX_OUTPUT_TOKENS = 512;

/** Timeout da chamada de IA — estourou, cai no fallback honesto (equipe). */
function aiTimeoutMs(): number {
  return Math.max(3000, parseInt(process.env.AI_TIMEOUT_MS ?? "12000", 10) || 12000);
}

const PROVIDERS = ["groq", "openai", "anthropic", "ollama"] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada para o AI_PROVIDER atual`);
  return value;
}

/** Converte o histórico do banco para turnos user/assistant (limitado e truncado). */
export function toChatMessages(history: HistoryMessage[]): { role: "user" | "assistant"; content: string }[] {
  const mapped: { role: "user" | "assistant"; content: string }[] = [];

  for (const message of history.slice(-MAX_HISTORY_MESSAGES)) {
    if (message.role === "SYSTEM") continue;
    const content = message.content.trim().slice(0, MAX_HISTORY_CHARS_PER_MESSAGE);
    if (!content) continue;
    mapped.push({ role: message.role === "CUSTOMER" ? "user" : "assistant", content });
  }

  // O primeiro turno precisa ser do cliente
  while (mapped.length && mapped[0].role !== "user") mapped.shift();
  if (!mapped.length) throw new Error("Histórico vazio: nada para responder");

  return mapped;
}

const JSON_FORMAT_INSTRUCTIONS = `

# Formato da resposta (obrigatório)
Responda SOMENTE com um objeto JSON válido, sem nenhum texto fora dele, neste formato:
{"resposta": "...", "transferir_humano": false, "motivo_transferencia": "", "nome_cliente": "", "interesse": ""}
- "resposta": a mensagem ao cliente (texto de WhatsApp)
- "transferir_humano": true apenas se a conversa deve ir para a equipe da empresa
- "motivo_transferencia": motivo curto da transferência ("" quando transferir_humano for false)
- "nome_cliente": nome do cliente, apenas se ele informou nesta conversa ("" caso contrário)
- "interesse": resumo curto (até 10 palavras) do que o cliente procura ("" se ainda não identificado)`;

/** Extrai e valida o JSON estruturado retornado por qualquer provedor. */
export function parseReceptionistReply(raw: string): ReceptionistReply {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Provedor de IA não retornou JSON");
  }

  let data: unknown;
  try {
    data = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("Provedor de IA retornou JSON inválido");
  }

  const parsed = receptionistReplySchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Resposta da IA fora do formato esperado: ${parsed.error.message}`);
  }
  return parsed.data;
}

interface ChatCompletionsConfig {
  name: string;
  url: string;
  apiKey: string;
  model: string;
}

/** Groq e OpenAI usam a mesma API (chat/completions com json_object). */
async function chatCompletions(cfg: ChatCompletionsConfig, input: ReceptionistInput): Promise<ReceptionistReply> {
  const res = await fetch(cfg.url, {
    method: "POST",
    signal: AbortSignal.timeout(aiTimeoutMs()),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt + JSON_FORMAT_INSTRUCTIONS },
        ...toChatMessages(input.history),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${cfg.name} respondeu ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${cfg.name} não retornou conteúdo`);

  return parseReceptionistReply(content);
}

async function ollamaChat(input: ReceptionistInput): Promise<ReceptionistReply> {
  const baseUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(aiTimeoutMs()),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0.3 },
      messages: [
        { role: "system", content: input.systemPrompt + JSON_FORMAT_INSTRUCTIONS },
        ...toChatMessages(input.history),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama respondeu ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  if (!data.message?.content) throw new Error("Ollama não retornou conteúdo");

  return parseReceptionistReply(data.message.content);
}

const anthropicTool: Anthropic.Tool = {
  name: "enviar_resposta",
  description:
    "Envia a resposta do atendente ao cliente no WhatsApp e registra sinais estruturados da conversa (transferência para a equipe e dados de qualificação).",
  input_schema: {
    type: "object",
    properties: {
      resposta: { type: "string", description: "Texto da resposta ao cliente, no formato de mensagem de WhatsApp." },
      transferir_humano: {
        type: "boolean",
        description: "true se esta conversa deve ser transferida para a equipe da empresa após enviar a resposta.",
      },
      motivo_transferencia: {
        type: "string",
        description: "Motivo curto da transferência. String vazia se transferir_humano for false.",
      },
      nome_cliente: {
        type: "string",
        description: "Nome do cliente, apenas se ele informou nesta conversa. String vazia caso contrário.",
      },
      interesse: {
        type: "string",
        description: "Resumo curto (até 10 palavras) do que o cliente procura. String vazia se ainda não identificado.",
      },
    },
    required: ["resposta", "transferir_humano"],
  },
};

async function anthropicChat(input: ReceptionistInput): Promise<ReceptionistReply> {
  requireEnv("ANTHROPIC_API_KEY");
  const client = new Anthropic({ timeout: aiTimeoutMs(), maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: input.systemPrompt,
    tools: [anthropicTool],
    tool_choice: { type: "tool", name: "enviar_resposta" },
    messages: toChatMessages(input.history),
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(`Anthropic não retornou resposta estruturada (stop_reason: ${response.stop_reason})`);
  }

  const parsed = receptionistReplySchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Resposta da IA fora do formato esperado: ${parsed.error.message}`);
  }
  return parsed.data;
}

// ——— NALS: estruturação de conhecimento no treinamento ———

const structuredKnowledgeSchema = z.object({
  pergunta: z.string().trim().min(4).max(300),
  resposta: z.string().trim().min(2).max(1500),
});

/** Valida o JSON de estruturação devolvido pelo modelo (puro, testável). */
export function parseStructuredKnowledge(raw: string): { question: string; answer: string } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Estruturação sem JSON");

  const parsed = structuredKnowledgeSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
  if (!parsed.success) throw new Error("Estruturação fora do formato");
  return { question: parsed.data.pergunta, answer: parsed.data.resposta };
}

const STRUCTURER_PROMPT = `Você organiza o manual interno de uma empresa. Receberá uma dúvida de clientes e a resposta que a empresa escreveu de forma livre.

Devolva SOMENTE um JSON válido: {"pergunta": "...", "resposta": "..."}
- "pergunta": a dúvida reescrita de forma canônica e clara, na voz do cliente.
- "resposta": a informação organizada em 1 a 3 frases objetivas, pronta para um atendente usar.
- Preserve EXATAMENTE todos os números, valores, faixas, prazos e condições informados (ex.: "até 4 unidades: R$ 800; acima disso: orçamento com a equipe").
- NUNCA invente, complete ou deduza nada que a empresa não escreveu.`;

/**
 * Chamada JSON genérica (tarefas internas: estruturação, segmento...).
 * Usa o provedor compatível com chat/completions configurado (groq/openai).
 */
export async function jsonCompletion(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 512,
): Promise<string> {
  const provider = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();
  const cfg =
    provider === "openai"
      ? {
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: requireEnv("OPENAI_API_KEY"),
          model: process.env.OPENAI_MODEL || "gpt-4.1-nano",
        }
      : {
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: requireEnv("GROQ_API_KEY"),
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        };

  const res = await fetch(cfg.url, {
    method: "POST",
    signal: AbortSignal.timeout(aiTimeoutMs()),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Chamada JSON falhou: ${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Chamada JSON sem conteúdo");
  return content;
}

/**
 * Estrutura a resposta livre da empresa em pergunta canônica + resposta clara.
 * Em qualquer falha o chamador usa o texto original — nunca bloqueia o treino.
 */
export async function structureTrainedAnswer(
  question: string,
  answer: string,
): Promise<{ question: string; answer: string }> {
  const content = await jsonCompletion(
    STRUCTURER_PROMPT,
    `Dúvida dos clientes: ${question}\n\nResposta da empresa: ${answer}`,
  );
  return parseStructuredKnowledge(content);
}

/**
 * Interface única do Atendente: gera a resposta estruturada usando o provedor
 * configurado em AI_PROVIDER (padrão: groq, o de menor custo por conversa).
 * Falhas sobem para o chamador, que aplica o fallback honesto + ErrorLog.
 */
export async function generateReceptionistReply(input: ReceptionistInput): Promise<ReceptionistReply> {
  const provider = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();

  switch (provider) {
    case "groq":
      return chatCompletions(
        {
          name: "Groq",
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: requireEnv("GROQ_API_KEY"),
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        },
        input,
      );
    case "openai":
      return chatCompletions(
        {
          name: "OpenAI",
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: requireEnv("OPENAI_API_KEY"),
          model: process.env.OPENAI_MODEL || "gpt-4.1-nano",
        },
        input,
      );
    case "anthropic":
      return anthropicChat(input);
    case "ollama":
      return ollamaChat(input);
    default:
      throw new Error(`AI_PROVIDER inválido: "${provider}" (opções: ${PROVIDERS.join(", ")})`);
  }
}
