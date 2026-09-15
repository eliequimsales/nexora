import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerPlano } from "@/lib/billing/planos";

/**
 * O CAMINHO DO DINHEIRO, DO BOTÃO AO ACESSO.
 *
 * Três planos, dois tipos de cobrança. O Pix não paga na hora: a sessão termina
 * com o QR na tela e o dinheiro chega depois, num evento assíncrono. O passe só
 * pode nascer quando o pagamento compensa, uma vez por sessão — a Stripe
 * reentrega evento, e reentrega não pode virar dia de acesso de graça.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("lerPlano", () => {
  it("sem corpo, é o mensal no cartão: o botão que já existia continua funcionando", () => {
    expect(lerPlano(null)).toBe("mensal_cartao");
    expect(lerPlano({})).toBe("mensal_cartao");
  });

  it("aceita os três planos", () => {
    expect(lerPlano({ plano: "mensal_cartao" })).toBe("mensal_cartao");
    expect(lerPlano({ plano: "pix_30_dias" })).toBe("pix_30_dias");
    expect(lerPlano({ plano: "anual" })).toBe("anual");
  });

  it("plano desconhecido é recusado, e não vira mensal escondido", () => {
    expect(lerPlano({ plano: "vitalicio" })).toBeNull();
    expect(lerPlano({ plano: 97 })).toBeNull();
  });
});

describe("a rota do checkout", () => {
  const rota = leia("app/api/billing/checkout/route.ts");

  it("lê o plano do pedido e monta os parâmetros na função pura", () => {
    expect(rota).toContain("lerPlano(");
    expect(rota).toContain("parametrosDoCheckout(");
    expect(rota).toContain("precoPendenteDoPlano(");
  });

  it("continua exigindo e-mail verificado e identificação completa", () => {
    expect(rota).toContain("podeCobrar");
    expect(rota).toContain("identificacaoCompleta()");
  });

  // Cliente criado na Stripe para uma compra recusada é lixo na conta e confunde
  // o portal depois. A recusa vem antes de qualquer escrita lá fora.
  it("recusa o plano que a conta não pode contratar antes de criar qualquer coisa na Stripe", () => {
    expect(rota).toContain("planoDisponivel(");
    expect(rota.indexOf("planoDisponivel(")).toBeLessThan(rota.indexOf("customers.create("));
  });
});

describe("o webhook entende o Pix que paga depois", () => {
  const webhook = leia("app/api/billing/webhook/route.ts");

  it("o pagamento que compensa depois libera o acesso", () => {
    expect(webhook).toContain('case "checkout.session.async_payment_succeeded"');
  });

  it("o QR que venceu é reconhecido e não libera nada", () => {
    expect(webhook).toContain('case "checkout.session.async_payment_failed"');
  });
});

describe("o passe pago", () => {
  const converger = leia("lib/billing/converger.ts");
  const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");

  it("pagamento avulso vira passe, e só depois de compensado", () => {
    expect(converger).toMatch(/mode\s*===\s*"payment"/);
    expect(converger).toContain("aplicarPasse(");
    expect(converger).toContain("deveProvisionar(");
  });

  it("é gravado uma vez por sessão: reentrega do webhook não soma dias", () => {
    expect(schema).toMatch(/model PassePago \{[\s\S]*?stripeSessionId\s+String\s+@unique/);
    expect(converger).toContain("P2002");
  });

  it("começa quando o acesso que a conta já tem acaba", () => {
    expect(converger).toContain("fimDoAcessoAtual(");
  });

  it("a conta guarda até quando o acesso está pago", () => {
    expect(schema).toMatch(/acessoPagoAte\s+DateTime\?/);
  });

  it("manda a confirmação da contratação do passe, e uma vez só", () => {
    expect(converger).toContain("montarConfirmacaoDoPasse(");
    expect(schema).toMatch(/model PassePago \{[\s\S]*?confirmacaoEnviadaEm\s+DateTime\?/);
  });

  it("quem decide o estado lê o passe", () => {
    expect(leia("lib/billing/guarda.ts")).toMatch(/acessoPagoAte:\s*true/);
    expect(leia("app/painel/assinatura/page.tsx")).toMatch(/acessoPagoAte:\s*true/);
  });
});

describe("Minha conta oferece os três planos", () => {
  it("os botões mandam o plano escolhido para a rota", () => {
    expect(leia("app/painel/assinatura/botoes.tsx")).toMatch(/JSON\.stringify\(\s*\{\s*plano/);
  });

  it("a tela mostra exatamente o que a rota aceita", () => {
    expect(leia("app/painel/assinatura/page.tsx")).toContain("acoesDaConta(");
  });

  it("existe o resumo de quem está com passe pago", () => {
    expect(leia("app/painel/assinatura/page.tsx")).toMatch(/PASSE:\s*\(/);
  });
});
