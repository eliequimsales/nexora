import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { podeCobrar, precisaVerificar } from "@/lib/auth/verificacao";

/**
 * VERIFICAÇÃO DE E-MAIL.
 *
 * O cadastro por senha aceitava qualquer endereço sem provar posse. Com o
 * vínculo do Google corrigido, isso já não é mais tomada de conta — mas ainda
 * deixa três buracos:
 *
 *   1. Alguém OCUPA o e-mail comercial de um negócio e o dono não consegue se
 *      cadastrar, porque o endereço já está em uso.
 *   2. Quem erra o próprio e-mail no cadastro fica sem caminho de volta: a
 *      recuperação de senha manda para o endereço errado.
 *   3. Não dá para mandar a confirmação da contratação que o Decreto
 *      7.962/2013 exige, porque ninguém garante que o endereço existe.
 *
 * A escolha de onde travar importa: bloquear o painel inteiro mataria o
 * primeiro minuto do produto, que é onde o barbeiro decide se fica. Travar na
 * COBRANÇA é proporcional — antes de tirar dinheiro de alguém, é preciso saber
 * que dá para falar com essa pessoa.
 */

describe("quem precisa verificar", () => {
  it("conta nova por senha precisa", () => {
    expect(precisaVerificar({ emailVerificadoEm: null })).toBe(true);
  });

  it("conta já verificada não precisa mais", () => {
    expect(precisaVerificar({ emailVerificadoEm: new Date("2026-01-01") })).toBe(false);
  });

  it("conta inexistente é tratada como não verificada", () => {
    // Fail closed: na dúvida, pede verificação em vez de liberar.
    expect(precisaVerificar(null)).toBe(true);
  });
});

describe("a cobrança exige e-mail comprovado", () => {
  it("não cobra de quem nunca provou o e-mail", () => {
    const d = podeCobrar({ emailVerificadoEm: null });
    expect(d.pode).toBe(false);
    if (!d.pode) expect(d.motivo).toContain("e-mail");
  });

  it("cobra de quem provou", () => {
    expect(podeCobrar({ emailVerificadoEm: new Date() }).pode).toBe(true);
  });

  it("a recusa explica o que fazer, não só que não deu", () => {
    const d = podeCobrar({ emailVerificadoEm: null });
    if (!d.pode) expect(d.motivo.length).toBeGreaterThan(30);
  });
});

describe("os pontos que provam posse do e-mail marcam a conta", () => {
  const RAIZ = join(__dirname, "..");
  const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

  it("entrar pelo Google nasce verificado — o Google já provou", () => {
    const fonte = leia("app/api/auth/google/callback/route.ts");
    expect(fonte).toContain("emailVerificadoEm");
  });

  it("concluir a redefinição de senha prova posse e marca", () => {
    // Quem clicou no link recebido no e-mail provou que o e-mail é dele.
    expect(leia("lib/senha.ts")).toContain("emailVerificadoEm");
  });

  it("o checkout consulta a verificação antes de abrir cobrança", () => {
    const fonte = leia("app/api/billing/checkout/route.ts");
    expect(fonte).toContain("podeCobrar");
    // E continua exigindo a identificação do fornecedor, que é a outra trava.
    expect(fonte).toContain("identificacaoCompleta()");
  });

  it("o cadastro por senha dispara o e-mail de verificação", () => {
    expect(leia("app/api/auth/signup/route.ts")).toContain("abrirVerificacao");
  });
});
