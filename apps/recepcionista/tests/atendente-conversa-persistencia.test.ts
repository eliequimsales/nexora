import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@nexora/recepcionista-prisma";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";
vi.mock("@/lib/db", () => ({ prisma: { company: { findUnique: vi.fn() }, companyProfile: { updateMany: vi.fn() }, service: { findMany: vi.fn() }, knowledgeItem: { findMany: vi.fn() } } }));
vi.mock("@/lib/ai/provider", () => ({ jsonCompletion: vi.fn(), configurationCompletion: vi.fn(), metadadosFalhaDaIa: vi.fn(() => ({})), configuracaoDaIaFaltando: vi.fn(() => "GROQ_API_KEY") }));
import { prisma } from "@/lib/db";
import { conversarConfiguracao, getConversaConfiguracao } from "@/lib/atendente/conversa";
import { getConfiguracao, lerConfiguracaoPublicada, salvarConfiguracao, type EnvelopeConfiguracaoNexa } from "@/lib/atendente/configuracao";

const clone = <T>(v: T) => structuredClone(v);
let salvo: EnvelopeConfiguracaoNexa;
let perfil: Record<string, unknown>;
const fixo = new Date("2026-10-26T12:00:00.000Z");
const deps = { interpretar: vi.fn(), iaDisponivel: () => false, agora: () => fixo };
const id1 = "25110d83-33c2-4573-84e9-27bfbc9b6d9d";
const id2 = "6c620a01-5796-4bc8-a46c-b0d4560392af";
const pedido = (texto: string, perguntaChave: string | null, revisao = salvo.revisao, mensagemId = id1) => ({ texto, perguntaChave, revisao, mensagemId });
const extrair = (patch: Record<string, unknown> = {}) => JSON.stringify({
  nome: null, segmento: null, descricao: null, endereco: null, regiao: null, pagamento: null, nomeAtendente: null,
  modalidade: null, objetivo: null, jeito: null, quando: null, agendamento: null, servicos: [], perguntas: [], esclarecimento: null, dialogo: null, ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  const c = configuracaoExemplo(); c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
  salvo = { versao: 1, revisao: 4, rascunho: c, etapa: 1, revisadas: [], testes: [], publicado: null };
  perfil = { atendenteConfiguracao: salvo, whatsappStatus: "DISCONNECTED", whatsappInstance: null, plantaoAtivo: false, atendenteLigadoPrimeiraVezEm: null };
  (prisma.company.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ id: "c1", name: "Oficina Exemplo", phone: "5511999999999", profile: { ...clone(perfil), atendenteConfiguracao: clone(salvo) } }));
  vi.mocked(prisma.service.findMany).mockResolvedValue([]);
  vi.mocked(prisma.knowledgeItem.findMany).mockResolvedValue([]);
  (prisma.companyProfile.updateMany as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (args: unknown) => {
    const { where, data } = args as { where: { companyId: string; atendenteConfiguracao: { equals: unknown } }; data: { atendenteConfiguracao: EnvelopeConfiguracaoNexa } };
    if (where.companyId !== "c1" || where.atendenteConfiguracao.equals === Prisma.DbNull || JSON.stringify(where.atendenteConfiguracao.equals) !== JSON.stringify(salvo)) return { count: 0 };
    salvo = clone(data.atendenteConfiguracao); return { count: 1 };
  });
});

