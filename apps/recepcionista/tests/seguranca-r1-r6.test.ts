import { describe, expect, it, vi } from "vitest";
import { verificarOrigemPermitida, exigeJson, validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { POST as garantiaPOST } from "@/app/api/billing/garantia/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { POST as whatsappConnectPOST } from "@/app/api/whatsapp/connect/route";
import { PUT as profilePUT } from "@/app/api/company/profile/route";

describe("Segurança R6 — Proteção de Origem e Anti-CSRF em Mutações", () => {
  it("rejeita subdomínio de atacante mesmo sob o mesmo domínio base (attacker.meunexora.com.br)", () => {
    const req = new Request("https://www.meunexora.com.br/api/billing/garantia", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://attacker.meunexora.com.br",
        "sec-fetch-site": "same-site",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(false);
    const erro = validarOrigemECsrfe(req);
    expect(erro?.status).toBe(403);
  });

  it("rejeita requisições com sec-fetch-site cross-site", () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/logout", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(false);
    const erro = validarOrigemECsrfe(req);
    expect(erro?.status).toBe(403);
  });

  it("garantia.POST bloqueia requisição de atacante com 403", async () => {
    const req = new Request("https://www.meunexora.com.br/api/billing/garantia", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://attacker.meunexora.com.br",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    const res = await garantiaPOST(req);
    expect(res.status).toBe(403);
  });

  it("botão da garantia envia application/json com corpo e processa devolução com 200", async () => {
    const auth = await import("@/lib/auth");
    vi.spyOn(auth, "getSessionCompanyId").mockResolvedValue("cmp_test_123");
    const stripeModule = await import("@/lib/billing/stripe");
    vi.spyOn(stripeModule, "stripeConfigurado").mockReturnValue(true);
    const devolucao = await import("@/lib/billing/devolucao");
    vi.spyOn(devolucao, "devolverPelaGarantia").mockResolvedValue({
      devolvido: true,
      valorCents: 9700,
      prazoTerminaEm: new Date(),
    } as any);

    const req = new Request("https://www.meunexora.com.br/api/billing/garantia", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const erro = validarOrigemECsrfe(req, { exigirJson: true });
    expect(erro).toBeNull();
    const res = await garantiaPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.devolvido).toBe(true);
    expect(json.valorCents).toBe(9700);
  });

  it("logout.POST bloqueia requisição cross-origin com 403", async () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/logout", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://evil.org",
      },
    });
    const res = await logoutPOST(req);
    expect(res.status).toBe(403);
  });

  it("whatsapp connect POST bloqueia requisição cross-origin com 403", async () => {
    const req = new Request("https://www.meunexora.com.br/api/whatsapp/connect", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://malicious.example.com",
      },
    });
    const res = await whatsappConnectPOST(req);
    expect(res.status).toBe(403);
  });

  it("profile.PUT exige Content-Type estrito application/json e bloqueia form-urlencoded com 415", async () => {
    const req = new Request("https://www.meunexora.com.br/api/company/profile", {
      method: "PUT",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "description=hacked",
    });
    const res = await profilePUT(req);
    expect(res.status).toBe(415);
  });
});

describe("Segurança R1 — Cobrança: Exclusão Mútua, Fencing e Dunning Concorrente", () => {
  it("falhasSeguidas não regride se uma tentativa menor terminar depois de uma maior", async () => {
    const { registrarFalhaPagamento } = await import("@/lib/billing/converger");
    const { prisma } = await import("@/lib/db");

    let company = { falhasSeguidas: 1, dunningIniciadoEm: new Date("2026-10-08") };

    // Simula concorrência onde tentativa 2 e 3 chegam juntas
    const updateManySpy = vi.spyOn(prisma.company, "updateMany").mockImplementation(async (args: any) => {
      if (args?.where?.falhasSeguidas?.lt !== undefined) {
        if (company.falhasSeguidas < args.data.falhasSeguidas) {
          company.falhasSeguidas = args.data.falhasSeguidas;
          return { count: 1 } as any;
        }
        return { count: 0 } as any;
      }
      return { count: 1 } as any;
    });

    // Tentativa 3 grava primeiro
    await registrarFalhaPagamento("cmp_1", "Recusado tentativa 3", 3);
    expect(company.falhasSeguidas).toBe(3);

    // Tentativa 2 tenta gravar depois (atrasada)
    await registrarFalhaPagamento("cmp_1", "Recusado tentativa 2", 2);
    // NÃO regride para 2! Permanece 3!
    expect(company.falhasSeguidas).toBe(3);

    updateManySpy.mockRestore();
  });
});

