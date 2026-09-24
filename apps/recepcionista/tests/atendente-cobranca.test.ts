import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// A regra pura é conferida direto; a exceção da semana grátis, pelo
// exigirAcesso de verdade, com o banco e as contagens trocados por espiões.
vi.mock("@/lib/db", () => ({ prisma: { company: { findUnique: vi.fn() } } }));
vi.mock("@/lib/billing/relogio-da-conta", () => ({
  garantirRelogio: vi.fn(async (empresa: { trialEndsAt: Date | null }) => empresa.trialEndsAt),
}));
vi.mock("@/lib/billing/primeira-onda-da-conta", () => ({ primeiraOndaDaEmpresa: vi.fn() }));
vi.mock("@/lib/billing/oferta-da-conta", () => ({ ofertaDaEmpresa: vi.fn(async () => null) }));
vi.mock("@/lib/atendente/uso", () => ({ usoDoAtendente: vi.fn() }));

import { prisma } from "@/lib/db";
import { SEMANA_GRATIS_CONVERSAS, SEMANA_GRATIS_DIAS } from "@/lib/atendente/constantes";
import { usoDoAtendente } from "@/lib/atendente/uso";
import { ACOES, ACOES_SEMPRE_LIVRES, podeExecutar, type EstadoConta } from "@/lib/billing/acesso";
import { exigirAcesso } from "@/lib/billing/guarda";
import { emReais, PRECO_COMPLETO_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { primeiraOndaDaEmpresa } from "@/lib/billing/primeira-onda-da-conta";

/**
 * A COBRANÇA DO ATENDENTE VIRTUAL.
 *
 * Com plano (ou no teste), o Atendente está incluído. Sem plano, a primeira
 * semana é por nossa conta — sete dias ou cinquenta conversas desde a primeira
 * vez que ligou, uma vez por negócio — e ligar o WhatsApp vem junto, porque sem
 * ele o Atendente não tem por onde responder. Depois, a recusa fala do
 * Atendente e aponta o plano.
 */

const RAIZ = join(__dirname, "..");
const DIA = 86_400_000;
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("LIGAR_ATENDENTE na regra pura", () => {
  it("é uma ação da conta, e não das que nunca travam", () => {
    expect(ACOES).toContain("LIGAR_ATENDENTE");
    expect(ACOES_SEMPRE_LIVRES).not.toContain("LIGAR_ATENDENTE");
  });

  it("com plano ou no teste, está incluído", () => {
    const comPlano: EstadoConta[] = ["TRIAL", "ATIVO", "PASSE", "TOLERANCIA", "CANCELADO_COM_ACESSO"];
    for (const estado of comPlano) expect(podeExecutar(estado, "LIGAR_ATENDENTE").pode, estado).toBe(true);
  });

  it("sem plano, a recusa fala do Atendente e aponta o plano Completo", () => {
    for (const estado of ["GRATIS", "TRIAL_EXPIRADO"] as EstadoConta[]) {
      const p = podeExecutar(estado, "LIGAR_ATENDENTE");
      expect(p.pode).toBe(false);
      if (p.pode) continue;
      expect(p.motivo).toMatch(/plano Nexora Completo/);
      expect(p.acao.texto).toContain(emReais(PRECO_COMPLETO_CENTS));
      expect(p.acao.href).toBe("/painel/assinatura");
    }
  });

  it("pagamento recusado continua pedindo o cartão: é isso que resolve", () => {
    const p = podeExecutar("BLOQUEADO", "LIGAR_ATENDENTE");
    expect(p.pode).toBe(false);
    if (!p.pode) expect(p.acao.texto).toBe("Atualizar forma de pagamento");
  });
});

type Fn = Mock;
const db = prisma as unknown as { company: { findUnique: Fn } };

/** Conta sem plano e sem prazo: GRATIS. */
const SEM_PLANO = {
  id: "c1",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  termosVersao: "2026-09-21",
  subscriptionStatus: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  dunningIniciadoEm: null,
  acessoPagoAte: null,
};

const semana = (p: { diasDesde: number | null; conversas?: number }) => ({
  conversasNoMes: p.conversas ?? 0,
  conversasNaSemana: p.conversas ?? 0,
  primeiraVezEm: p.diasDesde === null ? null : new Date(Date.now() - p.diasDesde * DIA),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.company.findUnique.mockResolvedValue(SEM_PLANO);
  // A primeira Onda por nossa conta já foi usada: o que libera é a semana do Atendente.
  (primeiraOndaDaEmpresa as Fn).mockResolvedValue({
    situacao: "USADA",
    primeiraOndaEm: new Date(Date.now() - 30 * DIA),
    enviadas: 12,
    ate: new Date(Date.now() - 23 * DIA),
  });
  (usoDoAtendente as Fn).mockResolvedValue(semana({ diasDesde: null }));
});

describe("o Atendente no exigirAcesso — exclusivo do plano Completo", () => {
  it("conta sem plano não pode ligar e recebe recusa apontando o plano Completo", async () => {
    const r = await exigirAcesso("c1", "LIGAR_ATENDENTE");
    expect(r?.status).toBe(402);
    const corpo = await r!.json();
    expect(corpo.error).toMatch(/exclusivo do plano Nexora Completo/);
    expect(corpo.acao.href).toBe("/painel/assinatura");
    expect(corpo.acao.texto).toContain(emReais(PRECO_COMPLETO_CENTS));
  });

  it("conta com plano básico (pro) não pode ligar", async () => {
    db.company.findUnique.mockResolvedValue({ ...SEM_PLANO, plan: "pro", subscriptionStatus: "active" });
    const r = await exigirAcesso("c1", "LIGAR_ATENDENTE");
    expect(r?.status).toBe(402);
    const corpo = await r!.json();
    expect(corpo.error).toMatch(/exclusivo do plano Nexora Completo/);
  });

  it("conta com plano completo ativo pode ligar", async () => {
    db.company.findUnique.mockResolvedValue({ ...SEM_PLANO, plan: "completo", subscriptionStatus: "active" });
    expect(await exigirAcesso("c1", "LIGAR_ATENDENTE")).toBeNull();
  });

  it("ligar o WhatsApp vem junto com a semana da primeira Onda", async () => {
    expect(await exigirAcesso("c1", "CONECTAR_WHATSAPP")).toBeNull();
    (usoDoAtendente as Fn).mockResolvedValue(semana({ diasDesde: SEMANA_GRATIS_DIAS + 1 }));
    expect((await exigirAcesso("c1", "CONECTAR_WHATSAPP"))?.status).toBe(402);
  });

  it("a semana do Atendente não libera a Onda", async () => {
    expect((await exigirAcesso("c1", "GERAR_ONDA"))?.status).toBe(402);
    expect((await exigirAcesso("c1", "ENVIAR_TOQUE"))?.status).toBe(402);
  });
});

describe("onde a semana grátis mora", () => {
  it("a exceção fica em exigirAcesso, com a contagem do banco", () => {
    const guarda = leia("lib/billing/guarda.ts");
    expect(guarda).toContain("usoDoAtendente(");
    expect(guarda).toContain("podeLigar(");
  });

  it("acesso.ts continua dizendo que conta sem plano não liga", () => {
    expect(leia("lib/billing/acesso.ts")).not.toMatch(/usoDoAtendente|podeLigar/);
  });
});
