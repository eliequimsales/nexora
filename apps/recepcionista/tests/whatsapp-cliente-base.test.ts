import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    companyProfile: { findUnique: vi.fn() },
    message: { findUnique: vi.fn(), create: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/atendente/executar", () => ({
  atender: vi.fn(async () => ({ acao: "SILENCIO", motivo: "DONO_NA_CONVERSA" })),
}));

vi.mock("@/lib/whatsapp/envio", () => ({
  enviarWhatsApp: vi.fn(async () => {}),
}));

vi.mock("@/lib/errors", () => ({
  logError: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { handleIncomingMessage } from "@/lib/conversation-service";

describe("clientes do WhatsApp salvos em Meus clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.companyProfile.findUnique as any).mockResolvedValue({ companyId: "empresa_1" });
    (prisma.message.findUnique as any).mockResolvedValue(null);
    (prisma.message.create as any).mockResolvedValue({ id: "msg_1" });
    (prisma.conversation.findUnique as any).mockResolvedValue(null);
    (prisma.conversation.create as any).mockResolvedValue({ id: "conv_1", status: "AI" });
  });

  it("salva um novo contato do WhatsApp na tabela Customer com source WHATSAPP", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue(null);

    await handleIncomingMessage({
      instance: "nexora-instancia",
      phone: "5511988887777",
      senderName: "Carlos Pereira",
      text: "Olá, tem horário para amanhã?",
      messageId: "msg_123",
      timestamp: Date.now(),
    });

    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: {
        companyId: "empresa_1",
        phone: "5511988887777",
        name: "Carlos Pereira",
        source: "WHATSAPP",
      },
    });
  });

  it("atualiza o nome do cliente se antes estava registrado apenas o telefone", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue({
      id: "cust_123",
      name: "5511988887777",
    });

    await handleIncomingMessage({
      instance: "nexora-instancia",
      phone: "5511988887777",
      senderName: "Carlos Pereira",
      text: "Quero agendar",
      messageId: "msg_124",
      timestamp: Date.now(),
    });

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: "cust_123" },
      data: { name: "Carlos Pereira" },
    });
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });
});
