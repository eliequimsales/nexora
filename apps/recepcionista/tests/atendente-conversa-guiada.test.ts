import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { prepararTurnoDeConfiguracao, perguntaAtual } from "@/lib/atendente/conversa";
import { contextoParaDialogoConfiguracao } from "@/lib/atendente/conversa-contexto";
import { lacunasDoDialogoConfiguracao, perguntaDeContinuacaoConfiguracao } from "@/lib/atendente/conversa-motor";
import { estadoParaPerguntas } from "@/lib/atendente/conversa-conducao";
import type { EstadoConversaConfiguracao } from "@/lib/atendente/conversa-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

const extrair = (patch: Record<string, unknown> = {}) => JSON.stringify({ nome: null, segmento: null, descricao: null, endereco: null, regiao: null, pagamento: null, nomeAtendente: null,
  modalidade: null, objetivo: null, jeito: null, quando: null, agendamento: null, servicos: [], perguntas: [], esclarecimento: null, dialogo: null, continuacao: null, ...patch });
const vazio = (): EstadoConversaConfiguracao => ({ mensagens: [], ignoradas: [], ultimaPergunta: null, topicoAtual: "SERVICOS" });
const pedido = (texto: string) => ({ revisao: 0, mensagemId: "25110d83-33c2-4573-84e9-27bfbc9b6d9d", texto, perguntaChave: null, topico: "SERVICOS" as const });
const deps = (patch: Record<string, unknown>) => ({ interpretar: vi.fn().mockResolvedValue(extrair(patch)), iaDisponivel: () => true, agora: () => new Date("2026-10-28T12:00:00Z") });
const servico = (nome: string) => ({ nome, evidencia: nome, precoCents: null, duracaoMin: null, sobConsulta: false, descricao: null });

