import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECLARACAO_BASE, VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";

/**
 * A DECLARAÇÃO GRAVADA TEM QUE SER A DECLARAÇÃO LIDA.
 *
 * A rota de importação exigia `confirmo` e recusava gravar sem ele — mas não
 * guardava nada, enquanto o comentário do arquivo afirmava que "registra que
 * ele declarou ter base legal". Era a mesma falha de sempre: o produto
 * afirmando o que o código não faz.
 *
 * Registrar um booleano `true` também não resolveria. Se a frase da tela mudar
 * daqui a um ano, ninguém consegue dizer o que a pessoa aceitou naquele dia —
 * e é exatamente isso que a ANPD pergunta. Por isso o texto é constante, é
 * gravado por extenso junto da versão, e este teste amarra a tela ao registro.
 */

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("a declaração é uma só", () => {
  it("existe, é frase de gente e fala de base legal", () => {
    expect(DECLARACAO_BASE.length).toBeGreaterThan(40);
    expect(DECLARACAO_BASE).toMatch(/clientes/i);
  });

  it("é versionada junto com os documentos", () => {
    expect(VERSAO_DOCUMENTOS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("as telas mostram o texto que vai para o registro", () => {
  for (const tela of ["app/painel/clientes/importar/page.tsx", "app/diagnostico/painel.tsx"]) {
    it(`${tela} usa a constante, não uma cópia digitada`, () => {
      const fonte = leia(tela);
      expect(fonte).toContain("DECLARACAO_BASE");
      // A frase antiga, digitada à mão, não pode sobreviver ao lado da
      // constante — duas versões na mesma tela é como a divergência começa.
      expect(fonte).not.toContain("Confirmo que são clientes meus e que eu já tenho contato");
      expect(fonte).not.toContain("Confirmo que esses clientes são meus e que eu posso falar com eles, e aceito");
    });
  }
});

describe("a rota de importação grava a declaração", () => {
  const rota = leia("app/api/clientes/importar/route.ts");

  it("escreve em registroImportacao quando grava de verdade", () => {
    expect(rota).toContain("registroImportacao");
    expect(rota).toContain("DECLARACAO_BASE");
  });

  it("não grava registro na simulação, que não trata dado nenhum", () => {
    expect(rota).toMatch(/if\s*\(\s*!simular\s*\)[\s\S]{0,400}registroImportacao/);
  });
});
