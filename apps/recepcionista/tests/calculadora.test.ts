import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CICLO_DA_CALCULADORA,
  EXEMPLO,
  FATIAS,
  MAX_CLIENTES,
  contaDaCalculadora,
  lerInteiro,
  linkDoDiagnostico,
} from "@/lib/recuperacao/calculadora";
import { MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { visitasNaJanela } from "@/lib/recuperacao/estimativa";
import { lerParametros } from "@/lib/diagnostico/parametros";

/**
 * A CALCULADORA DA HOME FAZ A CONTA DO DIAGNÓSTICO.
 *
 * Três números que o visitante digita, a fórmula de lib/recuperacao/estimativa.
 * A única suposição a mais é o ritmo — e ela é a mesma que o diagnóstico usa:
 * a do ramo, quando a página sabe o ramo, e a padrão quando não sabe.
 */

describe("a conta da calculadora é a conta do diagnóstico", () => {
  it("o exemplo da tela: 400 clientes, R$ 150, 30%", () => {
    expect(contaDaCalculadora(EXEMPLO)).toEqual({
      parados: 120,
      umaVisitaCents: 1_800_000,
      ciclo: 30,
      visitas: 3,
      potencialCents: 5_400_000,
      faixa: { min: 810_000, central: 1_080_000, max: 1_350_000 },
      abaixoDoCorte: false,
    });
  });

  it("assume o ritmo padrão do diagnóstico", () => {
    expect(CICLO_DA_CALCULADORA).toBe(MEDIANA_POR_SEGMENTO.padrao);
    expect(CICLO_DA_CALCULADORA).toBe(30);
  });

  it("as fatias são 20%, 30% e 40%, e o exemplo usa uma delas", () => {
    expect([...FATIAS]).toEqual([0.2, 0.3, 0.4]);
    expect(FATIAS).toContain(EXEMPLO.fatia);
  });
});

// A página de barbearia não pode fazer a conta com o ritmo padrão e depois
// mandar para um diagnóstico que usa o ritmo de barbearia: seriam dois números
// para a mesma pessoa.
describe("o ramo muda o ritmo, como no diagnóstico", () => {
  it("com o ramo, usa o ritmo daquele ramo", () => {
    const conta = contaDaCalculadora({ ...EXEMPLO, ramo: "barbearia" });
    expect(conta.ciclo).toBe(MEDIANA_POR_SEGMENTO.barbearia);
    expect(conta.visitas).toBe(visitasNaJanela(MEDIANA_POR_SEGMENTO.barbearia));
  });

  it("ramo desconhecido cai no padrão, sem estourar", () => {
    expect(contaDaCalculadora({ ...EXEMPLO, ramo: "astronauta" }).ciclo).toBe(CICLO_DA_CALCULADORA);
  });
});

describe("o corte honesto aparece na calculadora também", () => {
  it("poucos parados ficam abaixo do corte", () => {
    expect(contaDaCalculadora({ clientes: 50, ticketReais: 150, fatia: 0.3 }).abaixoDoCorte).toBe(true);
  });

  it("campo vazio não é recusa: sem número não há conta", () => {
    const semClientes = contaDaCalculadora({ clientes: 0, ticketReais: 150, fatia: 0.3 });
    expect(semClientes.faixa).toEqual({ min: 0, central: 0, max: 0 });
    expect(semClientes.abaixoDoCorte).toBe(false);
    expect(contaDaCalculadora({ clientes: 400, ticketReais: 0, fatia: 0.3 }).abaixoDoCorte).toBe(false);
  });
});

describe("o que o visitante digita", () => {
  it("só dígitos contam", () => {
    expect(lerInteiro("1.200", MAX_CLIENTES)).toBe(1200);
    expect(lerInteiro("R$ 150", 100_000)).toBe(150);
  });

  it("vazio ou texto vale 0, sem erro", () => {
    expect(lerInteiro("", MAX_CLIENTES)).toBe(0);
    expect(lerInteiro("abc", MAX_CLIENTES)).toBe(0);
  });

  it("respeita o teto", () => {
    expect(lerInteiro("99999999", MAX_CLIENTES)).toBe(MAX_CLIENTES);
  });
});

describe("o botão leva o ticket ao diagnóstico pela URL", () => {
  const ler = (link: string) =>
    lerParametros(Object.fromEntries(new URLSearchParams(link.split("?")[1] ?? "")));

  it("ticket dentro da faixa vai, e o diagnóstico lê o mesmo valor", () => {
    const link = linkDoDiagnostico({ ticketReais: 150, criativo: null });
    expect(link).toBe("/diagnostico?ticket=150");
    expect(ler(link).ticketReais).toBe("150");
  });

  it("ticket fora da faixa do diagnóstico não vai", () => {
    expect(linkDoDiagnostico({ ticketReais: 4, criativo: null })).toBe("/diagnostico");
    expect(linkDoDiagnostico({ ticketReais: 5001, criativo: null })).toBe("/diagnostico");
    expect(linkDoDiagnostico({ ticketReais: 0, criativo: null })).toBe("/diagnostico");
  });

  it("as bordas da faixa vão", () => {
    expect(linkDoDiagnostico({ ticketReais: 5, criativo: null })).toBe("/diagnostico?ticket=5");
    expect(linkDoDiagnostico({ ticketReais: 5000, criativo: null })).toBe("/diagnostico?ticket=5000");
  });

  it("o criativo do anúncio segue junto, só se for identificador válido", () => {
    const link = linkDoDiagnostico({ ticketReais: 150, criativo: "Bar-A1" });
    expect(link).toBe("/diagnostico?ticket=150&c=bar-a1");
    expect(ler(link).criativo).toBe("bar-a1");
    expect(linkDoDiagnostico({ ticketReais: 150, criativo: "<script>" })).toBe("/diagnostico?ticket=150");
  });

  it("o ramo segue para o diagnóstico, e o diagnóstico lê o mesmo ramo", () => {
    const link = linkDoDiagnostico({ ticketReais: 150, criativo: null, ramo: "barbearia" });
    expect(link).toBe("/diagnostico?ramo=barbearia&ticket=150");
    expect(ler(link).ramo).toBe("barbearia");
  });

  it("ramo que o diagnóstico não conhece não vai", () => {
    expect(linkDoDiagnostico({ ticketReais: 150, criativo: null, ramo: "astronauta" })).toBe(
      "/diagnostico?ticket=150",
    );
  });
});

describe("o componente não inventa número nem guarda o que foi digitado", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const componente = () =>
    semComentarios(readFileSync(join(__dirname, "..", "components/calculadora.tsx"), "utf8"));

  it("nenhum número de regra escrito à mão", () => {
    const fonte = componente();
    for (const literal of ["15%", "25%", "0.15", "0.25", "90 dias", "30 dias", "30%"]) {
      expect(fonte, literal).not.toContain(literal);
    }
  });

  it("o ritmo que a tela mostra é o da conta, e o botão leva direto ao login", () => {
    const fonte = componente();
    expect(fonte).toContain("conta.ciclo");
    expect(fonte).toContain('href="/login"');
  });

  it("só registra os dois eventos da calculadora", () => {
    const registrados = [...componente().matchAll(/registrar\(\s*["']([a-z_]+)["']\s*\)/g)]
      .map(([, nome]) => nome)
      .sort();
    expect(registrados).toEqual(["clicou_calculadora", "usou_calculadora"]);
  });

  it("o navegador só guarda a marca de uso, nunca os números", () => {
    const fonte = componente();
    const gravacoes = [...fonte.matchAll(/sessionStorage\.setItem\(([^)]*)\)/g)].map(([, args]) =>
      args.replace(/\s+/g, ""),
    );
    expect(gravacoes).toEqual(['MARCA_DE_USO,"1"']);
    expect(fonte).toContain('const MARCA_DE_USO = "nx_calc"');
    expect(fonte).not.toMatch(/localStorage|document\.cookie/);
  });
});
