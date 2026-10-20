import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  companyProfile: { findUnique: vi.fn() },
  message: { findUnique: vi.fn(), create: vi.fn() },
  conversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
const atender = vi.hoisted(() => vi.fn());
const enviarWhatsApp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/atendente/executar", () => ({ atender }));
vi.mock("@/lib/whatsapp/envio", () => ({ enviarWhatsApp, ehEnvioDaNexora: vi.fn() }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
import { handleIncomingMessage } from "@/lib/conversation-service";
import { parseMensagemDoDono, parseWebhookPayload } from "@/lib/whatsapp/evolution";
import { registrarMensagemDoDono } from "@/lib/plantao/dono";

const payload = (fromMe = false) => ({
  event: "messages.upsert", instance: "nexora-empresa-1",
  data: {
    key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe, id: "AUDIO-1" },
    message: { audioMessage: { url: "https://arquivo.example/privado", seconds: 12 } },
  },
});

describe("mídia no recebimento real sem rede nem banco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.companyProfile.findUnique.mockResolvedValue({ companyId: "empresa-1" });
    db.message.findUnique.mockResolvedValue(null);
    db.message.create.mockResolvedValue({ id: "mensagem-1" });
    db.conversation.findUnique.mockResolvedValue({ id: "conversa-1", status: "AI", customerName: null });
    db.conversation.update.mockResolvedValue({ id: "conversa-1", status: "AI" });
    db.customer.findFirst.mockResolvedValue(null);
    atender.mockResolvedValue({ acao: "SILENCIO", motivo: "DESLIGADO" });
  });

  it("persiste áudio não interpretado antes de consultar os controles de atendimento", async () => {
    await handleIncomingMessage(parseWebhookPayload(payload())!);
    expect(db.message.create).toHaveBeenCalledWith({ data: {
      conversationId: "conversa-1", role: "CUSTOMER",
      content: "[Mídia recebida: áudio; conteúdo não interpretado]",
      whatsappMessageId: "nexora-empresa-1:AUDIO-1",
    } });
    expect(atender).toHaveBeenCalledWith({ companyId: "empresa-1", conversationId: "conversa-1", origem: "WEBHOOK" });
    expect(db.message.create.mock.invocationCallOrder[0]).toBeLessThan(atender.mock.invocationCallOrder[0]);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("retry da mesma mídia não duplica nem executa o atendimento de novo", async () => {
    db.message.findUnique.mockResolvedValue({ id: "já-recebida" });
    await handleIncomingMessage(parseWebhookPayload(payload())!);
    expect(db.message.create).not.toHaveBeenCalled();
    expect(atender).not.toHaveBeenCalled();
  });

  it("a mídia do dono continua assumindo a conversa e não entra como mensagem de cliente", async () => {
    expect(parseWebhookPayload(payload(true))).toBeNull();
    const marcarQueODonoAssumiu = vi.fn(async () => true);
    const resultado = await registrarMensagemDoDono(parseMensagemDoDono(payload(true))!, {
      ehEnvioDaNexora: async () => false,
      esperar: async () => {},
      marcarQueODonoAssumiu,
    });
    expect(resultado).toBe("DONO_ASSUMIU");
    expect(marcarQueODonoAssumiu).toHaveBeenCalledWith("nexora-empresa-1", "5511999998888", expect.any(Date), null, "AUDIO-1");
  });
});
