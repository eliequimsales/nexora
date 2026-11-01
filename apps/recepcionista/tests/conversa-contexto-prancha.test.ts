import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { prepararTurnoDeConfiguracao, perguntaAtual } from "@/lib/atendente/conversa";
import { lerEnvelopeConfiguracao, type EnvelopeConfiguracaoNexa } from "@/lib/atendente/configuracao";
import type { ConfiguracaoNexa, ServicoNexa } from "@/lib/atendente/configuracao-schema";
import type { EstadoConversaConfiguracao, MensagemDeConfiguracao, PerguntaDeConfiguracao } from "@/lib/atendente/conversa-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

const CORRECAO = "cabelos so q o serviço q eu estou falando e a prancha";
const CONDICAO = "depende do tamanho";
const FIM = "so esses";
const instante = "2026-10-29T12:00:00.000Z";

function servico(id: string, nome: string, precoCents: number | null = null): ServicoNexa {
  return { id, nome, descricao: "", precoModo: "FIXO", precoCents, duracaoMin: null, situacao: "CONFIRMADO", origem: "ASSISTENTE" };
}

function cadastro(servicos = [servico("s-cabelos", "cabelos"), servico("s-pedicure", "pedicure", 4000)]): ConfiguracaoNexa {
  const c = configuracaoExemplo();
  c.negocio.nome = "Espaço Exemplo";
  c.negocio.segmento = "Estética";
  c.negocio.descricao.valor = "Serviços de cabelo e unhas.";
  c.informacoes.servicos = servicos;
  return c;
}

function historico(falas: Array<["dono" | "atendente", string]>): MensagemDeConfiguracao[] {
  return falas.map(([de, texto], i) => ({ id: `h${i}`, de, texto, em: instante, topico: "SERVICOS" }));
}

function estado(pergunta: PerguntaDeConfiguracao, falas: Array<["dono" | "atendente", string]>, foco: string | null = null): EstadoConversaConfiguracao {
  return { mensagens: historico(falas), ignoradas: [], ultimaPergunta: pergunta.chave,
    perguntaPendente: pergunta, perguntaSuspensa: false, topicoAtual: "SERVICOS",
    memoriaSemantica: { servicoEmFocoId: foco, categorias: ["cabelos"], listaServicosConcluida: false } };
}

function contrato(patch: Record<string, unknown>) {
  return JSON.stringify({ nome: null, segmento: null, descricao: null, endereco: null, regiao: null,
    pagamento: null, nomeAtendente: null, modalidade: null, objetivo: null, jeito: null, quando: null,
    agendamento: null, horarios: [], servicos: [], perguntas: [], esclarecimento: null, continuacao: null,
    conducao: null, dialogo: { intencao: "INFORMAR", resposta: null, fontesIds: [] }, ...patch });
}

function extrairServico(nome: string, evidencia: string, patch: Record<string, unknown> = {}) {
  return { nome, evidencia, precoCents: null, duracaoMin: null, sobConsulta: false, descricao: null,
    operacao: null, servicoId: null, categoria: null, condicaoPreco: null, ...patch };
}

async function turno(c: ConfiguracaoNexa, e: EstadoConversaConfiguracao, texto: string, patch: Record<string, unknown>, numero = 1) {
  const interpretar = vi.fn().mockResolvedValue(contrato(patch));
  const r = await prepararTurnoDeConfiguracao(c, e, {
    revisao: numero, mensagemId: `00000000-0000-4000-8000-${String(numero).padStart(12, "0")}`, texto,
    perguntaChave: perguntaAtual(c, e, "SERVICOS")?.chave ?? null, topico: "SERVICOS",
  }, { interpretar, iaDisponivel: () => true, agora: () => new Date(instante) });
  expect(interpretar).toHaveBeenCalledTimes(1);
  return { ...r, interpretar };
}

