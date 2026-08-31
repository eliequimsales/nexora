import { describe, expect, it } from "vitest";
import { gerarDiagnostico, type ClienteBase } from "@/lib/importacao/diagnostico";

/**
 * CONCORDÂNCIA DE GÊNERO.
 *
 * A tela mostrava "Beatriz Oliveira — sumido há 190 dias" e "164 além do normal
 * dele". O sistema NÃO sabe o gênero de ninguém: a lista traz nome e telefone,
 * mais nada. Adivinhar por nome erra em Alex, Darci, Ariel — e erra na frente
 * do dono, na tela que vende.
 *
 * A saída não é adivinhar melhor: é escrever frase que não pede gênero.
 * Mesma família do "sumiuram" — português quebrado custa credibilidade antes
 * de qualquer argumento.
 */

const HOJE = new Date("2026-09-01T12:00:00.000Z");
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000);

const base: ClienteBase[] = Array.from({ length: 40 }, (_, i) => ({
  nome: `Cliente ${i + 1}`,
  telefone: `1198888${String(1000 + i)}`,
  visitas: [
    { data: diasAtras(200), valorCents: 5000 },
    { data: diasAtras(226), valorCents: 5000 },
    { data: diasAtras(252), valorCents: 5000 },
  ],
}));

/** Marcas que só existem se alguém assumiu um gênero. */
const MARCAS = /\b(dele|dela|deles|delas|sumido|sumida|atrasado|atrasada|ele|ela)\b/i;

describe("nenhum texto gerado assume gênero do cliente", () => {
  const d = gerarDiagnostico(base, { hoje: HOJE, medianaSegmentoDias: 24 });

  it("o porquê de cada cliente é neutro", () => {
    expect(d.nomes.length).toBeGreaterThan(0);
    for (const n of d.nomes) {
      expect(n.porque, `"${n.porque}"`).not.toMatch(MARCAS);
    }
  });

  it("o método e a recomendação são neutros", () => {
    expect(d.metodo).not.toMatch(MARCAS);
    expect(d.recomendacao).not.toMatch(MARCAS);
  });

  it("base pequena demais para ritmo também é neutra", () => {
    const magra = base.slice(0, 30).map((c) => ({ ...c, visitas: c.visitas.slice(0, 1) }));
    const dm = gerarDiagnostico(magra, { hoje: HOJE, medianaSegmentoDias: 24 });
    for (const n of dm.nomes) {
      expect(n.porque, `"${n.porque}"`).not.toMatch(MARCAS);
    }
  });
});