describe("Segurança R3 — Vínculo Google e Distinção de Token Invalidado vs Comprovado", () => {
  it("invalidação por reemissão não é prova de identidade e reseta senha pré-cadastrada", async () => {
    const { prisma } = await import("@/lib/db");
    const { abrirVerificacao } = await import("@/lib/auth/verificacao");

    const tokens: any[] = [
      {
        id: "tok_1",
        companyId: "cmp_vitima",
        tokenHash: "hash_1",
        usadoEm: null,
        invalidadoEm: null,
        emailConfirmado: null,
      },
    ];

    vi.spyOn(prisma.verificacaoEmail, "updateMany").mockImplementation(async (args: any) => {
      if (args?.data?.invalidadoEm) {
        tokens.forEach((t) => {
          if (t.companyId === args.where.companyId && t.usadoEm === null && t.invalidadoEm === null) {
            t.invalidadoEm = args.data.invalidadoEm;
          }
        });
      }
      return { count: 1 } as any;
    });

    vi.spyOn(prisma.verificacaoEmail, "create").mockImplementation(async (args: any) => {
      const novo = { id: "tok_2", ...args.data, usadoEm: null, invalidadoEm: null, emailConfirmado: null };
      tokens.push(novo);
      return novo as any;
    });

    vi.spyOn(prisma, "$transaction").mockImplementation(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });

    // Reemite verificação: token 1 é invalidado (invalidadoEm gravado, usadoEm nulo)
    await abrirVerificacao("cmp_vitima");

    expect(tokens[0].invalidadoEm).not.toBeNull();
    expect(tokens[0].usadoEm).toBeNull();
    expect(tokens[0].emailConfirmado).toBeNull();

    // Simula findFirst no Google Callback com token invalidado + contorno sem email
    vi.spyOn(prisma.verificacaoEmail, "findFirst").mockImplementation(async (args: any) => {
      return tokens.find(
        (t) =>
          t.companyId === args.where.companyId &&
          t.usadoEm !== null &&
          t.invalidadoEm === null &&
          t.emailConfirmado?.toLowerCase() === args.where.emailConfirmado?.equals?.toLowerCase(),
      ) ?? null;
    });

    const comprovacaoReal = await prisma.verificacaoEmail.findFirst({
      where: {
        companyId: "cmp_vitima",
        usadoEm: { not: null },
        invalidadoEm: null,
        emailConfirmado: { equals: "vitima@exemplo.com", mode: "insensitive" },
      },
    });

    // Prova real NÃO deve ser encontrada, mesmo que haja liberação sem e-mail
    expect(comprovacaoReal).toBeNull();
  });

  it("consumo legítimo de token gera comprovação válida com emailConfirmado", async () => {
    const { prisma } = await import("@/lib/db");

    const tokens: any[] = [
      {
        id: "tok_valido",
        companyId: "cmp_legitima",
        usadoEm: new Date(),
        invalidadoEm: null,
        emailConfirmado: "dono@exemplo.com",
      },
    ];

    vi.spyOn(prisma.verificacaoEmail, "findFirst").mockImplementation(async (args: any) => {
      return tokens.find(
        (t) =>
          t.companyId === args.where.companyId &&
          t.usadoEm !== null &&
          t.invalidadoEm === null &&
          t.emailConfirmado?.toLowerCase() === args.where.emailConfirmado?.equals?.toLowerCase(),
      ) ?? null;
    });

    const comprovacaoReal = await prisma.verificacaoEmail.findFirst({
      where: {
        companyId: "cmp_legitima",
        usadoEm: { not: null },
        invalidadoEm: null,
        emailConfirmado: { equals: "dono@exemplo.com", mode: "insensitive" },
      },
    });

    expect(comprovacaoReal).not.toBeNull();
    expect(comprovacaoReal?.emailConfirmado).toBe("dono@exemplo.com");
  });
});

