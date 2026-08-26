import { describe, expect, it } from "vitest";
import { matchesHandoffKeyword } from "@/lib/ai/handoff";

describe("matchesHandoffKeyword", () => {
  const keywords = ["falar com atendente", "reclamação", "cancelar"];

  it("detecta palavra-chave exata", () => {
    expect(matchesHandoffKeyword("quero falar com atendente agora", keywords)).toBe(true);
  });

  it("ignora maiúsculas e acentos", () => {
    expect(matchesHandoffKeyword("QUERO FAZER UMA RECLAMACAO!!", keywords)).toBe(true);
    expect(matchesHandoffKeyword("Preciso CANCELAR meu pedido", keywords)).toBe(true);
  });

  it("não dispara em mensagens comuns", () => {
    expect(matchesHandoffKeyword("qual o horário de vocês?", keywords)).toBe(false);
  });

  it("detecta palavra-chave cercada de emojis e pontuação (cliente irritado)", () => {
    expect(matchesHandoffKeyword("😡😡 QUERO FALAR COM ATENDENTE AGORA!!!", keywords)).toBe(true);
  });

  it("detecta palavra-chave em mensagem longa e insistente", () => {
    const long = `${"não aguento mais esperar, ".repeat(50)} isso é uma reclamação formal`;
    expect(matchesHandoffKeyword(long, keywords)).toBe(true);
  });

  it("lista vazia nunca dispara", () => {
    expect(matchesHandoffKeyword("quero falar com atendente", [])).toBe(false);
  });

  it("palavras-chave vazias são ignoradas", () => {
    expect(matchesHandoffKeyword("qualquer coisa", ["", "  "])).toBe(false);
  });
});
