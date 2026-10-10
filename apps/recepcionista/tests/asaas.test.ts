import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  asaasConfigurado,
  variaveisPendentesDoAsaas,
  provedorCobranca,
  validarTokenWebhookAsaas,
  obterAsaasBaseUrl,
} from "@/lib/billing/asaas";
import {
  reivindicarEventoAsaas,
  marcarProcessadoAsaas,
  marcarFalhaAsaas,
} from "@/lib/billing/asaas-idempotencia";
import { prisma } from "@/lib/db";

describe("Configuração e Provedor do Asaas", () => {
  it("detecta variáveis pendentes do Asaas", () => {
    expect(variaveisPendentesDoAsaas({})).toEqual(["ASAAS_API_KEY"]);
    expect(variaveisPendentesDoAsaas({ ASAAS_API_KEY: "chave_teste" })).toEqual([]);
    expect(asaasConfigurado({ ASAAS_API_KEY: "chave_teste" })).toBe(true);
    expect(asaasConfigurado({})).toBe(false);
  });

  it("seleciona o provedor correto conforme configuração", () => {
    expect(provedorCobranca({ BILLING_GATEWAY: "asaas" })).toBe("asaas");
    expect(provedorCobranca({ BILLING_GATEWAY: "stripe" })).toBe("stripe");
    expect(provedorCobranca({ ASAAS_API_KEY: "chave" })).toBe("asaas");
    expect(provedorCobranca({})).toBe("stripe");
  });

  it("define URL base de sandbox vs produção", () => {
    expect(obterAsaasBaseUrl({ ASAAS_SANDBOX: "true", ASAAS_API_KEY: "key" })).toBe(
      "https://sandbox.asaas.com/api/v3",
    );
    expect(
      obterAsaasBaseUrl({
        ASAAS_SANDBOX: "false",
        ASAAS_API_KEY: "$aact_prod_123",
        NODE_ENV: "production",
      }),
    ).toBe("https://api.asaas.com/api/v3");
  });

  it("valida o token do webhook do Asaas de forma segura", () => {
    const env = { ASAAS_WEBHOOK_TOKEN: "segredo_super_secreto" };
    expect(validarTokenWebhookAsaas("segredo_super_secreto", env)).toBe(true);
    expect(validarTokenWebhookAsaas("segredo_errado", env)).toBe(false);
    expect(validarTokenWebhookAsaas(null, env)).toBe(false);
    expect(validarTokenWebhookAsaas("", env)).toBe(false);
    expect(validarTokenWebhookAsaas("segredo_super_secreto", {})).toBe(false);
  });
});

describe("Idempotência dos Eventos do Asaas", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("concede a primeira tentativa do evento com sucesso", async () => {
    vi.spyOn(prisma.asaasEvent, "create").mockResolvedValueOnce({
      id: "evt_001",
      event: "PAYMENT_RECEIVED",
      paymentId: "pay_001",
      receivedAt: new Date(),
      processedAt: null,
      attempts: 1,
      companyId: null,
      erro: null,
    });

    const res = await reivindicarEventoAsaas("evt_001", "PAYMENT_RECEIVED", "pay_001");
    expect(res).toEqual({ ganhou: true, tentativa: 1 });
  });

  it("recusa evento já processado quando há colisão P2002", async () => {
    vi.spyOn(prisma.asaasEvent, "create").mockRejectedValueOnce({ code: "P2002" });
    vi.spyOn(prisma.asaasEvent, "updateMany").mockResolvedValueOnce({ count: 0 });
    vi.spyOn(prisma.asaasEvent, "findUnique").mockResolvedValueOnce({
      processedAt: new Date(),
    } as any);

    const res = await reivindicarEventoAsaas("evt_001", "PAYMENT_RECEIVED");
    expect(res).toEqual({ ganhou: false, motivo: "ja-processado" });
  });

  it("indica evento em-voo quando outra requisição detém o lease", async () => {
    vi.spyOn(prisma.asaasEvent, "create").mockRejectedValueOnce({ code: "P2002" });
    vi.spyOn(prisma.asaasEvent, "updateMany").mockResolvedValueOnce({ count: 0 });
    vi.spyOn(prisma.asaasEvent, "findUnique").mockResolvedValueOnce({
      processedAt: null,
    } as any);

    const res = await reivindicarEventoAsaas("evt_001", "PAYMENT_RECEIVED");
    expect(res).toEqual({ ganhou: false, motivo: "em-voo" });
  });

  it("renova lease e ganha tentativa 2 quando havia erro anterior", async () => {
    vi.spyOn(prisma.asaasEvent, "create").mockRejectedValueOnce({ code: "P2002" });
    vi.spyOn(prisma.asaasEvent, "updateMany").mockResolvedValueOnce({ count: 1 });
    vi.spyOn(prisma.asaasEvent, "findUnique").mockResolvedValueOnce({
      attempts: 2,
    } as any);

    const res = await reivindicarEventoAsaas("evt_001", "PAYMENT_RECEIVED");
    expect(res).toEqual({ ganhou: true, tentativa: 2 });
  });

  it("marca processado e marca falha com isolamento", async () => {
    const updateManySpy = vi.spyOn(prisma.asaasEvent, "updateMany").mockResolvedValue({ count: 1 });

    await marcarProcessadoAsaas("evt_001", "comp_123", 2);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "evt_001", attempts: 2 }),
      }),
    );

    await marcarFalhaAsaas("evt_001", new Error("Falha transitória"), 2);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "evt_001", attempts: 2 }),
      }),
    );
  });
});
