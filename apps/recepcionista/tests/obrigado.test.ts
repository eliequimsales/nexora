import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("Página de Obrigado — A Onda Sem Fricção", () => {
  const obrigado = leia("app/obrigado/page.tsx");

  it("contém a mensagem de sucesso e confirmação imediata", () => {
    expect(obrigado).toContain("Compra Aprovada com Sucesso!");
    expect(obrigado).toContain("Seu Atendente Oficial já está pronto e te esperando no WhatsApp.");
  });

  it("possui contagem regressiva visual de 5 segundos", () => {
    expect(obrigado).toContain("Redirecionando você direto para a conversa em");
    expect(obrigado).toContain("setSegundos");
  });

  it("possui o botão magnético direcionando para a Sofia no WhatsApp", () => {
    expect(obrigado).toContain("Continuar no WhatsApp com a Sofia");
    expect(obrigado).toContain("(Resposta em 3 segundos para você ver funcionando ao vivo)");
  });

  it("utiliza a mensagem pré-pronta exata aprovada", () => {
    expect(obrigado).toContain("Oi Sofia, quero ativar meu Atendente Nexora!");
  });

  it("não possui termos técnicos alienantes como LLM, prompt, chatbot ou setup", () => {
    expect(obrigado).not.toMatch(/\b(llm|prompt|chatbot|setup)\b/i);
  });
});
