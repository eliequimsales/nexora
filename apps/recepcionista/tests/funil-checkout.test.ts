import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST as checkoutPost } from "@/app/api/billing/checkout/route";
import { POST as asaasWebhookPost } from "@/app/api/billing/asaas-webhook/route";
import { prisma } from "@/lib/db";
import * as auth from "@/lib/auth";
import * as verificacao from "@/lib/auth/verificacao";
import * as asaasIdemp from "@/lib/billing/asaas-idempotencia";
import * as asaasModule from "@/lib/billing/asaas";

describe("Funil de Checkout e Recuperação de Conta Convidada", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FORNECEDOR_NOME = "Nexora Tecnologias";
    process.env.FORNECEDOR_DOCUMENTO = "12.345.678/0001-90";
    process.env.FORNECEDOR_ENDERECO = "Av Paulista, 1000";
    process.env.FORNECEDOR_EMAIL = "contato@meunexora.com.br";
    process.env.FORNECEDOR_ENCARREGADO = "Encarregado DPO";
    process.env.ASAAS_API_KEY = "chave_teste_asaas";
    process.env.BILLING_GATEWAY = "asaas";
  });

  it("bloqueia checkout de conta convidada com instrução para salvar acesso", async () => {
    vi.spyOn(auth, "getSessionCompanyId").mockResolvedValue("comp_guest");
    vi.spyOn(prisma.company, "findUnique").mockResolvedValue({
      id: "comp_guest",
      name: "Barbearia Modelo",
      email: "guest_abc@temporario.meunexora.com.br",
      phone: "21999999999",
      stripeCustomerId: null,
      asaasCustomerId: null,
      emailVerificadoEm: null,
      createdAt: new Date(),
      termosVersao: "2026-09-15",
      subscriptionStatus: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      dunningIniciadoEm: null,
      acessoPagoAte: null,
    } as any);

    // Identificação do fornecedor completa no teste
    process.env.FORNECEDOR_NOME = "Nexora Tecnologias";
    process.env.FORNECEDOR_DOCUMENTO = "12.345.678/0001-90";
    process.env.FORNECEDOR_ENDERECO = "Av Paulista, 1000";
    process.env.FORNECEDOR_EMAIL = "contato@meunexora.com.br";
    process.env.ASAAS_API_KEY = "chave_teste_asaas";
    process.env.BILLING_GATEWAY = "asaas";

    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plano: "mensal_cartao" }),
    });

    const res = await checkoutPost(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.precisaSalvarConta).toBe(true);
    expect(json.plano).toBe("mensal_cartao");
    expect(json.error).toContain("salve seu acesso primeiro");
  });

  it("cria checkout do Asaas com sucesso para conta salva", async () => {
    vi.spyOn(auth, "getSessionCompanyId").mockResolvedValue("comp_salva");
    vi.spyOn(prisma.company, "findUnique").mockResolvedValue({
      id: "comp_salva",
      name: "Barbearia Oficial",
      email: "dono@barbearia.com.br",
      phone: "21999999999",
      stripeCustomerId: null,
      asaasCustomerId: "cus_asaas_123",
      emailVerificadoEm: new Date(),
      createdAt: new Date(),
      termosVersao: "2026-09-15",
      subscriptionStatus: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      dunningIniciadoEm: null,
      acessoPagoAte: null,
    } as any);

    vi.spyOn(verificacao, "podeCobrar").mockReturnValue({ pode: true });
    vi.spyOn(asaasModule, "buscarOuCriarClienteAsaas").mockResolvedValue("cus_asaas_123");
    vi.spyOn(asaasModule, "criarCheckoutAsaas").mockResolvedValue({
      url: "https://sandbox.asaas.com/i/chk_12345",
      paymentId: "pay_12345",
    });
    vi.spyOn(prisma.company, "update").mockResolvedValue({} as any);

    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plano: "pix_30_dias" }),
    });

    const res = await checkoutPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://sandbox.asaas.com/i/chk_12345");
  });
});

describe("Webhook do Asaas e Processamento Idempotente", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "token_webhook_secreto";
  });

  it("recusa requisição com token inválido com 401", async () => {
    const req = new Request("http://localhost:3000/api/billing/asaas-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "token_errado",
      },
      body: JSON.stringify({ event: "PAYMENT_RECEIVED" }),
    });

    const res = await asaasWebhookPost(req);
    expect(res.status).toBe(401);
  });

  it("processa PAYMENT_RECEIVED de passe avulso e marca processado", async () => {
    vi.spyOn(asaasIdemp, "reivindicarEventoAsaas").mockResolvedValue({
      ganhou: true,
      tentativa: 1,
    });
    vi.spyOn(asaasIdemp, "marcarProcessadoAsaas").mockResolvedValue();
    const aplicarPasseSpy = vi
      .spyOn(asaasModule, "aplicarPasseAsaas")
      .mockResolvedValue();

    const req = new Request("http://localhost:3000/api/billing/asaas-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "token_webhook_secreto",
      },
      body: JSON.stringify({
        id: "evt_100",
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "pay_100",
          customer: "cus_100",
          value: 97.0,
          externalReference: "comp_100:pix_30_dias",
          status: "RECEIVED",
        },
      }),
    });

    const res = await asaasWebhookPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recebido).toBe(true);
    expect(aplicarPasseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "comp_100",
        paymentId: "pay_100",
        plano: "pix_30_dias",
        valorCents: 9700,
        dias: 30,
      }),
    );
  });

  it("processa PAYMENT_CONFIRMED de assinatura recorrente", async () => {
    vi.spyOn(asaasIdemp, "reivindicarEventoAsaas").mockResolvedValue({
      ganhou: true,
      tentativa: 1,
    });
    vi.spyOn(asaasIdemp, "marcarProcessadoAsaas").mockResolvedValue();
    const aplicarAssinaturaSpy = vi
      .spyOn(asaasModule, "aplicarAssinaturaAsaas")
      .mockResolvedValue();

    const req = new Request("http://localhost:3000/api/billing/asaas-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "token_webhook_secreto",
      },
      body: JSON.stringify({
        id: "evt_101",
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_101",
          customer: "cus_101",
          subscription: "sub_101",
          value: 97.0,
          externalReference: "comp_101:mensal_cartao",
          status: "CONFIRMED",
        },
      }),
    });

    const res = await asaasWebhookPost(req);
    expect(res.status).toBe(200);
    expect(aplicarAssinaturaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "comp_101",
        subscriptionId: "sub_101",
        paymentId: "pay_101",
        plano: "mensal_cartao",
      }),
    );
  });

  it("retorna duplicado sem reprocessar quando o evento já foi processado", async () => {
    vi.spyOn(asaasIdemp, "reivindicarEventoAsaas").mockResolvedValue({
      ganhou: false,
      motivo: "ja-processado",
    });

    const req = new Request("http://localhost:3000/api/billing/asaas-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "token_webhook_secreto",
      },
      body: JSON.stringify({
        id: "evt_100",
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "pay_100",
          externalReference: "comp_100:pix_30_dias",
        },
      }),
    });

    const res = await asaasWebhookPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicado).toBe(true);
  });
});
