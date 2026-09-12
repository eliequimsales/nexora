import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { podeLiberarSemEmail } from "@/lib/auth/verificacao";

/**
 * LIBERAR A CONTA QUANDO NÃO HÁ COMO MANDAR E-MAIL.
 *
 * Decisão do dono em 11/09/2026, com o custo dito na cara: sem Resend ligado, o
 * link de confirmação não sai, e a trava do checkout deixaria o próprio dono sem
 * conseguir assinar para testar. O botão libera a conta sem prova de posse do
 * e-mail — e é por isso que ele só existe enquanto o Resend estiver desligado,
 * registra a liberação e avisa na tela.
 *
 * Com o Resend ligado, este caminho some: aí existe prova de verdade, e liberar
 * sem ela seria abrir mão da única garantia de que o comprovante da compra
 * exigido pelo Decreto 7.962/2013 chega a alguém.
 */

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("quando a liberação sem e-mail é permitida", () => {
  it("só com o Resend desligado e a conta ainda não verificada", () => {
    expect(podeLiberarSemEmail({ emailConfigurado: false, jaVerificado: false })).toBe(true);
  });

  it("com o Resend ligado, nunca", () => {
    expect(podeLiberarSemEmail({ emailConfigurado: true, jaVerificado: false })).toBe(false);
  });

  it("conta já verificada não precisa de liberação", () => {
    expect(podeLiberarSemEmail({ emailConfigurado: false, jaVerificado: true })).toBe(false);
  });
});

describe("a rota que libera", () => {
  const rota = leia("app/api/auth/verificar/sem-email/route.ts");

  it("exige sessão: ninguém libera a conta de outro", () => {
    expect(rota).toContain("getSessionCompanyId");
  });

  it("decide pela regra, e não por um if solto", () => {
    expect(rota).toContain("podeLiberarSemEmail");
    expect(rota).toContain("emailConfigurado()");
  });

  it("registra a liberação: conta liberada sem prova deixa rastro", () => {
    expect(rota).toContain("logError");
  });

  it("tem teto de tentativas, como as outras rotas de conta", () => {
    expect(rota).toMatch(/limitar|rateLimit/);
  });
});

describe("o aviso no painel", () => {
  it("o botão só aparece quando o servidor diz que não há como enviar e-mail", () => {
    const aviso = leia("app/painel/aviso-verificar.tsx");
    expect(aviso).toContain("semEnvioDeEmail");
    const layout = leia("app/painel/layout.tsx");
    expect(layout).toContain("emailConfigurado()");
    expect(layout).toContain("semEnvioDeEmail=");
  });

  it("a tela diz que a conta foi liberada sem prova do e-mail", () => {
    expect(leia("app/painel/aviso-verificar.tsx")).toMatch(/sem (a )?prova|sem confirmar/i);
  });
});