describe("contexto da conversa sobre categoria, serviço e condição de preço", () => {
  it("a correção informal substitui o rótulo amplo pelo serviço real sem apagar outro serviço", async () => {
    const c = cadastro();
    const pedicure = structuredClone(c.informacoes.servicos[1]);
    const e = estado({ chave: "servico:s-cabelos:preco", texto: "Qual é o valor de cabelos?", sugestoes: [] }, [
      ["dono", "trabalho com cabelos e unhas, nas unhas faço pedicure"],
      ["atendente", "Qual é o valor de cabelos?"],
    ], "s-cabelos");
    const r = await turno(c, e, CORRECAO, {
      servicos: [extrairServico("prancha", CORRECAO, { operacao: "ESPECIFICAR", servicoId: "s-cabelos", categoria: "cabelos" })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-cabelos", evidencia: CORRECAO },
      dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] },
    });
    expect(r.rascunho.informacoes.servicos.map(s => s.nome).sort()).toEqual(["pedicure", "prancha"]);
    expect(r.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
    const prancha = r.rascunho.informacoes.servicos.find(s => s.nome === "prancha")!;
    expect(r.conversa.memoriaSemantica?.servicoEmFocoId).toBe(prancha.id);
    expect(r.conversa.memoriaSemantica?.categorias).toContain("cabelos");
    const proxima = perguntaAtual(r.rascunho, r.conversa, "SERVICOS");
    expect(proxima?.texto.toLowerCase()).not.toContain("valor de cabelos");
  });

  it("uma correção não deixa o rótulo amplo duplicado se o serviço real já foi criado", async () => {
    const c = cadastro([servico("s-cabelos", "cabelos"), servico("s-prancha", "prancha", 9000), servico("s-pedicure", "pedicure", 4000)]);
    const pedicure = structuredClone(c.informacoes.servicos[2]);
    const e = estado({ chave: "servico:s-cabelos:preco", texto: "Qual é o valor de cabelos?", sugestoes: [] }, [
      ["dono", "cabelos e unhas"], ["atendente", "Quais serviços de cabelo?"],
      ["dono", "prancha"], ["atendente", "Qual é o valor de cabelos?"],
    ], "s-cabelos");
    const r = await turno(c, e, CORRECAO, {
      servicos: [extrairServico("prancha", CORRECAO, { operacao: "ESPECIFICAR", servicoId: "s-cabelos", categoria: "cabelos" })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-cabelos", evidencia: CORRECAO },
      dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] },
    });
    expect(r.rascunho.informacoes.servicos.filter(s => s.nome === "prancha")).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos.some(s => s.nome === "cabelos")).toBe(false);
    expect(r.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
    const prancha = r.rascunho.informacoes.servicos.find(s => s.nome === "prancha")!;
    expect(prancha.precoCents).toBe(9000);
    expect(r.conversa.memoriaSemantica?.servicoEmFocoId).toBe(prancha.id);
  });

  it("a condição curta do preço pertence à prancha e não cria um preço fixo ou outro serviço", async () => {
    const c = cadastro([servico("s-prancha", "prancha"), servico("s-pedicure", "pedicure", 4000)]);
    const pedicure = structuredClone(c.informacoes.servicos[1]);
    const e = estado({ chave: "servico:s-prancha:preco", texto: "Qual é o valor da prancha?", sugestoes: [] }, [
      ["dono", "trabalho com cabelos e unhas"], ["atendente", "Quais serviços?"],
      ["dono", CORRECAO], ["atendente", "Entendi, o serviço é prancha. Qual é o valor da prancha?"],
    ], "s-prancha");
    const r = await turno(c, e, CONDICAO, {
      servicos: [extrairServico("prancha", CONDICAO, { operacao: "ATUALIZAR", servicoId: "s-prancha", sobConsulta: true, condicaoPreco: CONDICAO })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-prancha", evidencia: CONDICAO },
      continuacao: { campo: "servico:s-prancha:preco", pergunta: "Como o tamanho muda o preço da prancha?", sugestoes: [] },
    });
    const prancha = r.rascunho.informacoes.servicos.find(s => s.id === "s-prancha")!;
    expect(prancha.precoCents).toBeNull();
    expect(prancha.precoModo).toBe("SOB_CONSULTA");
    expect(JSON.stringify(prancha)).toContain(CONDICAO);
    expect(r.rascunho.informacoes.servicos).toHaveLength(2);
    expect(r.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
    expect(r.conversa.memoriaSemantica?.servicoEmFocoId).toBe(prancha.id);
    expect(r.conversa.mensagens.at(-1)?.texto).toContain("Como o tamanho muda o preço da prancha?");
    expect(perguntaAtual(r.rascunho, r.conversa, "SERVICOS")?.chave).toBe("servico:s-prancha:condicaoPreco");
  });

  it("uma duração com descrição livre não apaga a categoria e a condição aprendidas antes", async () => {
    const c = cadastro([servico("s-prancha", "prancha"), servico("s-pedicure", "pedicure", 4000)]);
    c.informacoes.servicos[0].descricao = "Categoria: cabelos.\nCondição de preço: depende do tamanho.";
    c.informacoes.servicos[0].precoModo = "SOB_CONSULTA";
    const pedicure = structuredClone(c.informacoes.servicos[1]);
    const e = estado({ chave: "servico:s-prancha:duracao", texto: "Quanto tempo dura a prancha?", sugestoes: [] }, [
      ["dono", CORRECAO], ["atendente", "Qual é o valor da prancha?"],
      ["dono", CONDICAO], ["atendente", "Quanto tempo dura a prancha?"],
    ], "s-prancha");
    const texto = "a prancha dura 45 minutos";
    const r = await turno(c, e, texto, {
      servicos: [extrairServico("prancha", texto, { operacao: "ATUALIZAR", servicoId: "s-prancha",
        duracaoMin: 45, descricao: "dura 45 minutos", categoria: null, condicaoPreco: null })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-prancha", evidencia: texto },
    });
    const prancha = r.rascunho.informacoes.servicos.find(s => s.id === "s-prancha")!;
    expect(prancha).toMatchObject({ duracaoMin: 45, precoModo: "SOB_CONSULTA", precoCents: null });
    expect(prancha.descricao).toContain("dura 45 minutos");
    expect(prancha.descricao).toContain("Categoria: cabelos.");
    expect(prancha.descricao).toContain("Condição de preço: depende do tamanho.");
    expect(r.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
  });

  it.each([FIM, "por enquanto fico com esses"])("encerrar a lista conserva as lacunas do serviço: %s", async texto => {
    const c = cadastro([servico("s-prancha", "prancha"), servico("s-pedicure", "pedicure", 4000)]);
    const e = estado({ chave: "informacoes.servicos", texto: "Quais outros serviços você quer incluir na lista?", sugestoes: [] }, [
      ["dono", CORRECAO], ["atendente", "Qual é o valor da prancha?"],
      ["dono", CONDICAO], ["atendente", "Quais outros serviços você quer incluir na lista?"],
    ], "s-prancha");
    const r = await turno(c, e, texto, {
      conducao: { listaServicos: "CONCLUIDA", servicoEmFocoId: "s-prancha", evidencia: texto },
      dialogo: { intencao: "INFORMAR", resposta: "Certo, vamos seguir com os serviços que você informou.", fontesIds: [] },
      continuacao: { campo: "servico:s-prancha:preco", pergunta: "Como funciona o preço da prancha?", sugestoes: [] },
    });
    expect(r.rascunho).toEqual(c);
    expect(r.conversa.memoriaSemantica?.listaServicosConcluida).toBe(true);
    expect(r.conversa.ignoradas).not.toContain("servico:s-prancha:preco");
    expect(r.conversa.ignoradas).not.toContain("servico:s-prancha:duracao");
    expect(r.conversa.perguntaPendente?.chave).not.toBe("esclarecimento:informacoes.servicos");
    expect(perguntaAtual(r.rascunho, r.conversa, "SERVICOS")?.chave).not.toBe("informacoes.servicos");
    expect(perguntaAtual(r.rascunho, r.conversa, "SERVICOS")?.chave).toMatch(/^servico:s-prancha:(?:preco|duracao)$/);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ precoCents: null, duracaoMin: null });
    expect(r.conversa.mensagens.at(-1)?.texto).not.toContain("Quais serviços vocês fazem nessa área?");
  });

  it("ignora dados antigos repetidos pela IA ao encerrar a lista, sem fingir uma alteração", async () => {
    const c = cadastro([servico("s-prancha", "prancha"), servico("s-pedicure", "pedicure", 4000)]);
    c.informacoes.servicos[0].precoModo = "SOB_CONSULTA";
    c.informacoes.servicos[0].descricao = "Condição de preço: depende do tamanho.";
    const e = estado({ chave: "servico:s-prancha:duracao", texto: "Quanto tempo dura a prancha?", sugestoes: [] }, [
      ["dono", CONDICAO], ["atendente", "Quanto tempo dura a prancha?"],
    ], "s-prancha");
    const r = await turno(c, e, FIM, {
      servicos: [extrairServico("prancha", CONDICAO, { operacao: "ATUALIZAR", servicoId: "s-prancha", condicaoPreco: CONDICAO })],
      perguntas: [{ pergunta: "Quais serviços vocês oferecem?", resposta: "Prancha e pedicure", evidencia: FIM }],
      quando: { valor: c.atendimento.quando, evidencia: FIM },
      conducao: { listaServicos: "CONCLUIDA", servicoEmFocoId: "s-prancha", evidencia: FIM },
    });
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.conversa.memoriaSemantica?.listaServicosConcluida).toBe(true);
    expect(r.conversa.perguntaPendente?.chave).not.toBe("esclarecimento:informacoes.servicos");
    expect(r.conversa.mensagens.at(-1)?.texto).not.toMatch(/Atualizei|Anotei|confirmar qual/);
  });

  it("aceita o tempo dito por referência sem exigir repetir a condição de preço já conhecida", async () => {
    const c = cadastro([servico("s-prancha", "prancha"), servico("s-pedicure", "pedicure", 4000)]);
    c.informacoes.servicos[0].precoModo = "SOB_CONSULTA";
    c.informacoes.servicos[0].descricao = "Condição de preço: depende do tamanho.";
    const e = estado({ chave: "servico:s-prancha:duracao", texto: "Quanto tempo dura a prancha?", sugestoes: [] }, [
      ["dono", CONDICAO], ["atendente", "Quanto tempo dura a prancha?"],
    ], "s-prancha");
    e.ignoradas.push("informacoes.servicos");
    const fala = "esse aí demora 40 min pra fazer";
    const r = await turno(c, e, fala, {
      servicos: [extrairServico("prancha", fala, { operacao: "ATUALIZAR", servicoId: "s-prancha", duracaoMin: 40, sobConsulta: true, condicaoPreco: CONDICAO, descricao: c.informacoes.servicos[0].descricao })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-prancha", evidencia: fala },
    });
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ duracaoMin: 40, precoModo: "SOB_CONSULTA", precoCents: null, descricao: c.informacoes.servicos[0].descricao });
    expect(r.rascunho.informacoes.servicos[1]).toEqual(c.informacoes.servicos[1]);
    expect(r.conversa.perguntaPendente?.chave).not.toBe("esclarecimento:informacoes.servicos");
  });

  it("conduz a sequência inteira mantendo a correção, o preço condicional e o fim da lista", async () => {
    const c = cadastro();
    const pedicure = structuredClone(c.informacoes.servicos[1]);
    const e = estado({ chave: "servico:s-cabelos:preco", texto: "Qual é o valor de cabelos?", sugestoes: [] }, [
      ["dono", "trabalho com cabelos e unhas, nas unhas faço pedicure"],
      ["atendente", "Qual é o valor de cabelos?"],
    ], "s-cabelos");
    const correcao = await turno(c, e, CORRECAO, {
      servicos: [extrairServico("prancha", CORRECAO, { operacao: "ESPECIFICAR", servicoId: "s-cabelos", categoria: "cabelos" })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-cabelos", evidencia: CORRECAO },
      dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] },
      continuacao: { campo: "servico:s-cabelos:preco", pergunta: "Qual é o valor da prancha?", sugestoes: [] },
    }, 1);
    const prancha = correcao.rascunho.informacoes.servicos.find(s => s.nome === "prancha")!;
    expect(correcao.rascunho.informacoes.servicos.some(s => s.nome === "cabelos")).toBe(false);

    const condicao = await turno(correcao.rascunho, correcao.conversa, CONDICAO, {
      servicos: [extrairServico("prancha", CONDICAO, { operacao: "ATUALIZAR", servicoId: prancha.id, sobConsulta: true, condicaoPreco: CONDICAO })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: prancha.id, evidencia: CONDICAO },
      continuacao: { campo: "informacoes.servicos", pergunta: "Quais outros serviços você quer incluir na lista?", sugestoes: [] },
    }, 2);
    expect(condicao.rascunho.informacoes.servicos.find(s => s.id === prancha.id)).toMatchObject({ precoModo: "SOB_CONSULTA", precoCents: null });
    expect(JSON.stringify(condicao.rascunho.informacoes.servicos.find(s => s.id === prancha.id))).toContain(CONDICAO);

    const fim = await turno(condicao.rascunho, condicao.conversa, FIM, {
      conducao: { listaServicos: "CONCLUIDA", servicoEmFocoId: prancha.id, evidencia: FIM },
      continuacao: { campo: `servico:${prancha.id}:duracao`, pergunta: "Quanto tempo demora a prancha?", sugestoes: [] },
    }, 3);
    expect(fim.rascunho.informacoes.servicos.map(s => s.nome).sort()).toEqual(["pedicure", "prancha"]);
    expect(fim.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
    expect(fim.conversa.memoriaSemantica).toMatchObject({ servicoEmFocoId: prancha.id, listaServicosConcluida: true });
    expect(fim.conversa.ignoradas).not.toContain(`servico:${prancha.id}:duracao`);
    expect(perguntaAtual(fim.rascunho, fim.conversa, "SERVICOS")?.chave).toBe(`servico:${prancha.id}:duracao`);
    expect(fim.conversa.mensagens.at(-1)?.texto).not.toContain("Quais serviços vocês fazem nessa área?");

    const mensagensDoModelo = fim.interpretar.mock.calls[0][4].messages as Array<{ role: string; content: string }>;
    expect(mensagensDoModelo.filter(m => m.role === "user").map(m => m.content)).toEqual(expect.arrayContaining([CORRECAO, CONDICAO, FIM]));
  });

  it("reabre o envelope JSON e continua com o mesmo foco, condição e lista de serviços", async () => {
    const c = cadastro();
    const pedicure = structuredClone(c.informacoes.servicos[1]);
    const e = estado({ chave: "servico:s-cabelos:preco", texto: "Qual é o valor de cabelos?", sugestoes: [] }, [
      ["dono", "trabalho com cabelos e unhas, nas unhas faço pedicure"],
      ["atendente", "Qual é o valor de cabelos?"],
    ], "s-cabelos");
    const correcao = await turno(c, e, CORRECAO, {
      servicos: [extrairServico("prancha", CORRECAO, { operacao: "ESPECIFICAR", servicoId: "s-cabelos", categoria: "cabelos" })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: "s-cabelos", evidencia: CORRECAO },
      dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] },
      continuacao: { campo: "servico:s-cabelos:preco", pergunta: "Qual é o valor da prancha?", sugestoes: [] },
    }, 1);
    const prancha = correcao.rascunho.informacoes.servicos.find(s => s.nome === "prancha")!;
    const condicao = await turno(correcao.rascunho, correcao.conversa, CONDICAO, {
      servicos: [extrairServico("prancha", CONDICAO, { operacao: "ATUALIZAR", servicoId: prancha.id, sobConsulta: true, condicaoPreco: CONDICAO })],
      conducao: { listaServicos: "MANTER", servicoEmFocoId: prancha.id, evidencia: CONDICAO },
      continuacao: { campo: "informacoes.servicos", pergunta: "Quais outros serviços você quer incluir na lista?", sugestoes: [] },
    }, 2);

    const salvo: EnvelopeConfiguracaoNexa = { versao: 1, revisao: 2, rascunho: condicao.rascunho,
      etapa: 1, revisadas: [], testes: [], publicado: null, conversa: condicao.conversa };
    // Usa o mesmo validador de leitura da configuração persistida, sem banco.
    const reaberto = lerEnvelopeConfiguracao(JSON.parse(JSON.stringify(salvo)))!;
    expect(reaberto.conversa?.memoriaSemantica).toEqual(condicao.conversa.memoriaSemantica);
    expect(reaberto.conversa?.memoriaSemantica).toMatchObject({ servicoEmFocoId: prancha.id, categorias: ["cabelos"], listaServicosConcluida: false });
    expect(reaberto.rascunho).toEqual(condicao.rascunho);
    expect(JSON.stringify(reaberto.rascunho.informacoes.servicos.find(s => s.id === prancha.id))).toContain(CONDICAO);

    const fim = await turno(reaberto.rascunho, reaberto.conversa!, FIM, {
      conducao: { listaServicos: "CONCLUIDA", servicoEmFocoId: prancha.id, evidencia: FIM },
      continuacao: { campo: `servico:${prancha.id}:duracao`, pergunta: "Quanto tempo demora a prancha?", sugestoes: [] },
    }, 3);
    const reabertoDeNovo = lerEnvelopeConfiguracao(JSON.parse(JSON.stringify({ ...reaberto,
      revisao: 3, rascunho: fim.rascunho, conversa: fim.conversa })))!;
    expect(reabertoDeNovo.rascunho).toEqual(reaberto.rascunho);
    expect(reabertoDeNovo.rascunho.informacoes.servicos.map(s => s.nome).sort()).toEqual(["pedicure", "prancha"]);
    expect(new Set(reabertoDeNovo.rascunho.informacoes.servicos.map(s => s.id)).size).toBe(2);
    expect(reabertoDeNovo.rascunho.informacoes.servicos.find(s => s.id === pedicure.id)).toEqual(pedicure);
    expect(reabertoDeNovo.conversa?.memoriaSemantica).toMatchObject({ servicoEmFocoId: prancha.id, categorias: ["cabelos"], listaServicosConcluida: true });
    expect(perguntaAtual(reabertoDeNovo.rascunho, reabertoDeNovo.conversa!, "SERVICOS")?.chave).toBe(`servico:${prancha.id}:duracao`);
    expect(reabertoDeNovo.conversa?.ignoradas).not.toContain(`servico:${prancha.id}:duracao`);
    expect(JSON.stringify(reabertoDeNovo.rascunho.informacoes.servicos.find(s => s.id === prancha.id))).toContain(CONDICAO);
    expect(reabertoDeNovo.conversa?.mensagens.filter(m => m.de === "dono").map(m => m.texto)).toEqual(expect.arrayContaining([CORRECAO, CONDICAO, FIM]));
  });
  it.each(["so esses", "só esses", "so isso", "só isso", "fechou", "acabou", "é só"])("fallback reconhece encerramento informal da lista de serviços sem IA: %s", async frase => {
    const c = cadastro([servico("s-prancha", "prancha", 8000), servico("s-pedicure", "pedicure", 4000)]);
    const e = estado({ chave: "informacoes.servicos", texto: "O que você vende ou quais serviços faz? Pode me contar do seu jeito.", sugestoes: [] }, [
      ["dono", "faço prancha e pedicure"],
      ["atendente", "O que você vende ou quais serviços faz? Pode me contar do seu jeito."],
    ], "s-prancha");
    const interpretar = vi.fn().mockResolvedValue(JSON.stringify({}));
    const r = await prepararTurnoDeConfiguracao(c, e, {
      revisao: 1, mensagemId: "00000000-0000-4000-8000-000000000099", texto: frase,
      perguntaChave: "informacoes.servicos", topico: "SERVICOS",
    }, { interpretar, iaDisponivel: () => false, agora: () => new Date(instante) });

    expect(r.conversa.memoriaSemantica?.listaServicosConcluida).toBe(true);
    expect(r.conversa.ignoradas).toContain("informacoes.servicos");
    expect(r.conversa.mensagens.at(-1)?.texto).not.toContain("Quais serviços vocês fazem nessa área?");
    expect(r.conversa.mensagens.at(-1)?.texto).not.toContain("Vamos esclarecer esse ponto");
  });
});