describe("persistência do rascunho e da conversa administrativa", () => {
  it("a primeira abertura de uma conversa antiga pausada pergunta o dado que falta", async () => {
    salvo.rascunho.informacoes.servicos[0].precoCents = null;
    salvo.conversa = { mensagens: [], ignoradas: [], ultimaPergunta: null, topicoAtual: null, perguntaSuspensa: true };
    const r = await getConversaConfiguracao("c1");
    expect(r.topicoAtual).toBe("SERVICOS");
    expect(r.pergunta?.chave).toBe("servico:servico1:preco");
    expect(prisma.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("GET preserva envelope antigo e não executa escrita ou IA", async () => {
    const r = await getConversaConfiguracao("c1");
    expect(r.mensagens).toEqual([]); expect(r.pergunta?.chave).toBe("informacoes.endereco");
    expect(prisma.companyProfile.updateMany).not.toHaveBeenCalled(); expect(deps.interpretar).not.toHaveBeenCalled();
  });
  it("salva mensagem, interpretação e resposta em uma única escrita, sem publicar ou conectar", async () => {
    const r = await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps);
    expect(r.tela.rascunho.informacoes.endereco).toMatchObject({ valor: "Rua Nova, 99", situacao: "CONFIRMADO" });
    expect(r.tela.revisao).toBe(5); expect(r.mensagens.map(m => m.de)).toEqual(["dono", "atendente"]);
    expect(r.mensagens[0]).toMatchObject({ id: id1, em: fixo.toISOString(), texto: "Rua Nova, 99" });
    expect(prisma.companyProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(vi.mocked(prisma.companyProfile.updateMany).mock.calls[0][0].data)).toEqual(["atendenteConfiguracao"]);
    expect(lerConfiguracaoPublicada(salvo)).toBeNull(); expect(r.tela.conexao).toMatchObject({ conectado: false, ligado: false });
  });
  it("retoma o histórico e a pergunta atual após recarregar", async () => {
    await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps);
    const r = await getConversaConfiguracao("c1"); expect(r.mensagens).toHaveLength(2); expect(r.pergunta).toBeNull();
    expect(r.tela.rascunho.informacoes.endereco.valor).toBe("Rua Nova, 99");
  });
  it("repetir recibo com revisão antiga devolve o resultado sem reexecutar ou escrever", async () => {
    const p = pedido("Rua Nova, 99", "informacoes.endereco"); const primeiro = await conversarConfiguracao("c1", p, deps);
    const repetido = await conversarConfiguracao("c1", p, deps);
    expect(repetido.mensagens).toEqual(primeiro.mensagens); expect(repetido.tela.revisao).toBe(5);
    expect(prisma.companyProfile.updateMany).toHaveBeenCalledTimes(1); expect(deps.interpretar).not.toHaveBeenCalled();
  });
  it("o mesmo recibo não pode trocar de conteúdo", async () => {
    await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps);
    await expect(conversarConfiguracao("c1", pedido("Rua Diferente, 20", null), deps)).rejects.toMatchObject({ status: 409 });
    expect(prisma.companyProfile.updateMany).toHaveBeenCalledTimes(1);
  });
  it("revisão desatualizada não interpreta nem grava outra mensagem", async () => {
    await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps);
    await expect(conversarConfiguracao("c1", pedido("Mudou", null, 4, id2), deps)).rejects.toMatchObject({ status: 409 });
    expect(prisma.companyProfile.updateMany).toHaveBeenCalledTimes(1); expect(deps.interpretar).not.toHaveBeenCalled();
  });
  it("pular muda a pergunta; resposta da pergunta antiga não é aplicada ao próximo campo", async () => {
    salvo.rascunho.informacoes.servicos[0].duracaoMin = null;
    const r = await conversarConfiguracao("c1", pedido("Pular", "servico:servico1:duracao"), deps);
    expect(r.tela.revisao).toBe(4); expect(r.pergunta?.chave).toBe("informacoes.endereco");
    await expect(conversarConfiguracao("c1", pedido("60 minutos", "servico:servico1:duracao", 4, id2), { ...deps, iaDisponivel: () => true })).rejects.toMatchObject({ status: 409 });
    expect(salvo.rascunho.informacoes.endereco.valor).toBe(""); expect(prisma.companyProfile.updateMany).toHaveBeenCalledTimes(1); expect(deps.interpretar).not.toHaveBeenCalled();
  });
  it("uma escrita concorrente impede sobrescrever o outro rascunho", async () => {
    vi.mocked(prisma.companyProfile.updateMany).mockResolvedValueOnce({ count: 0 });
    await expect(conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps)).rejects.toMatchObject({ status: 409 });
    expect(salvo.rascunho.informacoes.endereco.valor).toBe(""); expect(salvo.conversa).toBeUndefined();
  });
  it("falha da IA preserva a tentativa sem salvar fatos ou responder como se o dono tivesse se explicado mal", async () => {
    const antes = clone(salvo);
    await expect(conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), { ...deps, iaDisponivel: () => true, interpretar: vi.fn().mockRejectedValue(new Error("timeout")) }))
      .rejects.toMatchObject({ status: 503, message: expect.stringContaining("Sua mensagem continua aqui") });
    expect(salvo).toEqual(antes); expect(prisma.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("revisão da configuração continua bloqueando publicação por teste, sem aprovar testes automaticamente", async () => {
    const r = await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), deps);
    expect(r.tela.revisadas).toEqual([0, 1, 2, 3]); expect(r.tela.testes).toEqual([]);
    expect(r.tela.pendencias.some(p => p.campo.startsWith("teste:"))).toBe(true);
    expect((await getConfiguracao("c1")).publicadoEm).toBeNull();
  });
  it("adiar mantém a pendência de fato e não a confirma silenciosamente", async () => {
    const r = await conversarConfiguracao("c1", pedido("Definir depois", "informacoes.endereco"), deps);
    expect(r.tela.rascunho.informacoes.endereco.situacao).toBe("NAO_INFORMADO");
    expect(r.tela.pendencias.some(p => p.campo === "informacoes.endereco")).toBe(true); expect(r.tela.revisadas).toEqual([]);
  });
  it("esclarece a descrição ampla sem cadastrá-la como serviço e retoma após recarregar", async () => {
    salvo.rascunho.informacoes.servicos = [];
    const texto = "oferecemos serviços em estética geral com cabelos unhas cílios etc";
    const interpretar = vi.fn().mockResolvedValue(extrair({ esclarecimento: {
      campo: "informacoes.servicos", evidencia: texto, pergunta: "Quais serviços de cabelo vocês oferecem?", sugestoes: [],
    } }));
    const r = await conversarConfiguracao("c1", pedido(texto, "informacoes.servicos"), { ...deps, iaDisponivel: () => true, interpretar });
    expect(r.tela.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.pergunta).toMatchObject({ chave: "esclarecimento:informacoes.servicos", texto: "Quais serviços de cabelo vocês oferecem?" });
    expect(r.mensagens.at(-1)?.texto).not.toMatch(/Qual é o valor de|registrei serviços em/);
    expect((await getConversaConfiguracao("c1")).pergunta).toEqual(r.pergunta);

    interpretar.mockResolvedValue(extrair({ servicos: ["Corte feminino", "escova"].map(nome => ({
      nome, evidencia: "Corte feminino e escova", precoCents: null, duracaoMin: null, sobConsulta: false, descricao: null,
    })) }));
    const segundo = await conversarConfiguracao("c1", pedido("Corte feminino e escova", r.pergunta!.chave, r.tela.revisao, id2), { ...deps, iaDisponivel: () => true, interpretar });
    expect(segundo.tela.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["Corte feminino", "escova"]);
    expect(segundo.tela.rascunho.informacoes.servicos.every(s => s.precoCents === null && s.duracaoMin === null)).toBe(true);
    expect(segundo.pergunta?.chave).toMatch(/^servico:.+:preco$/);
    expect(segundo.mensagens).toHaveLength(4);
    expect(salvo.conversa?.perguntaPendente).toBeNull();
  });
  it("mantém o esclarecimento quando a resposta só ensina outro campo", async () => {
    const pendente = { chave: "esclarecimento:informacoes.endereco", texto: "Qual é o endereço completo da unidade?", sugestoes: [] };
    salvo.conversa = { mensagens: [], ignoradas: [], ultimaPergunta: pendente.chave, perguntaPendente: pendente };
    salvo.rascunho.informacoes.pagamento = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    const r = await conversarConfiguracao("c1", pedido("Aceitamos Pix e cartão", pendente.chave), deps);
    expect(r.tela.rascunho.informacoes.pagamento.valor).toMatch(/Pix/);
    expect(r.tela.rascunho.informacoes.endereco.valor).toBe("");
    expect(r.pergunta).toEqual(pendente);
    expect((await getConversaConfiguracao("c1")).pergunta).toEqual(pendente);
  });
  it("envia contexto selecionado e mantém regras sem duplicar respostas no cadastro", async () => {
    salvo.rascunho.negocio.descricao.valor = "Clínica de massagens";
    salvo.rascunho.conhecimento.itens = [{ id: "regra1", pergunta: "Como cancelar?", resposta: "Avise com 24 horas de antecedência", situacao: "CONFIRMADO", origem: "MANUAL" }];
    salvo.conversa = { ignoradas: [], ultimaPergunta: "informacoes.endereco", mensagens: Array.from({ length: 12 }, (_, i) => ({
      id: `contexto:${i}`, de: i % 2 ? "atendente" as const : "dono" as const, texto: `Informação anterior ${i}`, em: fixo.toISOString(),
    })) };
    const interpretar = vi.fn().mockResolvedValue(extrair({ endereco: { valor: "Rua Nova, 99", evidencia: "Rua Nova, 99" } }));
    await conversarConfiguracao("c1", pedido("Rua Nova, 99", "informacoes.endereco"), { ...deps, iaDisponivel: () => true, interpretar });
    const contexto = JSON.parse(interpretar.mock.calls[0][1]);
    expect(contexto.CADASTRO.negocio.descricao.valor).toBe("Clínica de massagens");
    expect(contexto.CADASTRO.regras[0]).toMatchObject({ id: "regra1", pergunta: "Como cancelar?" });
    expect(contexto.CADASTRO.regras[0].resposta).toBeUndefined();
    expect(salvo.rascunho.conhecimento.itens[0].resposta).toBe("Avise com 24 horas de antecedência");
    expect(contexto.CADASTRO.atendimento).toEqual(salvo.rascunho.atendimento);
    expect(contexto.CADASTRO.horarios).toHaveLength(7);
    expect(contexto.HISTORICO_RECENTE).toBeUndefined();
    expect(contexto.MENSAGEM_ATUAL).toBeUndefined();
    const turnos = interpretar.mock.calls[0][4].messages;
    expect(turnos).toHaveLength(11);
    expect(turnos.at(-1)).toEqual({ role: "user", content: "Rua Nova, 99" });
    expect(turnos.some((m: { role: string }) => m.role === "assistant")).toBe(true);
  });
  it("encerra o esclarecimento do prazo quando a antecedência foi informada", async () => {
    const pendente = { chave: "esclarecimento:atendimento.antecedenciaHoras", texto: "Qual é o prazo mínimo em horas?", sugestoes: [] };
    salvo.rascunho.informacoes.endereco = { valor: "Rua Exemplo, 10", situacao: "CONFIRMADO", origem: "MANUAL" };
    salvo.rascunho.atendimento.gestaoReservas = { cancelar: true, remarcar: true, antecedenciaHoras: null };
    salvo.conversa = { mensagens: [], ignoradas: [], ultimaPergunta: pendente.chave, perguntaPendente: pendente };
    const r = await conversarConfiguracao("c1", pedido("24 horas", pendente.chave), deps);
    expect(r.tela.rascunho.atendimento.gestaoReservas?.antecedenciaHoras).toBe(24);
    expect(salvo.conversa?.perguntaPendente).toBeNull();
    expect((await getConversaConfiguracao("c1")).pergunta?.chave).not.toBe(pendente.chave);
  });
  it.each(["remover", "preencher"])("limpa a pergunta pendente ao %s o serviço no formulário", async acao => {
    const servico = salvo.rascunho.informacoes.servicos[0]; servico.precoCents = null;
    const pendente = { chave: `esclarecimento:servico:${servico.id}:preco`, texto: "Qual é o valor desse serviço?", sugestoes: [] };
    salvo.conversa = { mensagens: [], ignoradas: [], ultimaPergunta: pendente.chave, perguntaPendente: pendente };
    const rascunho = clone(salvo.rascunho);
    if (acao === "remover") rascunho.informacoes.servicos = [];
    else rascunho.informacoes.servicos[0].precoCents = 15000;
    await salvarConfiguracao("c1", { revisao: salvo.revisao, rascunho, etapa: salvo.etapa });
    expect(salvo.conversa?.perguntaPendente).toBeNull();
    expect((await getConversaConfiguracao("c1")).pergunta?.chave).not.toBe(pendente.chave);
  });
  it("ignora uma pergunta antiga cujo serviço já não existe", async () => {
    const pendente = { chave: "esclarecimento:servico:removido:preco", texto: "Qual era o valor do item removido?", sugestoes: [] };
    salvo.conversa = { mensagens: [], ignoradas: [], ultimaPergunta: pendente.chave, perguntaPendente: pendente };
    expect((await getConversaConfiguracao("c1")).pergunta?.chave).toBe("informacoes.endereco");
  });
  it("responde uma dúvida da configuração sem repetir outra pergunta do roteiro", async () => {
    const resposta = "Você pode configurar o envio do link de agendamento ou autorizar o agendamento direto, que depende de disponibilidade na agenda.";
    const interpretar = vi.fn().mockResolvedValue(extrair({ dialogo: { intencao: "PERGUNTAR", resposta, fontesIds: ["produto:agenda"] } }));
    const r = await conversarConfiguracao("c1", pedido("Como funciona a agenda?", "informacoes.endereco"), { ...deps, iaDisponivel: () => true, interpretar });
    expect(r.mensagens.at(-1)?.texto).toBe(resposta);
    expect(r.pergunta).toBeNull(); expect(r.tela.revisao).toBe(4);
    expect(salvo.conversa?.perguntaSuspensa).toBe(true);
    expect((await getConversaConfiguracao("c1")).pergunta).toBeNull();
    expect(r.tela.rascunho.informacoes.endereco.valor).toBe("");
    const segundo = await conversarConfiguracao("c1", pedido("sim", null, r.tela.revisao, id2), deps);
    expect(segundo.tela.rascunho.informacoes.endereco.valor).toBe("");
  });
  it("salva o fato de uma mensagem mista e explica a dúvida usando fontes", async () => {
    const nome = salvo.rascunho.informacoes.servicos[0].nome;
    const evidencia = `${nome} custa R$ 80.`;
    const interpretar = vi.fn().mockResolvedValue(extrair({
      servicos: [{ nome, evidencia, precoCents: 8000, duracaoMin: null, sobConsulta: false, descricao: null }],
      dialogo: { intencao: "MISTO", resposta: "O agendamento direto depende de autorização da empresa e de disponibilidade na agenda.", fontesIds: ["produto:agenda"] },
    }));
    const r = await conversarConfiguracao("c1", { ...pedido(`${evidencia} Como funciona a agenda?`, null), topico: "SERVICOS" }, { ...deps, iaDisponivel: () => true, interpretar });
    expect(r.tela.rascunho.informacoes.servicos[0].precoCents).toBe(8000);
    expect(r.mensagens.at(-1)?.texto).toContain("depende de autorização");
    expect(r.mensagens.at(-1)?.texto).not.toContain("Qual endereço");
    expect(r.tela.rascunho.conhecimento.itens).toEqual(configuracaoExemplo().conhecimento.itens);
    expect(r.topicoAtual).toBe("SERVICOS");
    expect(r.topicos?.map(t => t.id)).toHaveLength(5);
  });
  it("não depende do rótulo de intenção do modelo para deixar uma dúvida respondida", async () => {
    const resposta = "O agendamento direto depende de autorização da empresa e de disponibilidade na agenda.";
    const interpretar = vi.fn().mockResolvedValue(extrair({ dialogo: { intencao: "INFORMAR", resposta, fontesIds: ["produto:agenda"] } }));
    const r = await conversarConfiguracao("c1", pedido("Como funciona a agenda?", "informacoes.endereco"), { ...deps, iaDisponivel: () => true, interpretar });
    expect(r.mensagens.at(-1)?.texto).toBe(resposta);
    expect(r.pergunta).toBeNull(); expect(salvo.conversa?.perguntaSuspensa).toBe(true);
  });
  it("uma pergunta de preço hipotética não altera o catálogo nem aprova o tópico", async () => {
    const precoAnterior = salvo.rascunho.informacoes.servicos[0].precoCents;
    const nome = salvo.rascunho.informacoes.servicos[0].nome;
    const interpretar = vi.fn().mockResolvedValue(extrair({
      servicos: [{ nome, evidencia: "Posso cobrar R$ 80?", precoCents: 8000, duracaoMin: null, sobConsulta: false, descricao: null }],
      dialogo: { intencao: "PERGUNTAR", resposta: "Você pode informar um preço fixo ou deixar o preço sob consulta.", fontesIds: ["produto:servicos"] },
    }));
    const r = await conversarConfiguracao("c1", { ...pedido("Posso cobrar R$ 80?", null), topico: "SERVICOS" }, { ...deps, iaDisponivel: () => true, interpretar });
    expect(r.tela.rascunho.informacoes.servicos[0].precoCents).toBe(precoAnterior);
    expect(r.tela.revisadas).toEqual([]); expect(r.tela.revisao).toBe(4);
    expect(r.mensagens.at(-1)?.texto).not.toContain("R$ 80");
  });
  it("envia o tópico e as fontes do produto junto do contexto da empresa", async () => {
    const interpretar = vi.fn().mockResolvedValue(extrair({ dialogo: { intencao: "PERGUNTAR", resposta: "O teste não envia mensagens pelo WhatsApp nem cria reservas reais.", fontesIds: ["produto:teste"] } }));
    await conversarConfiguracao("c1", { ...pedido("O teste envia mensagem de verdade?", null), topico: "ATENDIMENTO" }, { ...deps, iaDisponivel: () => true, interpretar });
    const contexto = JSON.parse(interpretar.mock.calls[0][1]);
    expect(contexto.TOPICO_ATUAL.id).toBe("ATENDIMENTO");
    expect(contexto.FONTES_DIALOGO.some((f: { id: string }) => f.id === "produto:teste")).toBe(true);
    expect(contexto.CADASTRO.negocio.nome).toBe(salvo.rascunho.negocio.nome);
  });
  it("adiar um campo não anuncia o tópico como preenchido", async () => {
    const r = await conversarConfiguracao("c1", { ...pedido("Definir depois", "informacoes.endereco"), topico: "FUNCIONAMENTO" }, deps);
    expect(r.pergunta).toBeNull();
    expect(r.topicos?.find(t => t.id === "FUNCIONAMENTO")?.estado).toBe("PENDENTE");
    expect(r.mensagens.at(-1)?.texto).not.toMatch(/tópico está preenchido|configuração (?:pronta|concluída)/i);
  });
  it("a conversa livre inicial não confirma uma pergunta antiga escondida no histórico", async () => {
    salvo.rascunho.informacoes.servicos[0].situacao = "REVISAR";
    salvo.conversa = { ignoradas: [], ultimaPergunta: "servico:servico1:revisar", mensagens: [{
      id: "historico-anterior", de: "atendente", texto: "Estas informações antigas estão corretas?", em: fixo.toISOString(),
    }] };
    const r = await conversarConfiguracao("c1", pedido("sim", null), deps);
    expect(r.tela.rascunho.informacoes.servicos[0].situacao).toBe("REVISAR");
    expect(r.tela.revisadas).toEqual([]); expect(r.pergunta).toBeNull();
    expect(r.mensagens.at(-1)?.texto).not.toContain("Tenho Massagem");
  });
  it("contrato inválido da IA não vira uma conversa gravada nem um serviço falso", async () => {
    salvo.rascunho.informacoes.servicos = [];
    await expect(conversarConfiguracao("c1", pedido("trabalhamos com estética em geral e vários serviços", "informacoes.servicos"), {
      ...deps, iaDisponivel: () => true, interpretar: vi.fn().mockResolvedValue("{\"servicos\":\"qualquer coisa\"}"),
    })).rejects.toMatchObject({ status: 503 });
    expect(salvo.rascunho.informacoes.servicos).toHaveLength(0);
    expect(salvo.conversa).toBeUndefined();
    expect(prisma.companyProfile.updateMany).not.toHaveBeenCalled();
  });
});