describe("conversa guiada respeita a intenção e conserva o assunto", () => {
  it("sim confirma um preço exato visível mesmo se a IA não repetir o número no contrato", async () => {
    const c = configuracaoExemplo(); const s = c.informacoes.servicos[0];
    const pergunta = { chave: `esclarecimento:servico:${s.id}:preco`, texto: `Você quis dizer que ${s.nome} custa R$ 90?`, sugestoes: [] };
    const r = await prepararTurnoDeConfiguracao(c, { ...vazio(), perguntaPendente: pergunta }, { ...pedido("sim"), perguntaChave: pergunta.chave }, deps({}));
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBe(9000);
    expect(r.conversa.perguntaPendente?.chave).not.toBe(pergunta.chave);
  });
  it("uma ordem explícita de corrigir o nome preserva o serviço mesmo sem rótulo CORRIGIR do modelo", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].nome = "corte feminino";
    c.informacoes.servicos[0].precoCents = 8000; c.informacoes.servicos[0].duracaoMin = 30;
    const id = c.informacoes.servicos[0].id;
    const texto = "Corrigindo o nome: corte feminino agora se chama corte e finalização. Mantém o valor.";
    const d = deps({ servicos: [{ ...servico("corte e finalização"), evidencia: "corte feminino agora se chama corte e finalização" }] });
    const r = await prepararTurnoDeConfiguracao(c, vazio(), pedido(texto), d);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id, nome: "corte e finalização", precoCents: 8000, duracaoMin: 30 });
  });
  it("recebe o último serviço e encerra a lista na mesma fala", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos = [];
    const d = deps({ servicos: [servico("manicure"), servico("pedicure")], continuacao: { campo: "informacoes.servicos", pergunta: "Quais outros serviços vocês fazem?", sugestoes: [] } });
    const r = await prepararTurnoDeConfiguracao(c, vazio(), pedido("Manicure e pedicure. Esses são os serviços."), d);
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["manicure", "pedicure"]);
    expect(r.conversa.ignoradas).toContain("informacoes.servicos");
    expect(r.conversa.mensagens.at(-1)?.texto).not.toContain("Quais outros");
  });
  it("aceita evidências por trechos reais sem exigir a pontuação que o modelo usou", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos = ["corte feminino", "escova"].map((nome, i) => ({ ...c.informacoes.servicos[0], id: `s${i}`, nome, precoCents: null, duracaoMin: null }));
    const texto = "Os dois de cabelo custam R$ 80 cada. O corte dura 30 minutos e a escova 45 minutos.";
    const d = deps({ servicos: [
      { ...servico("corte feminino"), evidencia: "Os dois de cabelo custam R$ 80 cada. O corte dura 30 minutos.", precoCents: 8000, duracaoMin: 30 },
      { ...servico("escova"), evidencia: "Os dois de cabelo custam R$ 80 cada. A escova 45 minutos.", precoCents: 8000, duracaoMin: 45 },
    ] });
    const r = await prepararTurnoDeConfiguracao(c, vazio(), pedido(texto), d);
    expect(r.rascunho.informacoes.servicos.map(s => [s.precoCents, s.duracaoMin])).toEqual([[8000, 30], [8000, 45]]);
  });

  it("evidência em trechos não permite omitir uma negação do preço", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = 9900;
    const texto = "Revisão não custa R$ 150.";
    const d = deps({ servicos: [{ ...servico("Revisão"), evidencia: "custa R$ 150.", precoCents: 15000 }] });
    const r = await prepararTurnoDeConfiguracao(c, vazio(), pedido(texto), d);
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBe(9900);
  });
  it("entende sim como confirmação da interpretação que acabou de perguntar", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos = [];
    const pergunta = { chave: "esclarecimento:informacoes.servicos", texto: "Você quis dizer corte e escova?", sugestoes: [] };
    const d = deps({ servicos: ["corte", "escova"].map(nome => ({ ...servico(nome), evidencia: "corte e escova" })) });
    const r = await prepararTurnoDeConfiguracao(c, { ...vazio(), perguntaPendente: pergunta }, { ...pedido("sim"), perguntaChave: pergunta.chave }, d);
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["corte", "escova"]);
    expect(r.conversa.perguntaPendente?.chave).not.toBe(pergunta.chave);
  });

  it.each(["Quais serviços vocês fazem?", "Você quis dizer corte e escova?"])("não extrai uma proposta escondida ou uma pergunta aberta: %s", async texto => {
    const c = configuracaoExemplo(); c.informacoes.servicos = [];
    const pergunta = { chave: "esclarecimento:informacoes.servicos", texto, sugestoes: [] };
    const estado = { ...vazio(), perguntaPendente: pergunta, ...(texto.startsWith("Você") ? { perguntaSuspensa: true } : {}) };
    const d = deps({ servicos: ["corte", "escova"].map(nome => ({ ...servico(nome), evidencia: "corte e escova" })) });
    const r = await prepararTurnoDeConfiguracao(c, estado, { ...pedido("sim"), perguntaChave: texto.startsWith("Você") ? null : pergunta.chave }, d);
    expect(r.rascunho.informacoes.servicos).toEqual([]);
  });
  it("depois da empresa segue para os serviços mesmo quando a apresentação já foi informada", async () => {
    const c = configuracaoExemplo(); c.negocio.nome = "Minha empresa"; c.negocio.segmento = ""; c.informacoes.servicos = [];
    const texto = "somos Espaço Aurora fazemos estética cabelo unhas e cílios";
    const d = deps({ nome: { valor: "Espaço Aurora", evidencia: texto }, segmento: { valor: "estética", evidencia: texto },
      descricao: { valor: "estética cabelo unhas e cílios", evidencia: texto } });
    const r = await prepararTurnoDeConfiguracao(c, { ...vazio(), topicoAtual: "EMPRESA" }, { ...pedido(texto), topico: "EMPRESA" }, d);
    expect(r.conversa.topicoAtual).toBe("SERVICOS");
    expect(r.conversa.ultimaPergunta).toBe("informacoes.servicos");
    expect(r.conversa.mensagens.at(-1)?.texto).not.toMatch(/endereço|objetivo/i);
  });
  it("salva serviços claros e deixa a IA continuar a lista em vez de obrigar preço", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos = [];
    const texto = "De cabelo, corte feminino e escova. Vou passar os preços depois, primeiro quero terminar a lista.";
    const d = deps({ servicos: [servico("corte feminino"), servico("escova")],
      dialogo: { intencao: "INFORMAR", resposta: "Combinado. Vamos terminar a lista.", fontesIds: [] },
      continuacao: { campo: "informacoes.servicos", pergunta: "Quais outros serviços você oferece?", sugestoes: [] } });
    const r = await prepararTurnoDeConfiguracao(c, vazio(), pedido(texto), d);
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["corte feminino", "escova"]);
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null)).toBe(true);
    expect(r.conversa.camposAdiados).toContain("servicos.precos");
    expect(r.conversa.perguntaPendente).toMatchObject({ chave: "informacoes.servicos", texto: "Quais outros serviços você oferece?" });
    expect(r.conversa.mensagens.at(-1)?.texto).not.toMatch(/Qual é o valor|quanto custa/i);
    expect(r.conversa.topicoAtual).toBe("SERVICOS");
    expect(JSON.parse(d.interpretar.mock.calls[0][1]).MEMORIA_CONVERSA.camposAdiados).toContain("servicos.precos");
  });

  it("recusa continuação que insiste em preço adiado, mesmo se o modelo sugerir", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const estado = { ...vazio(), camposAdiados: ["servicos.precos"] };
    expect(perguntaDeContinuacaoConfiguracao({ continuacao: { campo: `servico:${c.informacoes.servicos[0].id}:preco`, pergunta: "Qual é o preço?", sugestoes: [] } }, c, estadoParaPerguntas(c, estado), "SERVICOS")).toBeNull();
  });

  it("resposta curta sem pergunta visível passa pelo modelo e não confirma campo antigo", async () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].situacao = "REVISAR";
    const d = deps({ dialogo: { intencao: "INFORMAR", resposta: "Entendi.", fontesIds: [] } });
    const r = await prepararTurnoDeConfiguracao(c, { ...vazio(), perguntaSuspensa: true }, pedido("sim"), d);
    expect(d.interpretar).toHaveBeenCalledTimes(1);
    expect(r.rascunho.informacoes.servicos[0].situacao).toBe("REVISAR");
  });

  it("troca explícita de assunto retoma perguntas sem herdar a pausa anterior", () => {
    const c = configuracaoExemplo(); c.informacoes.endereco.valor = ""; c.informacoes.endereco.situacao = "NAO_INFORMADO";
    const estado = { ...vazio(), perguntaSuspensa: true };
    expect(perguntaAtual(c, estado, "SERVICOS")).toBeNull();
    expect(perguntaAtual(c, estado, "FUNCIONAMENTO")?.chave).toBe("informacoes.endereco");
  });

  it("recebe mudança de horários e pagamento na mesma fala, conservando o novo assunto", async () => {
    const c = configuracaoExemplo(); c.informacoes.horarios = []; c.informacoes.horariosSituacao = "NAO_INFORMADO";
    const texto = "Agora vamos aos horários: terça a sábado das 9 às 18, domingo e segunda fechados. E aceitamos Pix e cartão.";
    const d = deps({ pagamento: { valor: "Pix e cartão", evidencia: "aceitamos Pix e cartão" }, horarios: [
      { dias: [2, 3, 4, 5, 6], abre: "09:00", fecha: "18:00", fechado: false, evidencia: "terça a sábado das 9 às 18" },
      { dias: [0, 1], abre: null, fecha: null, fechado: true, evidencia: "domingo e segunda fechados" },
    ] });
    const r = await prepararTurnoDeConfiguracao(c, { ...vazio(), perguntaSuspensa: true }, pedido(texto), d);
    expect(r.conversa.topicoAtual).toBe("FUNCIONAMENTO");
    expect(r.rascunho.informacoes.pagamento.valor).toBe("Pix e cartão");
    expect(r.rascunho.informacoes.horarios).toHaveLength(7);
    expect(r.rascunho.informacoes.horarios.filter(h => h.closed).map(h => h.day)).toEqual([0, 1]);
    expect(r.rascunho.informacoes.horariosSituacao).toBe("CONFIRMADO");
    expect(r.rascunho.atendimento.agendamento).toBe(c.atendimento.agendamento);
    expect(r.conversa.mensagens.every(m => m.topico === "FUNCIONAMENTO")).toBe(true);
  });

  it("recupera a associação antiga de cabelo além das seis últimas mensagens sem cortar a fala", () => {
    const c = configuracaoExemplo();
    const estado = vazio();
    estado.mensagens = Array.from({ length: 18 }, (_, i) => ({ id: `m${i}`, de: i % 2 ? "atendente" : "dono", texto: i === 2 ? "De cabelo, corte feminino e escova. Não é um pacote, são serviços separados." : `Outra informação ${i}`, em: "2026-10-28T00:00:00Z" }));
    const contexto = contextoParaDialogoConfiguracao(c, estado, "E o primeiro de cabelo, qual foi o valor?", null, "SERVICOS");
    expect(contexto.HISTORICO_RECENTE.some(m => m.texto === estado.mensagens[2].texto)).toBe(true);
    expect(contexto.HISTORICO_RECENTE.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(contexto).length).toBeLessThanOrEqual(10000);
  });

  it("a pergunta da IA precisa de uma lacuna real e não pode introduzir valor ou reserva", () => {
    const c = configuracaoExemplo();
    expect(lacunasDoDialogoConfiguracao(c, vazio(), "SERVICOS").some(q => q.chave === "informacoes.servicos")).toBe(true);
    expect(perguntaDeContinuacaoConfiguracao({ continuacao: { campo: "inventado", pergunta: "Como funciona?", sugestoes: [] } }, c, vazio())).toBeNull();
    expect(perguntaDeContinuacaoConfiguracao({ continuacao: { campo: "informacoes.servicos", pergunta: "Já reservei por 90 reais, qual outro serviço?", sugestoes: [] } }, c, vazio())).toBeNull();
  });
});