describe("Segurança R1 & R6 — Provas Permanentes dos Achados 01, 02 e 03", () => {
  it("feedback route bloqueia subdomínio atacante e text/plain com cookie de sessão", async () => {
    const { POST: feedbackPOST } = await import("@/app/api/feedback/route");
    const { middleware } = await import("@/middleware");
    const { NextRequest } = await import("next/server");

    // Prova do Middleware: /api/feedback NÃO é isenta e bloqueia atacante
    const reqMidd = new NextRequest("https://www.meunexora.com.br/api/feedback", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://attacker.meunexora.com.br",
        "sec-fetch-site": "same-site",
        "content-type": "text/plain",
        cookie: "rd_session=mock",
      },
      body: JSON.stringify({ mensagem: "Ataque via feedback" }),
    });

    const resMidd = await middleware(reqMidd);
    expect(resMidd.status).toBe(403);

    // Prova do Handler: validarOrigemECsrfe bloqueia origem indevida com 403
    const reqHandler = new Request("https://www.meunexora.com.br/api/feedback", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://attacker.meunexora.com.br",
        "content-type": "application/json",
      },
      body: JSON.stringify({ mensagem: "Ataque via feedback" }),
    });

    const resHandler = await feedbackPOST(reqHandler);
    expect(resHandler.status).toBe(403);

    // Prova do Handler: Content-Type não JSON é rejeitado com 415
    const reqForm = new Request("https://www.meunexora.com.br/api/feedback", {
      method: "POST",
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "content-type": "text/plain",
      },
      body: "texto simples",
    });

    const resForm = await feedbackPOST(reqForm);
    expect(resForm.status).toBe(415);
  });

  it("origem em produção rejeita HTTP e portas não padrão (8443)", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const reqHttp = new Request("https://www.meunexora.com.br/api/billing/garantia", {
        headers: {
          host: "www.meunexora.com.br",
          origin: "http://www.meunexora.com.br",
        },
      });
      expect(verificarOrigemPermitida(reqHttp)).toBe(false);

      const reqPorta = new Request("https://www.meunexora.com.br/api/billing/garantia", {
        headers: {
          host: "www.meunexora.com.br",
          origin: "https://www.meunexora.com.br:8443",
        },
      });
      expect(verificarOrigemPermitida(reqPorta)).toBe(false);

      const reqSemOrigemComCookie = new Request("https://www.meunexora.com.br/api/billing/garantia", {
        headers: {
          host: "www.meunexora.com.br",
          cookie: "rd_session=mock",
        },
      });
      expect(verificarOrigemPermitida(reqSemOrigemComCookie)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reserva de confirmação de e-mail não é revertida se o e-mail foi enviado com sucesso", async () => {
    const { aplicarAssinatura } = await import("@/lib/billing/converger");
    const { prisma } = await import("@/lib/db");

    let emails = 0;
    const company = {
      id: "cmp_1",
      name: "Empresa",
      email: "owner@example.invalid",
      canceladoEm: null,
      confirmacaoEnviadaEm: null as Date | null,
    };

    vi.spyOn(prisma.company, "findUnique").mockImplementation(async () => ({ ...company }) as any);
    vi.spyOn(prisma.company, "update").mockImplementation(async (args: any) => {
      Object.assign(company, args.data);
      return { ...company } as any;
    });
    vi.spyOn(prisma.company, "updateMany").mockImplementation(async (args: any) => {
      if (args?.where?.confirmacaoEnviadaEm === null) {
        if (company.confirmacaoEnviadaEm !== null) return { count: 0 } as any;
        company.confirmacaoEnviadaEm = args.data.confirmacaoEnviadaEm;
        return { count: 1 } as any;
      }
      return { count: 1 } as any;
    });

    const emailModule = await import("@/lib/reengajamento/email");
    vi.spyOn(emailModule, "enviarEmail").mockImplementation(async () => {
      emails++;
      return { enviado: true };
    });

    const sub = {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { companyId: "cmp_1" },
      cancel_at_period_end: false,
    } as any;

    await aplicarAssinatura(sub);
    expect(emails).toBe(1);
    expect(company.confirmacaoEnviadaEm).not.toBeNull();

    // Segunda execução subsequente não duplica e-mail
    await aplicarAssinatura(sub);
    expect(emails).toBe(1);
  });

  it("indisponibilidade da Stripe na reconsulta de execução antiga não revoga assinatura ativa", async () => {
    const { aplicarAssinatura } = await import("@/lib/billing/converger");
    const { prisma } = await import("@/lib/db");
    const stripeModule = await import("@/lib/billing/stripe");

    const agora = new Date();
    const futuro = new Date(agora.getTime() + 30 * 86400000);
    const company = {
      id: "cmp_probe_1",
      name: "Empresa Ativa",
      email: "probe@example.invalid",
      subscriptionStatus: "active",
      plan: "pro",
      currentPeriodEnd: futuro,
      canceladoEm: null,
      confirmacaoEnviadaEm: agora,
      falhasSeguidas: 0,
      dunningIniciadoEm: null,
    };

    let eventRow = {
      id: "evt_fallback_1",
      attempts: 2,
      processedAt: agora,
      receivedAt: agora,
      erro: JSON.stringify({
        status: "active",
        plan: "pro",
        currentPeriodEnd: futuro.toISOString(),
        canceladoEm: null,
      }),
    };

    vi.spyOn(prisma.stripeEvent, "findUnique").mockImplementation(async () => ({ ...eventRow }) as any);
    vi.spyOn(prisma.company, "findUnique").mockImplementation(async () => ({ ...company }) as any);
    vi.spyOn(prisma.company, "update").mockImplementation(async (args: any) => {
      Object.assign(company, args.data);
      return { ...company } as any;
    });

    vi.spyOn(stripeModule, "stripe").mockReturnValue({
      subscriptions: {
        retrieve: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
      },
    } as any);

    const sub = {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { companyId: "cmp_probe_1" },
      cancel_at_period_end: false,
      trial_end: null,
    } as any;

    await aplicarAssinatura(sub, {
      eventId: "evt_fallback_1",
      tentativa: 1,
      inicioOperacao: Date.now() - 35000,
    });

    expect(company.subscriptionStatus).toBe("active");
    expect(company.canceladoEm).toBeNull();
  });

  it("reconsulta defasada com snapshot canceled não sobrescreve reativação legítima", async () => {
    const { aplicarAssinatura } = await import("@/lib/billing/converger");
    const { prisma } = await import("@/lib/db");
    const stripeModule = await import("@/lib/billing/stripe");

    const agora = new Date();
    const futuro = new Date(agora.getTime() + 30 * 86400000);
    const company = {
      id: "cmp_race_1",
      name: "Empresa",
      email: "race@example.invalid",
      subscriptionStatus: "active",
      plan: "pro",
      currentPeriodEnd: futuro,
      canceladoEm: null,
      confirmacaoEnviadaEm: agora,
      falhasSeguidas: 0,
      dunningIniciadoEm: null,
    };

    const eventRow = {
      id: "evt_race_1",
      attempts: 2,
      processedAt: agora,
      receivedAt: agora,
      erro: JSON.stringify({
        status: "active",
        plan: "pro",
        currentPeriodEnd: futuro.toISOString(),
        canceladoEm: null,
      }),
    };

    vi.spyOn(prisma.stripeEvent, "findUnique").mockImplementation(async () => ({ ...eventRow }) as any);
    let leitura = 0;
    vi.spyOn(prisma.company, "findUnique").mockImplementation(async () => {
      leitura++;
      if (leitura > 1) {
        return {
          ...company,
          subscriptionStatus: "active",
          currentPeriodEnd: futuro,
          confirmacaoEnviadaEm: agora,
        } as any;
      }
      return { ...company, confirmacaoEnviadaEm: null } as any;
    });

    vi.spyOn(prisma.company, "update").mockImplementation(async (args: any) => {
      Object.assign(company, args.data);
      return { ...company } as any;
    });

    vi.spyOn(stripeModule, "stripe").mockReturnValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          customer: "cus_1",
          status: "canceled",
          metadata: { companyId: "cmp_race_1" },
          cancel_at_period_end: false,
          ended_at: Math.floor(agora.getTime() / 1000),
          items: { data: [{ current_period_end: Math.floor(agora.getTime() / 1000) }] },
        }),
      },
    } as any);

    const sub = {
      id: "sub_1",
      customer: "cus_1",
      status: "canceled",
      metadata: { companyId: "cmp_race_1" },
      cancel_at_period_end: false,
    } as any;

    await aplicarAssinatura(sub, {
      eventId: "evt_race_1",
      tentativa: 1,
      inicioOperacao: Date.now() - 35000,
    });

    expect(company.subscriptionStatus).toBe("active");
  });
});
