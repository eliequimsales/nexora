import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITES, limitar } from "@/lib/limites";

/**
 * TODA ROTA AUTENTICADA PRECISA DE TETO.
 *
 * Sessão válida não é cheque em branco. Catorze rotas não tinham limite
 * nenhum, e três classes de dano saem daí:
 *
 *   DINHEIRO — training/teach e training/interview chamam a IA. Sem teto, uma
 *   conta (ou uma sessão roubada) queima crédito em looping.
 *
 *   DADO — dados/exportar despeja a base inteira num CSV. Sem teto, um cookie
 *   roubado extrai tudo em segundos e repetidamente.
 *
 *   CPU — onda e reports varrem toda a base e recalculam ciclo por cliente.
 *
 * O teto é por EMPRESA, não por IP: o gargalo é o custo que a conta gera, e o
 * IP de um dono legítimo pode mudar no meio do dia.
 */

describe("as políticas existem e são coerentes", () => {
  it("exportação é bem mais apertada que leitura de painel", () => {
    expect(LIMITES.exportar.limit).toBeLessThan(LIMITES.leitura.limit);
  });

  it("chamada de IA é apertada, porque cada uma custa dinheiro", () => {
    expect(LIMITES.ia.limit).toBeLessThan(LIMITES.leitura.limit);
  });

  it("toda política tem janela positiva e limite positivo", () => {
    for (const [nome, p] of Object.entries(LIMITES)) {
      expect(p.limit, nome).toBeGreaterThan(0);
      expect(p.windowMs, nome).toBeGreaterThan(0);
    }
  });
});

describe("limitar()", () => {
  it("deixa passar dentro do teto e barra depois", () => {
    const chave = `teste-${Math.floor(performance.now())}-${process.pid}`;
    const politica = { limit: 3, windowMs: 60_000 };
    expect(limitar("x", chave, politica)).toBe(true);
    expect(limitar("x", chave, politica)).toBe(true);
    expect(limitar("x", chave, politica)).toBe(true);
    expect(limitar("x", chave, politica)).toBe(false);
  });

  it("empresas diferentes não compartilham o mesmo balde", () => {
    const politica = { limit: 1, windowMs: 60_000 };
    const a = `a-${process.pid}-${Math.floor(performance.now())}`;
    const b = `b-${process.pid}-${Math.floor(performance.now())}`;
    expect(limitar("y", a, politica)).toBe(true);
    expect(limitar("y", b, politica)).toBe(true);
    expect(limitar("y", a, politica)).toBe(false);
  });

  it("escopos diferentes não compartilham o mesmo balde", () => {
    const politica = { limit: 1, windowMs: 60_000 };
    const empresa = `e-${process.pid}-${Math.floor(performance.now())}`;
    expect(limitar("escopo-1", empresa, politica)).toBe(true);
    expect(limitar("escopo-2", empresa, politica)).toBe(true);
  });
});

describe("nenhuma rota autenticada fica sem teto", () => {
  /**
   * Guarda de cobertura. Rota nova sem limite quebra o build — que é a única
   * forma de isso não voltar a acontecer com catorze rotas de uma vez.
   */
  const RAIZ = join(__dirname, "..");

  // Cada uma tem o próprio motivo, escrito, para a isenção não virar hábito.
  const ISENTAS: Record<string, string> = {
    "app/api/auth/logout/route.ts":
      "sair precisa funcionar sempre; barrar o logout prenderia a pessoa na sessão",
    "app/api/billing/webhook/route.ts":
      "quem chama é a Stripe, com assinatura verificada; limitar aqui perderia evento de cobrança",
    "app/api/cron/follow-ups/route.ts": "protegida por CRON_SECRET, chamada pelo agendador",
    "app/api/cron/reengajamento/route.ts": "protegida por CRON_SECRET, chamada pelo agendador",
  };

  function listarRotas(dir: string): string[] {
    const saida: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name);
      if (e.isDirectory()) saida.push(...listarRotas(caminho));
      else if (e.name === "route.ts") saida.push(caminho);
    }
    return saida;
  }

  const rotas = listarRotas(join(RAIZ, "app/api"));

  for (const caminho of rotas) {
    const rel = caminho.slice(RAIZ.length + 1).replace(/\\/g, "/");
    const fonte = readFileSync(caminho, "utf8");
    const autenticada = /getSessionCompanyId/.test(fonte);
    if (!autenticada) continue;

    it(`${rel} tem teto`, () => {
      if (ISENTAS[rel]) {
        expect(ISENTAS[rel].length).toBeGreaterThan(20);
        return;
      }
      expect(fonte).toMatch(/limitar\(|rateLimit\(/);
    });
  }
});
