import { z } from "zod";
import { problemaNoGateway } from "./endereco";
import { textoDeMidiaNaoInterpretada, type TipoDeMidia } from "./midia";

/** Texto ou registro explícito de mídia não interpretada recebido via webhook. */
export interface IncomingWhatsAppMessage {
  instance: string;
  phone: string;
  text: string;
  senderName: string | null;
  messageId: string | null;
}

const webhookSchema = z
  .object({
    event: z.string(),
    instance: z.string().min(1),
    data: z.object({
      key: z.object({
        remoteJid: z.string(),
        fromMe: z.boolean().optional(),
        id: z.string().optional(),
      }),
      pushName: z.string().nullish(),
      // Segundos desde 1970, pelo relógio do WhatsApp. Separa sincronização de
      // histórico do dono respondendo agora (lib/plantao/dono.ts).
      messageTimestamp: z.union([z.number(), z.string()]).optional(),
      message: z
        .object({
          conversation: z.string().optional(),
          extendedTextMessage: z.object({ text: z.string() }).optional(),
        })
        .passthrough()
        .nullish(),
    }),
  })
  .passthrough();

const MAX_TEXT_LENGTH = 4000;

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null;
}

/** Abre somente envelopes de mensagem conhecidos, com profundidade limitada. */
function conteudoDaMensagem(valor: unknown): Record<string, unknown> | null {
  let mensagem = objeto(valor);
  for (let profundidade = 0; mensagem && profundidade < 4; profundidade++) {
    const envelope = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "documentWithCaptionMessage"]
      .map((chave) => objeto(mensagem![chave]))
      .find((item) => objeto(item?.message));
    if (!envelope) return mensagem;
    mensagem = objeto(envelope.message);
  }
  return mensagem;
}

function textoRecebido(valor: unknown): string {
  const mensagem = conteudoDaMensagem(valor);
  if (!mensagem) return "";
  const tipos: [string, TipoDeMidia][] = [
    ["audioMessage", "audio"], ["imageMessage", "imagem"], ["documentMessage", "documento"],
    ["videoMessage", "video"], ["stickerMessage", "figurinha"],
  ];
  for (const [chave, tipo] of tipos) {
    const midia = objeto(mensagem[chave]);
    if (!midia) continue;
    // Caption é texto digitado pelo remetente. URL, nome de arquivo e metadados
    // não são uma transcrição nem uma descrição confiável do conteúdo.
    const legenda = typeof midia.caption === "string" ? midia.caption.trim() : "";
    return textoDeMidiaNaoInterpretada(tipo, legenda).slice(0, MAX_TEXT_LENGTH);
  }
  const estendida = objeto(mensagem.extendedTextMessage);
  const texto = typeof mensagem.conversation === "string"
    ? mensagem.conversation
    : typeof estendida?.text === "string" ? estendida.text : "";
  return texto.trim().slice(0, MAX_TEXT_LENGTH);
}

/**
 * Valida e normaliza o payload do webhook. Retorna null para tudo que não é
 * mensagem de contato individual. Mídias conhecidas viram um registro explícito
 * de conteúdo não interpretado; grupos, envios próprios e status são ignorados.
 */
export function parseWebhookPayload(payload: unknown): IncomingWhatsAppMessage | null {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  const { event, instance, data } = parsed.data;

  const normalizedEvent = event.toLowerCase().replace(/_/g, ".");
  if (normalizedEvent !== "messages.upsert") return null;

  if (data.key.fromMe) return null;

  const jid = data.key.remoteJid;
  if (!jid.endsWith("@s.whatsapp.net")) return null; // ignora grupos e broadcast

  const phone = jid.split("@")[0].replace(/\D/g, "");
  if (phone.length < 8) return null;

  const text = textoRecebido(data.message);
  if (!text) return null;

  return {
    instance,
    phone,
    text,
    senderName: data.pushName?.trim() || null,
    messageId: data.key.id ?? null,
  };
}

/** Mensagem que saiu do número do dono: digitada por ele ou eco de um envio da Nexora. */
export interface MensagemDoDono {
  instance: string;
  /** O cliente com quem o dono está falando. */
  phone: string;
  messageId: string | null;
  /** Quando a mensagem saiu, pelo relógio do WhatsApp. null quando não veio. */
  enviadaEm: Date | null;
  /** O texto que o dono digitou no celular (se for mensagem de texto). */
  text?: string | null;
}

function lerHorario(valor: unknown): Date | null {
  const segundos =
    typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : Number.NaN;
  return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : null;
}

/**
 * A MENSAGEM QUE SAIU DO NÚMERO DO DONO.
 *
 * `parseWebhookPayload` descarta tudo que é `fromMe`, e por isso o sistema não
 * via quando o dono respondia pelo celular. Este leitor pega exatamente essas
 * mensagens — de qualquer tipo, porque responder com foto ou áudio também é o
 * dono assumindo. Ele não decide nada: a mesma entrada pode ser o dono
 * digitando ou o eco de um envio da própria Nexora, e quem separa uma coisa da
 * outra é lib/plantao/dono.ts.
 */
