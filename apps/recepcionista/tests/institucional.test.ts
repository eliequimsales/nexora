import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  anoAtual,
  linhaDaEmpresa,
  linkDeSuporte,
  LINKS_DO_RODAPE,
  SELOS_DO_RODAPE,
} from "@/lib/institucional";
import { lerFornecedor } from "@/lib/legal/identidade";
import { resumoDoStatus, type ComponenteDoStatus } from "@/lib/status/resumo";

/**
 * O QUE A EMPRESA MOSTRA SOBRE SI MESMA.
 *
 * Rodapé, /sobre e /status são as telas em que um dono desconfiado decide se a
 * Nexora é empresa de verdade. Justamente por isso nenhuma delas pode inventar:
 * razão social e CNPJ vêm das variáveis do servidor (o repositório é público e o
 * dado muda fora do código), e o status confere o serviço na hora, sem percentual
 * de disponibilidade que ninguém mediu.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

// Dados fictícios: CNPJ de exemplo, nenhum CPF.
const EMPRESA = lerFornecedor({
  FORNECEDOR_NOME: "Empresa Exemplo LTDA",
  FORNECEDOR_DOCUMENTO: "12345678000195",
  FORNECEDOR_ENDERECO: "Rua Exemplo, 100, Centro, São Paulo/SP, CEP 00000-000",
  FORNECEDOR_EMAIL: "contato@exemplo.com",
});

describe("a linha da empresa no rodapé", () => {
  it("mostra razão social e documento com o rótulo certo", () => {
    expect(linhaDaEmpresa(EMPRESA, 2026)).toBe(
      "© 2026 Empresa Exemplo LTDA · CNPJ 12.345.678/0001-95",
    );
  });

  it("some inteira enquanto a identificação não está preenchida", () => {
    expect(linhaDaEmpresa(lerFornecedor({}), 2026)).toBeNull();
  });

  it("o ano é o de Brasília, não o do servidor em UTC", () => {
    // 31/12 às 22h em Brasília já é 01/01 em UTC.
    expect(anoAtual(new Date("2027-01-01T01:00:00.000Z"))).toBe(2026);
  });
});

describe("os links do rodapé", () => {
  it("são Sobre, Termos, Privacidade & LGPD e Status, e todos levam a páginas que existem", () => {
    expect(LINKS_DO_RODAPE.map((l) => l.href)).toEqual([
      "/sobre",
      "/termos",
      "/privacidade",
      "/status",
    ]);
    for (const l of [...LINKS_DO_RODAPE, ...SELOS_DO_RODAPE]) {
      expect(existsSync(join(RAIZ, `app${l.href}/page.tsx`)), l.href).toBe(true);
    }
  });

  it("o suporte é o e-mail de quem presta o serviço, e sem e-mail leva ao contato da /sobre", () => {
    expect(linkDeSuporte(EMPRESA)).toBe("mailto:contato@exemplo.com");
    expect(linkDeSuporte(lerFornecedor({}))).toBe("/sobre#contato");
  });

  // Selo que parece certificado sem existir certificado é o mesmo defeito do CNPJ
  // que o rodapé antigo prometia e nunca mostrou.
  it("os selos descrevem fatos, não certificados", () => {
    const textos = SELOS_DO_RODAPE.map((s) => s.texto.toLowerCase()).join(" ");
    expect(textos).toContain("stripe");
    expect(textos).toContain("lgpd");
    expect(textos).not.toMatch(/certificad|100%|garantid|selo/);
  });
});

describe("o rodapé aparece nas páginas públicas", () => {
  it("o do funil e o do papel leem os mesmos dados e são gerados a cada acesso", () => {
    for (const arquivo of ["components/rodape-funil.tsx", "components/rodape-papel.tsx"]) {
      const fonte = leia(arquivo);
      expect(fonte, arquivo).toContain("LINKS_DO_RODAPE");
      expect(fonte, arquivo).toContain("linhaDaEmpresa(");
      expect(fonte, arquivo).toContain("noStore()");
    }
  });

  it("landing e diagnóstico usam o rodapé do funil", () => {
    for (const pagina of ["app/page.tsx", "app/diagnostico/page.tsx"]) {
      expect(leia(pagina), pagina).toContain("<RodapeFunil");
    }
  });

  it("documentos, /sobre e /status usam o rodapé do papel", () => {
    for (const pagina of ["app/legal.tsx", "app/sobre/page.tsx", "app/status/page.tsx"]) {
      expect(leia(pagina), pagina).toContain("<RodapePapel");
    }
  });
});

describe("/sobre", () => {
  const sobre = () => leia("app/sobre/page.tsx");

  it("é gerada a cada acesso e lê quem presta o serviço das variáveis", () => {
    expect(sobre()).toMatch(/export const dynamic = "force-dynamic"/);
    expect(sobre()).toContain("FORNECEDOR");
  });

  it("não escreve razão social nem CNPJ à mão", () => {
    const fonte = readFileSync(join(RAIZ, "app/sobre/page.tsx"), "utf8");
    expect(fonte).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    expect(fonte).not.toContain("LTDA");
  });

  it("o manifesto contra disparo em massa usa o tamanho real da onda", () => {
    expect(sobre()).toContain("TAMANHO_DA_ONDA");
    expect(sobre().toLowerCase()).toContain("disparo em massa");
  });

  it("tem a seção de contato para onde o suporte aponta", () => {
    expect(sobre()).toContain('id="contato"');
  });

  it("não afirma o que não foi confirmado", () => {
    expect(sobre().toLowerCase()).not.toContain("equipe distribuída");
  });

  it("apresenta quem fundou a Nexora, com lugar para a foto e canal de contato", () => {
    const fonte = sobre();
    expect(fonte).toContain('id="fundacao"');
    expect(fonte).toContain("Quem fundou a Nexora");
    // Placeholder semântico: a foto entra no lugar, sem retrato de banco de imagens.
    expect(fonte).toMatch(/<figure[\s>]/);
    expect(fonte).toMatch(/<figcaption[\s>]/);
    expect(fonte).toContain("linkDeSuporte(");
  });

  // Uma pessoa por trás do produto é o que tira o cheiro de "empresa anônima".
  // Um currículo inventado devolve esse cheiro multiplicado — e este repositório
  // é público, então nome e cargo NÃO moram aqui: saem das variáveis do servidor.
  it("a seção do fundador não inventa currículo nem cargo", () => {
    const fonte = sobre();
    const bloco = fonte.slice(fonte.indexOf('id="fundacao"'), fonte.indexOf('id="empresa"'));
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).not.toMatch(/\bCEO\b|\bCTO\b|formad[oa]|graduad[oa]|\bMBA\b|anos de (mercado|experiência)/i);
  });
});

describe("/status", () => {
  const comp = (
    chave: ComponenteDoStatus["chave"],
    estado: ComponenteDoStatus["estado"],
    opcional = false,
  ): ComponenteDoStatus => ({ chave, nome: chave, estado, detalhe: "", opcional });

  it("tudo respondendo é tudo operando", () => {
    const r = resumoDoStatus([
      comp("painel", "operando"),
      comp("pagamentos", "operando"),
      comp("emails", "operando"),
    ]);
    expect(r.tom).toBe("ok");
    expect(r.titulo).toBe("Todos os sistemas operacionais");
  });

  // O que a Nexora vende hoje é a recuperação de clientes. O atendente de
  // WhatsApp é módulo opcional, em testes e fora dos planos: o estado dele
  // continua visível no item, mas não derruba o resumo do que está sendo vendido.
  it("módulo opcional não entra no resumo, nem desligado nem com problema", () => {
    for (const estado of ["desligado", "fora", "nao_configurado"] as const) {
      expect(
        resumoDoStatus([
          comp("painel", "operando"),
          comp("pagamentos", "operando"),
          comp("emails", "operando"),
          comp("whatsapp", estado, true),
        ]).tom,
        estado,
      ).toBe("ok");
    }
  });

  it("uma parte fora ou sem configuração é problema parcial", () => {
    expect(
      resumoDoStatus([comp("painel", "operando"), comp("pagamentos", "fora"), comp("emails", "operando")])
        .tom,
    ).toBe("parcial");
    expect(
      resumoDoStatus([
        comp("painel", "operando"),
        comp("pagamentos", "operando"),
        comp("emails", "nao_configurado"),
      ]).tom,
    ).toBe("parcial");
  });

  it("banco fora é o serviço fora", () => {
    expect(resumoDoStatus([comp("painel", "fora"), comp("pagamentos", "operando")]).tom).toBe("fora");
  });

  it("todo resumo tem um título para a pessoa ler", () => {
    for (const estado of ["operando", "fora", "nao_configurado", "desligado"] as const) {
      expect(resumoDoStatus([comp("painel", estado)]).titulo.length).toBeGreaterThan(0);
    }
  });

  it("o atendente de WhatsApp é o módulo opcional, e a página diz isso", () => {
    expect(leia("lib/status/verificar.ts")).toMatch(/opcional:\s*true/);
    const pagina = leia("app/status/page.tsx");
    expect(pagina).toContain("Módulo opcional");
    expect(pagina.toLowerCase()).toContain("não entra no resumo");
  });

  it("confere na hora, sem histórico inventado", () => {
    const pagina = leia("app/status/page.tsx");
    expect(pagina).toMatch(/export const dynamic = "force-dynamic"/);
    expect(pagina).not.toMatch(/\d+(?:[.,]\d+)?\s?%/);
    expect(pagina.toLowerCase()).not.toContain("uptime");
  });

  it("cada verificação tem prazo e nenhuma mostra endereço ou erro cru", () => {
    const verificar = leia("lib/status/verificar.ts");
    expect(verificar).toContain("comPrazo(");
    expect(verificar).not.toMatch(/\.message/);
    expect(verificar).not.toMatch(/detalhe:\s*problemaNoGateway/);
  });
});
