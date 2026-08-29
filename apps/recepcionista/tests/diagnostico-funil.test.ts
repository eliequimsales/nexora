import { describe, expect, it } from "vitest";
import { gerarDiagnostico, type ClienteBase } from "@/lib/importacao/diagnostico";
import { medianaDoSegmento, SEGMENTOS } from "@/lib/recuperacao/ciclo";

const HOJE = new Date("2026-09-01T12:00:00.000Z");
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000);

/** Base grande e claramente sumida: 60 clientes, última visita há ~8 meses. */
function baseSumida(opcoes: { comValor: boolean; comData: boolean }): ClienteBase[] {
  return Array.from({ length: 60 }, (_, i) => ({
    nome: `Cliente ${i + 1}`,
    telefone: `1198888${String(1000 + i)}`,
    visitas: opcoes.comData
      ? [
          { data: diasAtras(260), valorCents: opcoes.comValor ? 5000 : 0 },
          { data: diasAtras(285), valorCents: opcoes.comValor ? 5000 : 0 },
          { data: diasAtras(310), valorCents: opcoes.comValor ? 5000 : 0 },
        ]
      : [],
  }));
}

// ---------------------------------------------------------------------------
// A PORTA DE ENTRADA DA EMPRESA. Estes dois casos são o caminho de MENOR
// fricção — a lista que o dono de barbearia realmente tem. Se o motor recusa a
// venda neles, o funil recusa justamente quem chegou pelo caminho mais fácil.
// ---------------------------------------------------------------------------
describe("diagnóstico — lista sem coluna de valor", () => {
  it("NÃO recusa a venda dizendo que há R$ 0,00 a recuperar", () => {
    const d = gerarDiagnostico(baseSumida({ comValor: false, comData: true }), {
      hoje: HOJE,
      medianaSegmentoDias: 24,
    });

    expect(d.sumidos).toBeGreaterThan(25);
    // Recusar por falta de DADO é diferente de recusar por falta de OPORTUNIDADE.
    // A primeira é um bug; a segunda é a Constituição.
    expect(d.corteHonesto).toBe(false);
    expect(d.recomendacao).not.toMatch(/R\$\s*0,00/);
    expect(d.faltando.valor).toBe(true);
  });

  it("com o ticket informado pelo dono, calcula e ADMITE de onde veio o número", () => {
    const d = gerarDiagnostico(baseSumida({ comValor: false, comData: true }), {
      hoje: HOJE,
      medianaSegmentoDias: 24,
      ticketPadraoCents: 5000,
    });

    expect(d.faltando.valor).toBe(false);
    expect(d.recuperavelCents.min).toBeGreaterThan(0);
    // Verdade acima de marketing: o valor não saiu da lista dele, saiu da boca
    // dele — e a tela tem que dizer isso.
    expect(d.confianca).toBe("baixa");
    expect(d.motivoConfianca.toLowerCase()).toContain("você");
  });
});

describe("diagnóstico — lista sem coluna de data", () => {
  it("NÃO afirma que 100% da base sumiu quando o que falta é a data", () => {
    const d = gerarDiagnostico(baseSumida({ comValor: true, comData: false }), {
      hoje: HOJE,
      medianaSegmentoDias: 24,
    });

    // Sem data não existe "sumido" — existe "não sei". Dizer 100% é inventar.
    expect(d.faltando.data).toBe(true);
    expect(d.percentualSumido).toBe(0);
    expect(d.recuperavelCents.min).toBe(0);
    expect(d.corteHonesto).toBe(false);
  });
});

describe("diagnóstico — lista completa continua funcionando como antes", () => {
  it("com data e valor, entrega faixa, método e selo de confiança", () => {
    const d = gerarDiagnostico(baseSumida({ comValor: true, comData: true }), {
      hoje: HOJE,
      medianaSegmentoDias: 24,
    });

    expect(d.faltando.data).toBe(false);
    expect(d.faltando.valor).toBe(false);
    expect(d.sumidos).toBeGreaterThan(25);
    expect(d.recuperavelCents.min).toBeGreaterThan(0);
    expect(d.recuperavelCents.max).toBeGreaterThan(d.recuperavelCents.min);
    expect(d.metodo.length).toBeGreaterThan(20);
    expect(d.corteHonesto).toBe(false);
  });

  it("base pequena de verdade continua sendo recusada — o Corte Honesto vale", () => {
    const d = gerarDiagnostico(baseSumida({ comValor: true, comData: true }).slice(0, 5), {
      hoje: HOJE,
      medianaSegmentoDias: 24,
    });

    expect(d.corteHonesto).toBe(true);
    expect(d.recomendacao.toUpperCase()).toMatch(/NÃO COMPRAR|NÃO COMPRE/);
  });
});

// ---------------------------------------------------------------------------
// SEGMENTO. O erro aqui é invisível: nenhum log, nenhuma exceção, só um número
// errado na tela que vende. Salão calculado com 30 dias marca gente em dia como
// atrasada; odontologia calculada com 30 marca a base inteira como sumida.
// ---------------------------------------------------------------------------
describe("normalização de segmento", () => {
  it("acha o segmento mesmo com acento e caixa alta", () => {
    expect(medianaDoSegmento("Salão de beleza")).toBe(38);
    expect(medianaDoSegmento("salão-de-beleza")).toBe(38);
    expect(medianaDoSegmento("ESTÉTICA")).toBe(30);
    expect(medianaDoSegmento("Odontologia")).toBe(180);
  });

  it("segmento desconhecido cai no padrão, sem estourar", () => {
    expect(medianaDoSegmento("floricultura")).toBe(30);
    expect(medianaDoSegmento(null)).toBe(30);
    expect(medianaDoSegmento("")).toBe(30);
  });

  it("a lista de segmentos vem do próprio motor e não inclui o padrão", () => {
    expect(SEGMENTOS).toContain("barbearia");
    expect(SEGMENTOS).toContain("salao-de-beleza");
    expect(SEGMENTOS).not.toContain("padrao");
    for (const s of SEGMENTOS) expect(medianaDoSegmento(s)).toBeGreaterThan(0);
  });
});