export function parseMensagemDoDono(payload: unknown): MensagemDoDono | null {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  const { event, instance, data } = parsed.data;
  if (event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;
  if (!data.key.fromMe) return null;

  const jid = data.key.remoteJid;
  if (!jid.endsWith("@s.whatsapp.net")) return null; // grupos e listas de transmissão

  const phone = jid.split("@")[0].replace(/\D/g, "");
  if (phone.length < 8) return null;

  const rawText = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "";
  const text = rawText.trim().slice(0, MAX_TEXT_LENGTH) || null;

  return {
    instance,
    phone,
    messageId: data.key.id ?? null,
    enviadaEm: lerHorario(data.messageTimestamp),
    text,
  };
}

// ——— Cliente REST da Evolution API (v2) ———

const DEFAULT_EVOLUTION_URL = "https://evolution-api-latest-1-mqkm.onrender.com";
const DEFAULT_EVOLUTION_KEY = "nexora-secret-key-2026";

function evolutionConfig(): { baseUrl: string; apiKey: string } {
  let baseUrl = process.env.EVOLUTION_API_URL?.trim();
  let apiKey = process.env.EVOLUTION_API_KEY?.trim();

  // Em produção, se a variável na Vercel ainda apontar para a Railway desativada (que responde 404),
  // ou se não foi definida no ambiente da Vercel, redireciona de forma resiliente para a Evolution no Render.
  if (baseUrl && baseUrl.includes("railway.app")) {
    baseUrl = DEFAULT_EVOLUTION_URL;
    apiKey = DEFAULT_EVOLUTION_KEY;
  } else if (!baseUrl && process.env.NODE_ENV === "production" && (process.env.VERCEL || process.env.VERCEL_ENV)) {
    baseUrl = DEFAULT_EVOLUTION_URL;
    apiKey = apiKey || DEFAULT_EVOLUTION_KEY;
  }

  if (!baseUrl || !apiKey) {
    throw new Error("EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados");
  }

  // Por este endereço passa a conversa do cliente, com nome e telefone. Em
  // produção ele não pode ser um túnel de desenvolvimento nem HTTP puro —
  // ver lib/whatsapp/endereco.ts para o porquê de cada regra. Falhar aqui,
  // alto, é melhor do que funcionar por um tempo e vazar depois.
  const problema = problemaNoGateway(baseUrl, process.env.NODE_ENV);
  if (problema) throw new Error(problema);

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function evoFetch(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const { baseUrl, apiKey } = evolutionConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Evolution API respondeu ${res.status} em ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/**
 * O id que a Evolution dá à mensagem que acabou de sair. Sem ele, o eco dela no
 * webhook é indistinguível do dono digitando no celular.
 */
export function idDoEnvio(resposta: unknown): string | null {
  const id = (resposta as { key?: { id?: unknown } } | null)?.key?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** `atrasoMs`: a Evolution mostra "digitando…" por esse tempo antes de enviar. */
export type OpcoesDeEnvio = { atrasoMs?: number };

/**
 * Envia mensagem de texto pelo WhatsApp via Evolution API.
 *
 * Não chame direto: use `enviarWhatsApp` (lib/whatsapp/envio.ts), que registra
 * o id do envio. tests/envio-whatsapp.test.ts trava isso.
 */
export async function sendWhatsAppText(
  instance: string,
  phone: string,
  text: string,
  opcoes?: OpcoesDeEnvio,
): Promise<{ messageId: string | null }> {
  const resposta = await evoFetch(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: { number: phone, text, ...(opcoes?.atrasoMs ? { delay: opcoes.atrasoMs } : {}) },
  });
  return { messageId: idDoEnvio(resposta) };
}

/**
 * Formata um telefone para o formato internacional aceito pela Evolution API / WhatsApp.
 * Telefones com DDD brasileiro (10 ou 11 dígitos) recebem o prefixo 55.
 */
export function formatarNumeroWhatsApp(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) return "";
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    return `55${cleanPhone}`;
  }
  if (cleanPhone.length >= 12 && cleanPhone.startsWith("55")) {
    return cleanPhone;
  }
  return cleanPhone;
}

/**
 * Cria a instância na Evolution. Se já existir ou estiver acessível, segue em frente sem erro
 * (a Evolution devolve 400/403/409 quando já existe ou sob conflito de integração/sessão).
 * Se phone for fornecido, a instância é criada especificamente para pareamento por número (qrcode: false).
 */
export async function createInstance(instance: string, phone?: string): Promise<void> {
  const fullPhone = phone ? formatarNumeroWhatsApp(phone) : null;
  const payload: Record<string, unknown> = {
    instanceName: instance,
    qrcode: !fullPhone,
    integration: "WHATSAPP-BAILEYS",
  };
  if (fullPhone) {
    payload.number = fullPhone;
  }

  try {
    await evoFetch("/instance/create", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    const message = String(error).toLowerCase();
    if (
      message.includes("already") ||
      message.includes("in use") ||
      message.includes("403") ||
      message.includes("integrationsession") ||
      message.includes("p2025")
    ) {
      return;
    }

    // Se deu outro erro (ex: 400 Bad Request), verifica se a instância já responde no connectionState
    try {
      const state = await getConnectionState(instance);
      if (state !== null) return;
    } catch {
      // Ignora erro de verificação
    }

    // Se estiver em estado quebrado, tenta remover e recriar limpa uma única vez
    try {
      await deleteInstance(instance).catch(() => {});
      await evoFetch("/instance/create", {
        method: "POST",
        body: payload,
      });
      return;
    } catch {
      throw error;
    }
  }
}

/** Estado da conexão: "open" (conectado), "connecting" (aguardando QR) ou "close". */
export async function getConnectionState(instance: string): Promise<string | null> {
  const data = (await evoFetch(`/instance/connectionState/${encodeURIComponent(instance)}`)) as {
    instance?: { state?: string };
    state?: string;
  };
  return data.instance?.state ?? data.state ?? null;
}

/**
 * Valida se uma string é realmente um código de pareamento do WhatsApp (6 a 12 caracteres alfanuméricos).
 * Impede que a string interna de QR Code bruto da Baileys/Evolution ("2@...", com mais de 100 caracteres)
 * vaze como pairingCode.
 */
export function isPairingCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  const limpo = code.trim();
  if (limpo.length < 6 || limpo.length > 12) return false;
  if (limpo.includes("@") || limpo.includes(",") || limpo.includes("/") || limpo.includes("+")) return false;
  return /^[A-Za-z0-9-]+$/.test(limpo);
}

/**
 * Inicia a conexão e retorna o QR Code (data URL base64) ou o Código de Pareamento (pairingCode).
 * Se o número já estiver conectado, retorna state "open" sem QR.
 */
export async function connectInstance(
  instance: string,
  phone?: string,
): Promise<{ qrCode: string | null; pairingCode: string | null; state: string | null }> {
  const fullPhone = phone ? formatarNumeroWhatsApp(phone) : null;

  const url = fullPhone
    ? `/instance/connect/${encodeURIComponent(instance)}?number=${encodeURIComponent(fullPhone)}`
    : `/instance/connect/${encodeURIComponent(instance)}`;

  const data = (await evoFetch(url)) as {
    base64?: string;
    code?: string;
    pairingCode?: string;
    qrcode?: { base64?: string };
    instance?: { state?: string };
  };

  const qrCode = data.base64 ?? data.qrcode?.base64 ?? null;
  const rawPairing = isPairingCode(data.pairingCode)
    ? data.pairingCode
    : isPairingCode(data.code)
    ? data.code
    : null;
  const pairingCode = rawPairing ? rawPairing.replace(/[^A-Za-z0-9-]/g, "").toUpperCase() : null;

  return { qrCode, pairingCode, state: data.instance?.state ?? null };
}

const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"];

/** Configura o webhook da instância para o Nexora Atendente (formato v2). */
export async function setWebhook(instance: string, url: string): Promise<void> {
  await evoFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: true,
        events: WEBHOOK_EVENTS,
      },
    },
  });
}

