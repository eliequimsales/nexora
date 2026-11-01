import { describe, expect, it } from "vitest";
import { preencherPorConversa } from "@/lib/atendente/conversa-motor";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

function extracao(patch: Record<string, unknown>) {
  return { nome: null, segmento: null, descricao: null, endereco: null, regiao: null, pagamento: null, nomeAtendente: null, modalidade: null, objetivo: null, jeito: null, quando: null, agendamento: null, servicos: [], perguntas: [], ...patch };
}
function aplicar(texto: string, patch: Record<string, unknown> = {}, vazio = false) {
  const c = configuracaoExemplo();
  c.atendimento.quando = "FORA_EXPEDIENTE";
  if (vazio) { c.informacoes.servicos = []; c.negocio.descricao = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" }; }
  let id = 0;
  return preencherPorConversa(c, texto, { ignoradas: [] }, extracao(patch), () => `novo:auditoria${++id}`);
}
function servico(nome: string, evidencia: string, precoCents: number | null) {
  return { nome, evidencia, precoCents, duracaoMin: null, sobConsulta: false, descricao: null };
}

describe("auditoria adversarial da configuração por conversa", () => {
  it("e meia faz parte da duração, sem criar um serviço chamado meia", () => {
    const texto = "Massagem relaxante de uma hora e meia por R$150.";
    const r = aplicar(texto, { servicos: [{ ...servico("Massagem relaxante", texto, 15000), duracaoMin: 90 }] }, true);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "Massagem relaxante", duracaoMin: 90, precoCents: 15000 });
  });
  it("não cria serviço que o responsável explicitamente disse que não oferece", () => {
    const texto = "Não oferecemos massagem relaxante";
    const r = aplicar(texto, { servicos: [servico("massagem relaxante", texto, null)] });
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["Revisão"]);
  });
  it("um preço negado não substitui o preço vigente, mesmo que o modelo o extraia", () => {
    const texto = "Revisão não custa R$150";
    const r = aplicar(texto, { servicos: [servico("Revisão", texto, 15000)] });
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBe(9900);
  });
  it("não permite que substring literal remova a negação da forma de pagamento", () => {
    const texto = "Não aceitamos Pix";
    const r = aplicar(texto, { pagamento: { valor: "aceitamos Pix", evidencia: texto } });
    expect(r.rascunho.informacoes.pagamento.valor).toContain("Não aceitamos Pix");
    expect(r.rascunho.informacoes.pagamento.valor).not.toBe("aceitamos Pix");
  });
  it("parcela de R$50 não vira preço integral do serviço", () => {
    const texto = "Massagem relaxante em 3x de R$50";
    const r = aplicar(texto, { servicos: [servico("Massagem relaxante", texto, 5000)] }, true);
    expect(r.rascunho.informacoes.servicos.some(s => s.precoCents === 5000)).toBe(false);
  });
  it("negação sobre expediente não autoriza responder durante ele", () => {
    const texto = "Não atenda durante o expediente";
    const r = aplicar(texto, { quando: { valor: "APOIO_EXPEDIENTE", evidencia: texto } });
    expect(r.rascunho.atendimento.quando).toBe("FORA_EXPEDIENTE");
  });
  it("uma resposta extraída não pode remover negação e exceção de uma regra", () => {
    const texto = "Não temos estacionamento próprio, exceto uma vaga reservada para cadeirantes.";
    const r = aplicar(texto, { perguntas: [{ pergunta: "Tem estacionamento?", resposta: "temos estacionamento próprio", evidencia: texto }] });
    expect(r.rascunho.conhecimento.itens.find(i => i.pergunta === "Tem estacionamento?")?.resposta).not.toBe("temos estacionamento próprio");
  });
  it("um nome composto com um único preço não transforma combo em serviço isolado", () => {
    const texto = "Corte e barba por R$80";
    const r = aplicar(texto, { servicos: [servico("Corte e barba", texto, 8000)] }, true);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "Corte e barba", precoCents: 8000 });
  });
  it("relato de preço dito por um cliente não substitui a política da empresa", () => {
    const texto = "O cliente disse que Revisão custa R$150";
    const r = aplicar(texto, { servicos: [servico("Revisão", texto, 15000)] });
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "Revisão", precoCents: 9900 });
    expect(r.alteracoes).toEqual([]);
  });
});
