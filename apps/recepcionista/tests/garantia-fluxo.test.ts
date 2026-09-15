import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O CAMINHO DA GARANTIA, DA COMPRA À DEVOLUÇÃO.
 *
 * A regra mora em lib/billing/garantia.ts e tem teste próprio. Aqui fica travado
 * o que liga a regra ao dinheiro de verdade: a garantia nasce registrada na
 * compra, a devolução só acontece depois de conferir a regra, e dois cliques
 * nunca viram duas devoluções.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("a garantia nasce na compra", () => {
  const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
  const converger = leia("lib/billing/converger.ts");

  it("uma por negócio, com o Corte Honesto registrado na compra", () => {
    expect(schema).toMatch(/model Garantia \{[\s\S]*?companyId\s+String\s+@unique/);
    expect(schema).toMatch(/model Garantia \{[\s\S]*?acimaDoCorte\s+Boolean/);
    expect(schema).toMatch(/model Garantia \{[\s\S]*?devolvidaEm\s+DateTime\?/);
    expect(schema).toMatch(/model PassePago \{[\s\S]*?reembolsadoEm\s+DateTime\?/);
  });

  it("o checkout calcula o Corte Honesto da lista e manda junto com o pagamento", () => {
    const rota = leia("app/api/billing/checkout/route.ts");
    expect(rota).toContain("ofertaDaEmpresa(");
    expect(rota).toMatch(/garantia[,:]/);
  });

  it("o primeiro pagamento com garantia cria a linha, e reentrega não cria outra", () => {
    expect(converger).toContain("garantia.createMany(");
    expect(converger).toContain("skipDuplicates: true");
  });

  it("assinatura encerrada perde o acesso quando acaba", () => {
    expect(converger).toContain("fimDoPeriodoPago(");
  });
});

describe("o pedido de devolução", () => {
  const devolucao = leia("lib/billing/devolucao.ts");
  const rota = leia("app/api/billing/garantia/route.ts");

  it("a rota exige sessão, limita tentativas e delega a devolução", () => {
    expect(rota).toContain("getSessionCompanyId(");
    expect(rota).toContain("limitar(");
    expect(rota).toContain("devolverPelaGarantia(");
  });

  it("confere a regra antes de qualquer estorno", () => {
    expect(devolucao).toContain("avaliarGarantia(");
    expect(devolucao.indexOf("avaliarGarantia(")).toBeLessThan(devolucao.indexOf("refunds.create("));
  });

  it("reivindica o pedido: dois cliques não viram duas devoluções", () => {
    expect(devolucao).toMatch(/pedidaEm:\s*null/);
    expect(devolucao).toContain("idempotencyKey");
  });

  it("devolve a assinatura e o passe, encerra o que foi devolvido e manda o comprovante", () => {
    expect(devolucao).toContain("invoicePayments.list(");
    expect(devolucao).toContain("subscriptions.cancel(");
    expect(devolucao).toContain("reembolsadoEm");
    expect(devolucao).toContain("montarConfirmacaoDaGarantia(");
  });
});

describe("Minha conta mostra a garantia", () => {
  it("com a decisão calculada no servidor e o botão de pedir", () => {
    const pagina = leia("app/painel/assinatura/page.tsx");
    expect(pagina).toContain("garantiaDaEmpresa(");
    expect(pagina).toContain("BotaoDaGarantia");
  });
});
