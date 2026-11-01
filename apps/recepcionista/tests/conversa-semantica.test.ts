import { describe, expect, it } from "vitest";
import { aplicarSemanticaDosServicos, conducaoDaConversaSchema, semanticaDoServicoSchema, type ItemServicoSemantico } from "@/lib/atendente/conversa-semantica";
import type { ServicoNexa } from "@/lib/atendente/configuracao-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

const servico = (id: string, nome: string, dados: Partial<ServicoNexa> = {}): ServicoNexa => ({ id, nome, descricao: "", precoModo: "FIXO", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL", ...dados });
function cadastro(...servicos: ServicoNexa[]) { const c = configuracaoExemplo(); c.informacoes.servicos = servicos; return c; }
const especificar = (texto: string, patch: Partial<ItemServicoSemantico> = {}): ItemServicoSemantico => ({ operacao: "ESPECIFICAR", servicoId: "area", nome: "prancha", evidencia: texto, ...patch });

describe("contrato semântico de serviços", () => {
  it("mantém os campos novos compatíveis com extrações antigas", () => {
    expect(semanticaDoServicoSchema.parse({})).toEqual({ operacao: null, servicoId: null, categoria: null, condicaoPreco: null });
    expect(conducaoDaConversaSchema.parse(undefined)).toBeNull();
    expect(conducaoDaConversaSchema.parse({ listaServicos: "CONCLUIDA", servicoEmFocoId: "s1", evidencia: "só esses" })).toEqual({ listaServicos: "CONCLUIDA", servicoEmFocoId: "s1", evidencia: "só esses" });
  });

  it("especifica o serviço sem exigir palavras de renomeação e preserva sua identidade", () => {
    const texto = "cabelos so q o serviço q eu estou falando e a prancha";
    const c = cadastro(servico("area", "cabelos"));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { categoria: "cabelos" })], texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "area", nome: "prancha", descricao: "Categoria: cabelos.", precoCents: null, duracaoMin: null });
    expect(c.informacoes.servicos[0].nome).toBe("cabelos");
    expect(r.alteracoes).toEqual(["Serviço: prancha"]);
    expect(r.esclarecimento).toBeUndefined();
  });

  it("a mesma operação serve para outras categorias e serviços", () => {
    const texto = "estética é a área, o serviço é limpeza de pele";
    const c = cadastro(servico("area", "estética", { precoCents: 12000, duracaoMin: 45 }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { nome: "limpeza de pele", categoria: "estética" })], texto);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "area", nome: "limpeza de pele", precoCents: 12000, duracaoMin: 45 });
  });

  it("usa o ID autorizado sem exigir o nome antigo na frase atual", () => {
    const texto = "o serviço que eu quis dizer é escova";
    const c = cadastro(servico("area", "cabelos"));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { nome: "escova" })], texto);
    expect(r.rascunho.informacoes.servicos[0].nome).toBe("escova");
  });

  it("não relata mudança quando os mesmos dados já estavam salvos", () => {
    const c = cadastro(servico("area", "prancha"));
    const r = aplicarSemanticaDosServicos(c, [especificar("prancha")], "prancha");
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
  });

  it("não muda só a capitalização do nome quando a atualização não declarou um novo nome", () => {
    const c = cadastro(servico("area", "Prancha"));
    const r = aplicarSemanticaDosServicos(c, [especificar("depende do tamanho", { operacao: "ATUALIZAR" })], "depende do tamanho");
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
  });

  it.each([
    { patch: { servicoId: "outra-empresa" }, texto: "o serviço é prancha" },
    { patch: { servicoId: null }, texto: "o serviço é prancha" },
    { patch: { nome: "escova" }, texto: "o serviço é prancha" },
    { patch: { operacao: "REMOVER" } as unknown as Partial<ItemServicoSemantico>, texto: "o serviço é prancha" },
  ])("pede clareza para ID, operação ou dado não autorizado: %o", ({ patch, texto }) => {
    const c = cadastro(servico("area", "cabelos"));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, patch)], texto);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it("aplica a correção clara sem importar uma categoria não ensinada", () => {
    const c = cadastro(servico("area", "cabelos"));
    const r = aplicarSemanticaDosServicos(c, [especificar("o serviço é prancha", { categoria: "estética" })], "o serviço é prancha");
    expect(r.rascunho.informacoes.servicos[0].nome).toBe("prancha");
    expect(r.rascunho.informacoes.servicos[0].descricao).not.toContain("estética");
    expect(r.esclarecimento).toBeUndefined();
  });

  it.each([
    ["não oferecemos prancha", "oferecemos prancha"],
    ["se tivéssemos prancha seria diferente", "prancha"],
    ["o serviço é prancha?", "o serviço é prancha"],
    ["o cliente disse que o serviço é prancha", "o serviço é prancha"],
    ["Joana disse que o serviço é prancha", "o serviço é prancha"],
    ["Não mude o serviço. O serviço é prancha", "o serviço é prancha"],
    ["nn quero alterar nada agora. O serviço é prancha", "o serviço é prancha"],
    ["o serviço é escova", "o serviço é prancha"],
  ])("não promove pergunta, negação, hipótese, terceiro ou evidência inventada: %s", (texto, evidencia) => {
    const c = cadastro(servico("area", "cabelos"));
    const r = aplicarSemanticaDosServicos(c, [especificar(evidencia)], texto);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
  });

  it("vincula uma condição de preço ao serviço e conserva a duração", () => {
    const texto = "depende do tamanho";
    const c = cadastro(servico("area", "prancha", { precoCents: 8000, duracaoMin: 30, descricao: "Somente com hora marcada." }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { operacao: "ATUALIZAR", condicaoPreco: texto })], texto);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "area", nome: "prancha", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: 30, descricao: "Somente com hora marcada.\nCondição de preço: depende do tamanho." });
    expect(r.esclarecimento).toBeUndefined();
  });

  it("não usa uma condição que só existia no histórico ou foi negada", () => {
    const c = cadastro(servico("area", "prancha", { precoCents: 8000 }));
    for (const texto of ["não depende do tamanho", "a duração é outra"]) {
      const r = aplicarSemanticaDosServicos(c, [especificar(texto, { operacao: "ATUALIZAR", condicaoPreco: "depende do tamanho" })], texto);
      expect(r.rascunho).toEqual(c);
      expect(r.alteracoes).toEqual([]);
    }
  });

  it("atualiza a regra sem duplicar metadados nem apagar a descrição livre", () => {
    const c = cadastro(servico("area", "prancha", { descricao: "Atendemos com reserva.\nCondição de preço: depende do volume.", precoModo: "SOB_CONSULTA" }));
    const texto = "depende do comprimento";
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { operacao: "ATUALIZAR", condicaoPreco: texto })], texto);
    expect(r.rascunho.informacoes.servicos[0].descricao).toBe("Atendemos com reserva.\nCondição de preço: depende do comprimento.");
  });

  it("mescla a categoria provisória com o serviço concreto já existente", () => {
    const texto = "cabelos é a área e o serviço é prancha";
    const c = cadastro(servico("area", "cabelos"), servico("real", "prancha", { precoCents: 15000, duracaoMin: 45, descricao: "Com reserva." }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { categoria: "cabelos" })], texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "real", nome: "prancha", precoCents: 15000, duracaoMin: 45 });
    expect(r.rascunho.informacoes.servicos[0].descricao).toContain("Com reserva.");
    expect(r.remapeamentosIds).toEqual({ area: "real" });
  });

  it("uma atualização posterior ao ID mesclado não restaura o nome antigo da categoria", () => {
    const texto = "cabelos é a área e o serviço é prancha. depende do tamanho";
    const c = cadastro(servico("area", "cabelos"), servico("real", "prancha", { duracaoMin: 45 }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { categoria: "cabelos" }), especificar("depende do tamanho", { nome: "cabelos", operacao: "ATUALIZAR", condicaoPreco: "depende do tamanho" })], texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "real", nome: "prancha", precoModo: "SOB_CONSULTA", duracaoMin: 45 });
    expect(r.remapeamentosIds).toEqual({ area: "real" });
  });

  it("preserva o ID concreto quando a duplicata de mesmo nome é que era provisória", () => {
    const texto = "o serviço é prancha";
    const c = cadastro(servico("area", "cabelos", { precoCents: 15000, duracaoMin: 45 }), servico("duplicata", "prancha"));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto)], texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "area", nome: "prancha", precoCents: 15000, duracaoMin: 45 });
    expect(r.remapeamentosIds).toEqual({ duplicata: "area" });
  });

  it("não apaga dois serviços com dados próprios quando o nome colide", () => {
    const texto = "o serviço é prancha";
    const c = cadastro(servico("area", "cabelos", { precoCents: 8000, duracaoMin: 30 }), servico("real", "prancha", { precoCents: 12000, duracaoMin: 45 }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto)], texto);
    expect(r.rascunho).toEqual(c);
    expect(r.remapeamentosIds).toEqual({});
    expect(r.esclarecimento?.texto).toContain("outras informações");
  });

  it("não resolve uma colisão com regras de preço contraditórias por suposição", () => {
    const texto = "o serviço é prancha";
    const c = cadastro(servico("area", "cabelos", { descricao: "Condição de preço: depende do tamanho." }), servico("real", "prancha", { descricao: "Condição de preço: depende do produto." }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto)], texto);
    expect(r.rascunho).toEqual(c);
    expect(r.esclarecimento).toBeDefined();
  });

  it("cria apenas um alvo explícito para categoria/condição, sem aproveitar números propostos", () => {
    const texto = "prancha é um serviço de cabelos e depende do tamanho";
    const item = { nome: "prancha", evidencia: texto, operacao: "CRIAR" as const, servicoId: null, categoria: "cabelos", condicaoPreco: "depende do tamanho", precoCents: 99999, duracaoMin: 90 };
    const c = cadastro();
    const r = aplicarSemanticaDosServicos(c, [item], texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "prancha", precoCents: null, duracaoMin: null, precoModo: "SOB_CONSULTA" });
    expect(r.rascunho.informacoes.servicos[0].id).toMatch(/^novo:/);
  });

  it("deixa uma criação comum e os itens legados para o motor existente", () => {
    const c = cadastro();
    for (const item of [{ nome: "prancha", evidencia: "oferecemos prancha" }, { nome: "prancha", evidencia: "oferecemos prancha", operacao: "CRIAR" as const }]) {
      const r = aplicarSemanticaDosServicos(c, [item], "oferecemos prancha");
      expect(r.rascunho).toEqual(c);
      expect(r.alteracoes).toEqual([]);
    }
  });

  it("aceita somente a proposição fechada explicitamente aprovada passada pelo chamador", () => {
    const proposta = "o serviço é prancha e o preço depende do tamanho";
    const c = cadastro(servico("area", "cabelos"));
    const item = especificar(proposta, { condicaoPreco: "depende do tamanho" });
    expect(aplicarSemanticaDosServicos(c, [item], "sim").rascunho).toEqual(c);
    const r = aplicarSemanticaDosServicos(c, [item], "sim", { propostaConfirmada: proposta });
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "area", nome: "prancha", precoModo: "SOB_CONSULTA" });
  });

  it("não aplica metade de uma correção quando a descrição não cabe", () => {
    const texto = "cabelos é a área e o serviço é prancha";
    const c = cadastro(servico("area", "cabelos", { descricao: "x".repeat(1500) }));
    const r = aplicarSemanticaDosServicos(c, [especificar(texto, { categoria: "cabelos" })], texto);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.esclarecimento).toBeDefined();
  });
});
