import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("Página de Vendas de R$ 27 — Como Nunca Mais Perder um Cliente pro Concorrente", () => {
  const manual = leia("app/manual/page.tsx");

  it("contém o título oficial e a headline de impacto focada no concorrente", () => {
    expect(manual).toContain("Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp");
    expect(manual).toContain("Enquanto você demora para responder no WhatsApp, o seu cliente está");
    expect(manual).toContain("fechando com o seu concorrente.");
  });

  it("apresenta a prova visual dos 3 segundos no sábado às 22:15", () => {
    expect(manual).toContain("Online agora (Responde em 3 segundos)");
    expect(manual).toContain("Sábado, 22:15");
    expect(manual).toContain("22:15 (3 segundos depois)");
  });

  it("contém os 3 cenários viscerais de dor", () => {
    expect(manual).toContain("O almoço de domingo interrompido");
    expect(manual).toContain("O quarto escuro às 23:45");
    expect(manual).toContain("As mãos ocupadas no atendimento");
  });

  it("faz a transição natural para a Nexora inclusa no pacote de R$ 27", () => {
    expect(manual).toContain("Atendente Nexora");
    expect(manual).toContain("ao garantir o material hoje por");
    expect(manual).toContain("R$ 27");
  });

  it("mantém a promessa de zero jargões técnicos", () => {
    expect(manual).not.toMatch(/\b(llm|chatbot|prompt|setup)\b/i);
  });
});
