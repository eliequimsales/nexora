import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  connectInstance,
  createInstance,
  getConnectionState,
  setWebhook,
} from "./evolution";

export type WhatsAppStatus = "DISCONNECTED" | "WAITING_QR" | "CONNECTED" | "ERROR";

export interface WhatsAppState {
  status: WhatsAppStatus;
  qrCode: string | null;
  connectedAt: string | null;
  error: string | null;
}

/** Nome padrão da instância Evolution de uma empresa. */
export function instanceNameFor(companyId: string): string {
  return `nexora-${companyId}`;
}

function webhookUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurada (necessária para o webhook do WhatsApp)");
  const token = process.env.WEBHOOK_TOKEN;
  const base = `${appUrl.replace(/\/+$/, "")}/api/webhook/whatsapp`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
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

function toState(profile: {
  whatsappStatus: string;
  whatsappQrCode: string | null;
  whatsappConnectedAt: Date | null;
  whatsappError: string | null;
}): WhatsAppState {
  return {
    status: (profile.whatsappStatus as WhatsAppStatus) ?? "DISCONNECTED",
    qrCode: profile.whatsappQrCode,
    connectedAt: profile.whatsappConnectedAt?.toISOString() ?? null,
    error: profile.whatsappError,
  };
}

/**
 * Cria (se necessário) a instância da empresa na Evolution, configura o
 * webhook automaticamente e gera o QR Code para conexão.
 */
export async function connectWhatsApp(companyId: string): Promise<WhatsAppState> {
  const name = instanceNameFor(companyId);

  try {
    await createInstance(name);
    await setWebhook(name, webhookUrl());
    const result = await connectInstance(name);

    if (result.state === "open") {
      await saveState(companyId, {
        whatsappInstance: name,
        whatsappStatus: "CONNECTED",
        whatsappQrCode: null,
        whatsappConnectedAt: new Date(),
        whatsappError: null,
      });
    } else {
      const qrCode =
        result.qrCode && result.qrCode.startsWith("data:image/") ? result.qrCode : null;
      await saveState(companyId, {
        whatsappInstance: name,
        whatsappStatus: "WAITING_QR",
        whatsappQrCode: qrCode,
        whatsappError: null,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError("whatsapp-connect", error, companyId);
    await saveState(companyId, { whatsappStatus: "ERROR", whatsappError: message });
  }

  const profile = await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } });
  return toState(profile);
}

/** Consulta o estado real na Evolution e sincroniza o banco. */
export async function refreshWhatsAppStatus(companyId: string): Promise<WhatsAppState> {
  const profile = await prisma.companyProfile.findUniqueOrThrow({ where: { companyId } });

  if (!profile.whatsappInstance) return toState(profile);

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
