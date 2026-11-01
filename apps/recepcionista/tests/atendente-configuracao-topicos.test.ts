import { describe, expect, it } from "vitest";
import { campoPertenceAoTopico, resumirTopicosConfiguracao, topicoDaChave } from "@/lib/atendente/configuracao-topicos";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

describe("tópicos da configuração", () => {
  it.each([
    ["negocio.nome", "EMPRESA"],
    ["negocio.segmento", "EMPRESA"],
    ["negocio.descricao:revisar", "EMPRESA"],
    ["negocio.modalidade", "FUNCIONAMENTO"],
    ["esclarecimento:negocio.modalidade", "FUNCIONAMENTO"],
    ["negocio.regiao:revisar", "FUNCIONAMENTO"],
    ["atendimento.objetivo", "ATENDIMENTO"],
    ["esclarecimento:atendimento.objetivo", "ATENDIMENTO"],
    ["negocio.objetivo", "ATENDIMENTO"],
  ])("encaminha %s para o assunto %s", (campo, topico) => {
    expect(topicoDaChave(campo)).toBe(topico);
  });
  it("separa o preço de um serviço dos horários e do endereço", () => {
    expect(campoPertenceAoTopico("esclarecimento:servico:novo:1:preco", "SERVICOS")).toBe(true);
    expect(campoPertenceAoTopico("informacoes.horarios", "SERVICOS")).toBe(false);
    expect(topicoDaChave("informacoes.endereco")).toBe("FUNCIONAMENTO");
    expect(topicoDaChave("atendimento.gestaoReservas")).toBe("ATENDIMENTO");
  });
  it("uma pendência de serviço não transforma os outros tópicos em incompletos", () => {
    const c = configuracaoExemplo();
    const topicos = resumirTopicosConfiguracao(c, [{ campo: "servico:servico1:preco", mensagem: "Informe o preço", etapa: 1, bloqueia: true }]);
    expect(topicos.find(t => t.id === "SERVICOS")).toMatchObject({ estado: "PENDENTE", pendencias: 1 });
    expect(topicos.find(t => t.id === "EMPRESA")?.estado).toBe("PREENCHIDO");
  });
  it("não chama um serviço de preenchido quando ainda precisa de revisão", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].situacao = "REVISAR";
    expect(resumirTopicosConfiguracao(c, []).find(t => t.id === "SERVICOS")?.estado).toBe("REVISAR");
  });
  it("calcula os itens a partir do rascunho atual, sem número fixo de progresso", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos = [];
    expect(resumirTopicosConfiguracao(c, []).find(t => t.id === "SERVICOS")).toMatchObject({ estado: "PENDENTE", resumo: "Adicione o que seus clientes procuram" });
  });
  it("respeita a decisão explícita de não ter regras adicionais", () => {
    const c = configuracaoExemplo(); c.conhecimento.itens = [];
    expect(resumirTopicosConfiguracao(c, [], ["conhecimento"]).find(t => t.id === "REGRAS")).toMatchObject({ estado: "PREENCHIDO", resumo: "Sem regras adicionais por enquanto" });
  });
  it("uma região em revisão aparece em horários e local, sem reabrir sua empresa", () => {
    const c = configuracaoExemplo(); c.negocio.regiao = { valor: "Centro", situacao: "REVISAR", origem: "MANUAL" };
    const topicos = resumirTopicosConfiguracao(c, []);
    expect(topicos.find(t => t.id === "FUNCIONAMENTO")?.estado).toBe("REVISAR");
    expect(topicos.find(t => t.id === "EMPRESA")?.estado).toBe("PREENCHIDO");
  });
  it("pendências de local e de objetivo contam somente no assunto correspondente", () => {
    const c = configuracaoExemplo();
    const topicos = resumirTopicosConfiguracao(c, [
      { campo: "negocio.regiao", mensagem: "Informe a região", etapa: 1, bloqueia: true },
      { campo: "atendimento.objetivo", mensagem: "Escolha como atender", etapa: 2, bloqueia: true },
    ]);
    expect(topicos.find(t => t.id === "EMPRESA")).toMatchObject({ estado: "PREENCHIDO", pendencias: 0 });
    expect(topicos.find(t => t.id === "FUNCIONAMENTO")).toMatchObject({ estado: "PENDENTE", pendencias: 1 });
    expect(topicos.find(t => t.id === "ATENDIMENTO")).toMatchObject({ estado: "PENDENTE", pendencias: 1 });
  });
});
