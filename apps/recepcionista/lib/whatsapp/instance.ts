import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  connectInstance,
  createInstance,
  getConnectionState,
  isPairingCode,
  setWebhook,
} from "./evolution";

export type WhatsAppStatus = "DISCONNECTED" | "WAITING_QR" | "CONNECTED" | "ERROR";

export interface WhatsAppState {
  status: WhatsAppStatus;
  qrCode: string | null;
  pairingCode?: string | null;
  connectedAt: string | null;
  error: string | null;
}

const ERRO_RECEBIMENTO = "Não foi possível preparar o recebimento de mensagens. Tente conectar novamente.";

/** Nome padrão da instância Evolution de uma empresa. */
export function instanceNameFor(companyId: string): string {
  return `nexora-${companyId}`;
}

function webhookUrl(): string {
  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://www.meunexora.com.br";
  if (!appUrl) throw new Error("APP_URL não configurada (necessária para o webhook do WhatsApp)");
  const token = process.env.WEBHOOK_TOKEN?.trim();
  if (!token) throw new Error("WEBHOOK_TOKEN não configurado (necessário para receber mensagens)");
  const url = new URL(`${appUrl.replace(/\/+$/, "")}/api/webhook/whatsapp`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error("APP_URL inválida para receber mensagens do WhatsApp");
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function mapState(state: string | null): WhatsAppStatus {
  if (state === "open") return "CONNECTED";
  if (state === "connecting") return "WAITING_QR";
  return "DISCONNECTED";
}

async function saveState(
  companyId: string,
  data: {
    whatsappInstance?: string;
    whatsappStatus?: WhatsAppStatus;
    whatsappQrCode?: string | null;
    whatsappConnectedAt?: Date | null;
    whatsappError?: string | null;
  },
) {
  await prisma.companyProfile.update({ where: { companyId }, data });
}

function toState(
  profile: {
    whatsappStatus: string;
    whatsappQrCode: string | null;
    whatsappConnectedAt: Date | null;
    whatsappError: string | null;
  },
  pairingCode: string | null = null,
): WhatsAppState {
  return {
    status: (profile.whatsappStatus as WhatsAppStatus) ?? "DISCONNECTED",
    qrCode: profile.whatsappQrCode,
    pairingCode,
    connectedAt: profile.whatsappConnectedAt?.toISOString() ?? null,
    error: profile.whatsappError,
  };
}

/**
 * Cria (se necessário) a instância da empresa na Evolution, configura o
 * webhook automaticamente e gera o QR Code ou Código de Pareamento para conexão.
 */
export async function connectWhatsApp(companyId: string, phone?: string): Promise<WhatsAppState> {
  const name = instanceNameFor(companyId);
  let pairingCode: string | null = null;
  let recebimentoConfigurado = false;

  try {
    const webhook = webhookUrl();
    await createInstance(name, phone);
    // Sem o webhook, o telefone pode conectar sem entregar mensagens ao atendente.
    await setWebhook(name, webhook);
    recebimentoConfigurado = true;
    const result = await connectInstance(name, phone);
    pairingCode = isPairingCode(result.pairingCode) ? result.pairingCode.trim() : null;

    if (result.state === "open") {
      await saveState(companyId, {
        whatsappInstance: name,
        whatsappStatus: "CONNECTED",
        whatsappQrCode: null,
        whatsappConnectedAt: new Date(),
        whatsappError: null,
      });
      pairingCode = null;
    } else {
      const qrCode =
        result.qrCode && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result.qrCode)
          ? result.qrCode : null;
      if (!pairingCode && !qrCode) {
        throw new Error("O WhatsApp não retornou um código ou QR válido. Tente gerar novamente sem desconectar a sessão existente.");
      }
      await saveState(companyId, {
        whatsappInstance: name,
        whatsappStatus: "WAITING_QR",
        whatsappQrCode: qrCode,
        whatsappConnectedAt: null,
        whatsappError: null,
      });
    }
  } catch (error) {
    const message = recebimentoConfigurado
      ? error instanceof Error ? error.message : String(error)
      : ERRO_RECEBIMENTO;
    pairingCode = null;
    await logError("whatsapp-connect", error, companyId).catch(() => {});
    await saveState(companyId, { whatsappStatus: "ERROR", whatsappQrCode: null, whatsappError: message });
  }

  const profile = await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } });
  return toState(profile, pairingCode);
}

/** Consulta o estado real na Evolution e sincroniza o banco. */
export async function refreshWhatsAppStatus(companyId: string): Promise<WhatsAppState> {
  const profile = await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } });

  if (!profile.whatsappInstance) return toState(profile);
  // O estado físico "open" não comprova que a Nexora recebe mensagens. Somente
  // uma nova conexão configurada ou um webhook autenticado supera essa falha.
  if (profile.whatsappStatus === "ERROR" && profile.whatsappError === ERRO_RECEBIMENTO) return toState(profile);

  try {
    const state = await getConnectionState(profile.whatsappInstance);
    const status = mapState(state);
    await saveState(companyId, {
      whatsappStatus: status,
      whatsappError: null,
      ...(status === "CONNECTED"
        ? { whatsappQrCode: null, whatsappConnectedAt: profile.whatsappConnectedAt ?? new Date() }
        : {}),
      ...(status === "DISCONNECTED" ? { whatsappQrCode: null } : {}),
    });
    return toState(await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("whatsapp-status", error, companyId);
    await saveState(companyId, { whatsappStatus: "ERROR", whatsappError: message });
    return toState(await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } }));
  }
}

/** Aplica evento CONNECTION_UPDATE recebido via webhook. */
export async function applyConnectionUpdate(instance: string, state: string): Promise<void> {
  const profile = await prisma.companyProfile.findUnique({
    where: { whatsappInstance: instance },
    select: { companyId: true, whatsappConnectedAt: true },
  });
  if (!profile) return;

  const status = mapState(state);
  await saveState(profile.companyId, {
    whatsappStatus: status,
    ...(status === "CONNECTED"
      ? { whatsappQrCode: null, whatsappConnectedAt: new Date(), whatsappError: null }
      : {}),
    ...(status === "DISCONNECTED" ? { whatsappQrCode: null } : {}),
  });
}

/** Aplica evento QRCODE_UPDATED recebido via webhook (QR rotaciona sozinho). */
export async function applyQrUpdate(instance: string, qrCode: string): Promise<void> {
  // Só aceita data URLs de imagem — nunca renderizar conteúdo arbitrário do webhook
  if (!qrCode.startsWith("data:image/")) return;

  const profile = await prisma.companyProfile.findUnique({
    where: { whatsappInstance: instance },
    select: { companyId: true },
  });
  if (!profile) return;

  await saveState(profile.companyId, {
    whatsappStatus: "WAITING_QR",
    whatsappQrCode: qrCode,
  });
}
