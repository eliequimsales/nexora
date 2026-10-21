import { describe, expect, it } from "vitest";
import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { centavosInformados, proporPreenchimento } from "@/lib/atendente/preenchimento";

const vazio = (): ConfiguracaoNexa => ({
  negocio: { nome: "Negócio", segmento: "", modalidade: "PRESENCIAL", objetivo: "DUVIDAS", regiao: info(), descricao: info() },
  informacoes: { endereco: info(), pagamento: info(), horarios: [], horariosSituacao: "NAO_INFORMADO", diasFechados: [], servicos: [] },
  atendimento: { nome: "Nexa", jeito: "ACOLHEDOR", quando: "FORA_EXPEDIENTE", agendamento: "DESLIGADO", handoffKeywords: [] },
  conhecimento: { itens: [] },
});
const info = () => ({ valor: "", origem: "MANUAL" as const, situacao: "NAO_INFORMADO" as const });

describe("preenchimento assistido propõe dados para revisão sem inventar", () => {
  it("interpreta centavos brasileiros sem arredondar ou supor separador", () => {
    expect(centavosInformados("1.250,50")).toBe(125050);
    expect(centavosInformados("45,5")).toBe(4550);
    expect(centavosInformados("50")).toBe(5000);
    expect(centavosInformados("50.25")).toBeNull();
    expect(centavosInformados("-50")).toBeNull();
  });
  it("não assume duração para serviço com preço", () => {
    const atual = vazio();
    const r = proporPreenchimento(atual, "Corte R$ 50,00", () => "novo-1");
    expect(r.rascunho.informacoes.servicos).toEqual([{ id: "novo-1", nome: "Corte", descricao: "", precoCents: 5000, precoModo: "FIXO", duracaoMin: null, situacao: "REVISAR", origem: "ASSISTENTE" }]);
    expect(r.mensagem).toContain("ficou em branco");
    expect(atual.informacoes.servicos).toEqual([]);
  });
  it("extrai duração somente quando ela está informada no mesmo serviço", () => {
    const r = proporPreenchimento(vazio(), "Corte R$ 50 — 40 minutos e Barba R$ 35", () => "novo-1");
    expect(r.rascunho.informacoes.servicos.map((s) => [s.nome, s.precoCents, s.duracaoMin])).toEqual([["Corte", 5000, 40], ["Barba", 3500, null]]);
  });
  it("preserva nome composto do serviço", () => {
    const r = proporPreenchimento(vazio(), "Corte e Barba R$ 80 — 1 hora", () => "novo-1");
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "Corte e Barba", duracaoMin: 60 });
  });
  it("mantém preço sob consulta sem transformar em zero", () => {
    const r = proporPreenchimento(vazio(), "Consultoria: preço sob consulta", () => "novo-1");
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome: "Consultoria", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null });
  });
  it("preserva a negação inteira nas formas de pagamento", () => {
    const r = proporPreenchimento(vazio(), "Não aceito Pix, mas aceito cartão");
    expect(r.rascunho.informacoes.pagamento).toEqual({ valor: "Não aceito Pix, mas aceito cartão", situacao: "REVISAR", origem: "ASSISTENTE" });
    expect(r.rascunho.conhecimento.itens).toEqual([]);
  });
  it("não extrai serviço negado ou com valor variável", () => {
    for (const frase of ["Não oferecemos Corte R$ 50", "Corte a partir de R$ 50", "Exemplo Corte R$ 50", "Corte R$ 50 com desconto"]) {
      expect(proporPreenchimento(vazio(), frase).rascunho.informacoes.servicos, frase).toEqual([]);
    }
  });
  it("não grava pergunta de ajuda, saudação ou texto solto como política", () => {
    for (const frase of ["oi", "Como eu cadastro um serviço?", "Vocês aceitam Pix?", "Me ajuda a configurar", "Eu preciso de ajuda com preços", "Tolerância de 15 minutos"]) {
      const r = proporPreenchimento(vazio(), frase);
      expect(r.alterou, frase).toBe(false);
      expect(r.rascunho.conhecimento.itens, frase).toEqual([]);
    }
  });
  it("FAQ precisa de instrução explícita de pergunta e resposta", () => {
    const r = proporPreenchimento(vazio(), "Quando perguntarem sobre estacionamento, responda Não temos estacionamento próprio.", () => "novo-1");
    expect(r.rascunho.conhecimento.itens).toEqual([{ id: "novo-1", pergunta: "estacionamento", resposta: "Não temos estacionamento próprio.", situacao: "REVISAR", origem: "ASSISTENTE" }]);
  });
  it("horário sem dia explícito não preenche semana automaticamente", () => {
    const r = proporPreenchimento(vazio(), "Das 9h às 18h");
    expect(r.rascunho.informacoes.horarios).toEqual([]);
    expect(r.mensagem).toContain("dias");
  });
  it("registra somente os dias informados sem inferir fechamento dos demais", () => {
    const r = proporPreenchimento(vazio(), "Seg a sex das 9h às 18h");
    expect(r.rascunho.informacoes.horarios.map((h) => h.day)).toEqual([1, 2, 3, 4, 5]);
    expect(r.rascunho.informacoes.horarios.every((h) => !h.closed && h.open === "09:00" && h.close === "18:00")).toBe(true);
    expect(r.rascunho.informacoes.horariosSituacao).toBe("REVISAR");
  });
  it("não interpreta exceção de dia ou dois intervalos como expediente simples", () => {
    for (const frase of ["Não abrimos seg a sex das 9h às 18h", "Seg a sex das 9h às 12h e das 14h às 18h", "Seg a sex das 9h às 18h, exceto quarta"]) {
      expect(proporPreenchimento(vazio(), frase).rascunho.informacoes.horarios).toEqual([]);
    }
  });
  it("não interpreta parte decimal de uma duração como horas inteiras", () => {
    const r = proporPreenchimento(vazio(), "Massagem R$ 90 — 1,5 horas");
    expect(r.rascunho.informacoes.servicos[0].duracaoMin).toBeNull();
  });
  it("não transforma atendimento online em endereço inventado", () => {
    const r = proporPreenchimento(vazio(), "Atendimento 100% online");
    expect(r.rascunho.informacoes.endereco.valor).toBe("");
  });
  it("atualiza somente rascunho do serviço existente e preserva demais dados", () => {
    const atual = vazio();
    atual.informacoes.servicos = [{ id: "real-1", nome: "Corte", descricao: "Descrição revisada", precoModo: "FIXO", precoCents: 4500, duracaoMin: 30, origem: "CADASTRO", situacao: "CONFIRMADO" }];
    atual.informacoes.endereco = { valor: "Rua Real, 5", origem: "CADASTRO", situacao: "CONFIRMADO" };
    const r = proporPreenchimento(atual, "Corte R$ 60");
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "real-1", precoCents: 6000, descricao: "Descrição revisada", situacao: "REVISAR", duracaoMin: 30 });
    expect(atual.informacoes.servicos[0].precoCents).toBe(4500);
    expect(r.rascunho.informacoes.endereco).toEqual(atual.informacoes.endereco);
  });
});
