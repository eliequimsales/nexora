import { z } from "zod";
import { problemaNoGateway } from "./endereco";

/** Mensagem de texto recebida via webhook da Evolution API (v2). */
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

/**
 * Valida e normaliza o payload do webhook. Retorna null para tudo que não é
 * mensagem de texto recebida de um contato individual (grupos, mensagens
 * enviadas por nós, mídia, eventos de status etc.).
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

  const rawText = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "";
  const text = rawText.trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) return null;

  return {
    instance,
    phone,
    text,
    senderName: data.pushName?.trim() || null,
    messageId: data.key.id ?? null,
  };
}

// ——— Cliente REST da Evolution API (v2) ———

function evolutionConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
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

/** Envia mensagem de texto pelo WhatsApp via Evolution API. */
export async function sendWhatsAppText(instance: string, phone: string, text: string): Promise<void> {
  await evoFetch(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: { number: phone, text },
  });
}

/**
 * Cria a instância na Evolution. Se já existir, segue em frente sem erro
 * (a Evolution devolve 403/409 com "already in use").
 */
export async function createInstance(instance: string): Promise<void> {
  try {
    await evoFetch("/instance/create", {
      method: "POST",
      body: { instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    });
  } catch (error) {
    const message = String(error).toLowerCase();
    if (message.includes("already") || message.includes("in use") || message.includes("403")) return;
    throw error;
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
 * Inicia a conexão e retorna o QR Code (data URL base64) quando disponível.
 * Se o número já estiver conectado, retorna state "open" sem QR.
 */
export async function connectInstance(
  instance: string,
): Promise<{ qrCode: string | null; state: string | null }> {
  const data = (await evoFetch(`/instance/connect/${encodeURIComponent(instance)}`)) as {
    base64?: string;
    code?: string;
    qrcode?: { base64?: string };
    instance?: { state?: string };
  };

  const qrCode = data.base64 ?? data.qrcode?.base64 ?? null;
  return { qrCode, state: data.instance?.state ?? null };
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
