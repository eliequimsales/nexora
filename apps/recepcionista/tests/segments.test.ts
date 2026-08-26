import { describe, expect, it } from "vitest";
import {
  mergeTopics,
  parseSegmentHypotheses,
  parseSegmentTopics,
  SEED_TEMPLATES,
  slugifySegment,
} from "@/lib/segments";

describe("slugifySegment", () => {
  it("normaliza rótulos para a chave global do template", () => {
    expect(slugifySegment("Pet Shop")).toBe("pet-shop");
    expect(slugifySegment("Imobiliária")).toBe("imobiliaria");
    expect(slugifySegment("  Salão de Beleza!! ")).toBe("salao-de-beleza");
  });
});

describe("parseSegmentHypotheses — descoberta assistida", () => {
  it("ordena por confiança e limita a 3 hipóteses", () => {
    const result = parseSegmentHypotheses(
      '{"hipoteses":[{"area":"Estúdio de Pilates","confianca":76},{"area":"Academia","confianca":94},{"area":"Centro de Treinamento","confianca":83},{"area":"Crossfit","confianca":70}]}',
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ area: "Academia", confidence: 94 });
    expect(result[1].area).toBe("Centro de Treinamento");
  });

  it("sem informação suficiente devolve lista vazia (nunca inventa)", () => {
    expect(parseSegmentHypotheses('{"hipoteses":[]}')).toEqual([]);
    expect(parseSegmentHypotheses("nada de json")).toEqual([]);
  });
});

describe("mergeTopics — combinação de templates (múltiplas áreas)", () => {
  it("une templates sem duplicar assuntos equivalentes", () => {
    const merged = mergeTopics([
      [
        { topic: "Horários", question: "Quais os horários de funcionamento?" },
        { topic: "Planos", question: "Quais planos vocês oferecem?" },
      ],
      [
        { topic: "Horário", question: "Quais os horários de funcionamento?" }, // duplicado
        { topic: "Produtos", question: "Quais produtos vocês vendem?" },
      ],
    ]);
    expect(merged.map((t) => t.topic)).toEqual(["Horários", "Planos", "Produtos"]);
  });

  it("respeita o teto de assuntos", () => {
    const big = Array.from({ length: 30 }, (_, i) => ({ topic: `T${i}`, question: `Pergunta número ${i}?` }));
    expect(mergeTopics([big], 18)).toHaveLength(18);
  });
});

describe("SEED_TEMPLATES — curadoria Nexora", () => {
  it("todo tópico de semente tem assunto e pergunta válidos", () => {
    for (const [slug, template] of Object.entries(SEED_TEMPLATES)) {
      expect(slugifySegment(template.name).length).toBeGreaterThan(0);
      expect(template.topics.length).toBeGreaterThanOrEqual(8);
      for (const t of template.topics) {
        expect(t.topic.length, `${slug}:${t.topic}`).toBeGreaterThan(2);
        expect(t.question.length, `${slug}:${t.topic}`).toBeGreaterThan(10);
      }
    }
  });
});

describe("parseSegmentTopics — template gerado por IA", () => {
  it("valida e converte o formato", () => {
    const topics = parseSegmentTopics(
      '{"topicos":[{"assunto":"Orçamentos","pergunta":"Como funcionam os orçamentos?"},{"assunto":"Prazo","pergunta":"Qual o prazo médio de entrega?"},{"assunto":"Pagamento","pergunta":"Quais formas de pagamento vocês aceitam?"}]}',
    );
    expect(topics).toHaveLength(3);
    expect(topics[0]).toEqual({ topic: "Orçamentos", question: "Como funcionam os orçamentos?" });
  });

  it("rejeita formatos inválidos", () => {
    expect(() => parseSegmentTopics('{"topicos":[]}')).toThrow();
    expect(() => parseSegmentTopics("sem json")).toThrow();
  });
});
