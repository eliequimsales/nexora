import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/conversation-service";
import { logError } from "@/lib/errors";
import {
  parseConnectionUpdate,
  parseQrUpdate,
  parseWebhookPayload,
} from "@/lib/whatsapp/evolution";
import { applyConnectionUpdate, applyQrUpdate } from "@/lib/whatsapp/instance";
import { safeEqual } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook da Evolution API — configurado automaticamente pelo Nexora Atendente
 * ao criar a conexão ({APP_URL}/api/webhook/whatsapp?token={WEBHOOK_TOKEN}).
 * Eventos: MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED.
 */
export async function POST(request: Request) {
  const expectedToken = process.env.WEBHOOK_TOKEN;
  if (expectedToken) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!safeEqual(token, expectedToken)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
  }

  try {
    const payload = await request.json().catch(() => null);

    // Status da conexão mudou (conectou, caiu, desconectou)
    const connectionUpdate = parseConnectionUpdate(payload);
    if (connectionUpdate) {
      await applyConnectionUpdate(connectionUpdate.instance, connectionUpdate.state);
      return NextResponse.json({ ok: true });
    }

    // QR Code rotacionou enquanto aguarda leitura
    const qrUpdate = parseQrUpdate(payload);
    if (qrUpdate) {
      await applyQrUpdate(qrUpdate.instance, qrUpdate.qrCode);
      return NextResponse.json({ ok: true });
    }

    // Mensagem de texto recebida de um cliente
    const incoming = parseWebhookPayload(payload);
    if (!incoming) {
      // Evento que não tratamos (mídia sem texto, grupo, status...) — confirma e ignora
      return NextResponse.json({ ignored: true });
    }

    await handleIncomingMessage(incoming);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("webhook-handler", error);
    // 200 mesmo em erro: o erro já está logado e retry da Evolution duplicaria trabalho
    return NextResponse.json({ ok: false });
  }
}
