import { describe, expect, it } from "vitest";
import { clientesParaCsv, type ClienteExportado } from "@/lib/dados/exportar";

/**
 * PORTABILIDADE (LGPD art. 18, V) — e a promessa que os Termos já fazem.
 *
 * Os Termos dizem, em dois pontos, que o dono pode exportar seus dados: no
 * bloco de cobrança ("continuam acessíveis para leitura e exportação") e no de
 * encerramento ("você tem 15 dias para exportar"). Enquanto não existisse rota,
 * essas duas frases eram falsas — e frase falsa em contrato é prova contra
 * quem escreveu.
 *
 * O arquivo tem que abrir no Excel de um barbeiro, não no jq de um programador:
 * por isso ponto-e-vírgula, BOM e vírgula decimal.
 */

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function cliente(over: Partial<ClienteExportado> = {}): ClienteExportado {
  return {
    nome: over.nome ?? "João Silva",
    telefone: over.telefone ?? "11988887777",
    origem: over.origem ?? "IMPORT",
    optOut: over.optOut ?? false,
    optOutAt: over.optOutAt ?? null,
    observacoes: over.observacoes ?? "",
    criadoEm: over.criadoEm ?? d("2026-01-05"),
    visitas: over.visitas ?? [],
  };
}

const linhas = (csv: string) => csv.replace(/^﻿/, "").trim().split("\n");

describe("o arquivo abre no Excel brasileiro", () => {
  it("começa com BOM, senão acento vira caractere quebrado", () => {
    expect(clientesParaCsv([])).toMatch(/^﻿/);
  });

  it("separa por ponto-e-vírgula, que é o que o Excel pt-BR espera", () => {
    const [cabecalho] = linhas(clientesParaCsv([]));
    expect(cabecalho).toContain(";");
    expect(cabecalho).toContain("Nome");
    expect(cabecalho).toContain("Telefone");
  });

  it("lista vazia ainda traz o cabeçalho, não um arquivo de zero byte", () => {
    expect(linhas(clientesParaCsv([]))).toHaveLength(1);
  });

  it("valor sai com vírgula decimal e sem R$, para o Excel somar a coluna", () => {
    const csv = clientesParaCsv([
      cliente({ visitas: [{ data: d("2026-02-10"), valorCents: 12345, servico: "Corte" }] }),
    ]);
    expect(linhas(csv)[1]).toContain("123,45");
    expect(linhas(csv)[1]).not.toContain("R$");
  });

  it("data sai em dd/mm/aaaa", () => {
    const csv = clientesParaCsv([
      cliente({ visitas: [{ data: d("2026-02-10"), valorCents: 0, servico: "" }] }),
    ]);
    expect(linhas(csv)[1]).toContain("10/02/2026");
  });
});

describe("o conteúdo do cliente sobrevive ao formato", () => {
  it("uma linha por cliente, na ordem recebida", () => {
    const csv = clientesParaCsv([
      cliente({ nome: "Ana", telefone: "11911112222" }),
      cliente({ nome: "Bruno", telefone: "11933334444" }),
    ]);
    const l = linhas(csv);
    expect(l).toHaveLength(3);
    expect(l[1]).toContain("Ana");
    expect(l[2]).toContain("Bruno");
  });

  it("nome com ponto-e-vírgula não parte a linha em duas colunas", () => {
    const csv = clientesParaCsv([cliente({ nome: "Silva; Souza" })]);
    expect(linhas(csv)[1]).toContain('"Silva; Souza"');
  });

  it("aspas dentro do texto são dobradas, como manda o CSV", () => {
    const csv = clientesParaCsv([cliente({ nome: 'Ana "Nina"' })]);
    expect(linhas(csv)[1]).toContain('"Ana ""Nina"""');
  });

  it("observação com quebra de linha não vira cliente novo", () => {
    const csv = clientesParaCsv([cliente({ observacoes: "gosta de\nmáquina 2" })]);
    // Continua sendo UM cliente: a quebra fica dentro do campo entre aspas.
    expect(csv).toContain('"gosta de\nmáquina 2"');
  });

  it("conta as visitas e soma o total gasto", () => {
    const csv = clientesParaCsv([
      cliente({
        visitas: [
          { data: d("2026-01-10"), valorCents: 5000, servico: "Corte" },
          { data: d("2026-02-08"), valorCents: 3000, servico: "Barba" },
        ],
      }),
    ]);
    const linha = linhas(csv)[1];
    expect(linha).toContain(";2;");
    expect(linha).toContain("80,00");
  });

  it("última visita é a mais recente, mesmo se a lista vier fora de ordem", () => {
    const csv = clientesParaCsv([
      cliente({
        visitas: [
          { data: d("2026-03-20"), valorCents: 0, servico: "" },
          { data: d("2026-01-10"), valorCents: 0, servico: "" },
        ],
      }),
    ]);
    expect(linhas(csv)[1]).toContain("20/03/2026");
  });

  it("cliente sem visita nenhuma não inventa data", () => {
    const linha = linhas(clientesParaCsv([cliente({ visitas: [] })]))[1];
    expect(linha).not.toMatch(/\d{2}\/\d{2}\/\d{4};.*\d{2}\/\d{2}\/\d{4}/);
  });

  it("quem pediu para parar sai marcado, para não ser recontatado por engano", () => {
    const csv = clientesParaCsv([
      cliente({ optOut: true, optOutAt: d("2026-04-01") }),
      cliente({ nome: "Outro", optOut: false }),
    ]);
    expect(linhas(csv)[1]).toContain(";sim;");
    expect(linhas(csv)[2]).toContain(";não;");
  });
});

describe("o CSV não pode virar ataque quando o dono abrir a planilha", () => {
  /**
   * CSV injection: Excel e Google Sheets executam a célula que começa com
   * = + - @ como FÓRMULA. Como o nome do cliente vem de uma lista colada por
   * terceiro, um nome como =HYPERLINK(...) roda na máquina do dono no momento
   * em que ele abre o próprio backup. Prefixar com aspa simples é o que a
   * OWASP recomenda e mantém o texto legível.
   */
  for (const perigoso of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
    it(`neutraliza nome começando com "${perigoso[0]}"`, () => {
      const linha = linhas(clientesParaCsv([cliente({ nome: perigoso })]))[1];
      expect(linha).toContain(`'${perigoso}`);
    });
  }

  it("nome comum não ganha aspa simples no começo", () => {
    expect(linhas(clientesParaCsv([cliente({ nome: "Ana" })]))[1]).not.toContain("'Ana");
  });
});
