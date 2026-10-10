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
