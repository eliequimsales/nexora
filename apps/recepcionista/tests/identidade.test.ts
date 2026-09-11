import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VARIAVEIS_DO_FORNECEDOR,
  camposPendentes,
  formatarDocumento,
  identificacaoCompleta,
  lerFornecedor,
} from "@/lib/legal/identidade";

/**
 * QUEM PRESTA O SERVIÇO — lido do ambiente, nunca escrito no código.
 *
 * O repositório no GitHub é público. CPF e endereço de casa escritos em
 * lib/legal/identidade.ts ficariam visíveis para qualquer um, e para sempre no
 * histórico, mesmo apagados depois. Por isso a identificação mora nas variáveis
 * do Railway e o código só lê.
 *
 * Os dados abaixo são fictícios. 123.456.789-09 é um CPF de teste conhecido.
 */

const RAIZ = join(__dirname, "..");

const COMPLETO = {
  FORNECEDOR_NOME: "Fulano de Tal",
  FORNECEDOR_DOCUMENTO: "12345678909",
  FORNECEDOR_ENDERECO: "Rua Exemplo, 100, Centro, Cidade/UF, CEP 00000-000",
  FORNECEDOR_EMAIL: "contato@exemplo.com",
};

describe("a identificação vem das variáveis do ambiente", () => {
  it("sem variável, todo campo fica pendente e a cobrança fica travada", () => {
    const f = lerFornecedor({});
    expect(identificacaoCompleta(f)).toBe(false);
    expect(camposPendentes(f).sort()).toEqual(["documento", "email", "encarregado", "endereco", "nome"]);
  });

  it("com as quatro variáveis, a identificação fica completa", () => {
    const f = lerFornecedor(COMPLETO);
    expect(identificacaoCompleta(f)).toBe(true);
    expect(f.nome).toBe("Fulano de Tal");
    expect(f.endereco).toBe("Rua Exemplo, 100, Centro, Cidade/UF, CEP 00000-000");
    expect(f.email).toBe("contato@exemplo.com");
  });

  it("o encarregado é o próprio fornecedor quando não vem outro nome", () => {
    expect(lerFornecedor(COMPLETO).encarregado).toBe("Fulano de Tal");
    expect(lerFornecedor({ ...COMPLETO, FORNECEDOR_ENCARREGADO: "Beltrano" }).encarregado).toBe("Beltrano");
  });

  it("variável em branco conta como faltando", () => {
    const f = lerFornecedor({ ...COMPLETO, FORNECEDOR_ENDERECO: "   " });
    expect(camposPendentes(f)).toEqual(["endereco"]);
    expect(identificacaoCompleta(f)).toBe(false);
  });

  it("os nomes das variáveis são os que o runbook manda criar", () => {
    expect(VARIAVEIS_DO_FORNECEDOR).toEqual({
      nome: "FORNECEDOR_NOME",
      documento: "FORNECEDOR_DOCUMENTO",
      endereco: "FORNECEDOR_ENDERECO",
      email: "FORNECEDOR_EMAIL",
      encarregado: "FORNECEDOR_ENCARREGADO",
    });
  });
});

describe("o documento aparece formatado", () => {
  it("CPF com 11 dígitos vira 000.000.000-00", () => {
    expect(formatarDocumento("12345678909")).toBe("123.456.789-09");
    expect(lerFornecedor(COMPLETO).documento).toBe("123.456.789-09");
  });

  it("CPF já formatado continua igual", () => {
    expect(formatarDocumento("123.456.789-09")).toBe("123.456.789-09");
  });

  it("CNPJ com 14 dígitos vira 00.000.000/0000-00", () => {
    expect(formatarDocumento("12345678000195")).toBe("12.345.678/0001-95");
  });
});

/** Dígito verificador de CPF: separa CPF de verdade de telefone com 11 dígitos. */
function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(digitos.slice(0, 9), 10) === Number(digitos[9]) && dv(digitos.slice(0, 10), 11) === Number(digitos[10]);
}

function listar(dir: string): string[] {
  return readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return listar(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

describe("CPF nunca entra no código — o repositório é público", () => {
  it("a verificação reconhece um CPF válido e ignora telefone", () => {
    expect(cpfValido("12345678909")).toBe(true);
    expect(cpfValido("11999998888")).toBe(false);
  });

  it("nenhum arquivo de app/, components/ e lib/ tem um CPF escrito", () => {
    const CANDIDATO = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
    const achados = [...listar("app"), ...listar("components"), ...listar("lib")].flatMap((arquivo) =>
      (readFileSync(join(RAIZ, arquivo), "utf8").match(CANDIDATO) ?? [])
        .filter((trecho) => cpfValido(trecho.replace(/\D/g, "")))
        .map(() => arquivo),
    );
    expect(achados).toEqual([]);
  });

  it("as páginas jurídicas são geradas a cada acesso, com as variáveis do servidor", () => {
    // Geradas no build, elas mostrariam "[DEFINIR]" mesmo com o Railway preenchido:
    // o build do Docker não enxerga as variáveis do serviço.
    for (const pagina of ["app/termos/page.tsx", "app/privacidade/page.tsx", "app/operador/page.tsx"]) {
      expect(readFileSync(join(RAIZ, pagina), "utf8"), pagina).toMatch(/export const dynamic = "force-dynamic"/);
    }
  });

  it("o aviso das páginas manda preencher as variáveis, não o arquivo", () => {
    const casca = readFileSync(join(RAIZ, "app/legal.tsx"), "utf8");
    expect(casca).toContain("FORNECEDOR_");
    expect(casca).not.toContain("<code>lib/legal/identidade.ts</code>");
  });
});