/** Desconecta o número da instância (mantém a instância). */
export async function logoutInstance(instance: string): Promise<void> {
  await evoFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE" });
}

/** Remove a instância por completo. */
export async function deleteInstance(instance: string): Promise<void> {
  await evoFetch(`/instance/delete/${encodeURIComponent(instance)}`, { method: "DELETE" });
}

// ——— Parsers de eventos do webhook (puros, testáveis) ———

const connectionUpdateSchema = z
  .object({
    event: z.string(),
    instance: z.string().min(1),
    data: z.object({ state: z.string().optional(), connection: z.string().optional() }).passthrough(),
  })
  .passthrough();

/** Extrai instância + estado de um evento CONNECTION_UPDATE. */
export function parseConnectionUpdate(payload: unknown): { instance: string; state: string } | null {
  const parsed = connectionUpdateSchema.safeParse(payload);
  if (!parsed.success) return null;
  if (parsed.data.event.toLowerCase().replace(/_/g, ".") !== "connection.update") return null;
  const state = parsed.data.data.state ?? parsed.data.data.connection;
  if (!state) return null;
  return { instance: parsed.data.instance, state };
}

const qrUpdateSchema = z
  .object({
    event: z.string(),
    instance: z.string().min(1),
    data: z
      .object({
        qrcode: z.object({ base64: z.string().min(1) }).passthrough().optional(),
        base64: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

/** Extrai instância + QR (base64) de um evento QRCODE_UPDATED. */
export function parseQrUpdate(payload: unknown): { instance: string; qrCode: string } | null {
  const parsed = qrUpdateSchema.safeParse(payload);
  if (!parsed.success) return null;
  if (parsed.data.event.toLowerCase().replace(/_/g, ".") !== "qrcode.updated") return null;
  const qrCode = parsed.data.data.qrcode?.base64 ?? parsed.data.data.base64;
  if (!qrCode) return null;
  return { instance: parsed.data.instance, qrCode };
}
