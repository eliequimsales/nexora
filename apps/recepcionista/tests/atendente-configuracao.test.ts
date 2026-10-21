import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@nexora/recepcionista-prisma";
import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";

vi.mock("@/lib/db", () => ({ prisma: {
  company: { findUnique: vi.fn(), update: vi.fn() }, companyProfile: { updateMany: vi.fn() },
  service: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, knowledgeItem: { findMany: vi.fn() }, $transaction: vi.fn(),
} }));
import { prisma } from "@/lib/db";
import { confirmarTesteConfiguracao, ConfiguracaoErro, getConfiguracao, importarCadastroConfiguracao, lerConfiguracaoPublicada, pendenciasDaConfiguracao,
  publicarConfiguracao, registrarTesteConfiguracao, salvarConfiguracao, validarAtivacaoConfiguracao, type EnvelopeConfiguracaoNexa } from "@/lib/atendente/configuracao";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { company: { findUnique: Fn; update: Fn }; companyProfile: { updateMany: Fn };
  service: { findMany: Fn; create: Fn; updateMany: Fn }; knowledgeItem: { findMany: Fn }; $transaction: Fn };
const clone = <T>(v: T): T => structuredClone(v);
const info = (valor: string) => ({ valor, situacao: valor ? "CONFIRMADO" as const : "NAO_INFORMADO" as const, origem: "MANUAL" as const });
function config(): ConfiguracaoNexa {
  return {
    negocio: { nome: "Ateliê Real", segmento: "Costura", modalidade: "ONLINE", objetivo: "DUVIDAS", regiao: info(""), descricao: info("Ajustes de roupas sob encomenda.") },
    informacoes: { endereco: info(""), pagamento: info("Pix"), horarios: Array.from({ length: 7 }, (_, day) => ({ day, open: "09:00", close: "18:00", closed: day === 0 })),
      horariosSituacao: "CONFIRMADO", diasFechados: [], servicos: [] },
    atendimento: { nome: "Nexa", jeito: "ACOLHEDOR", quando: "APOIO_EXPEDIENTE", agendamento: "DESLIGADO", handoffKeywords: ["responsável"] },
    conhecimento: { itens: [] },
  };
}
function envelope(c = config()): EnvelopeConfiguracaoNexa {
  return { versao: 1, revisao: 3, rascunho: c, etapa: 4, revisadas: [0, 1, 2, 3], publicado: null,
    testes: (["INFORMACOES", "HUMANO", "DESCONHECIDA"] as const).map((cenario) => ({ id: `teste:${cenario}`, cenario, revisao: 3,
      em: "2026-10-21T10:00:00.000Z", pergunta: "Pergunta testada", respostas: ["Resposta conferida"], correto: true })) };
}
type Perfil = { atendenteConfiguracao: unknown; description: string; address: string; paymentMethods: string; businessHours: unknown; diasFechados: unknown;
  faqs: unknown; segments: unknown; pricingInfo: string; productsServices: string; serviceRules: string; atendenteNome: string; atendenteJeito: string;
  atendenteMarca: boolean; atendenteExpediente: boolean; handoffKeywords: unknown; whatsappStatus: string; whatsappInstance: string | null; plantaoAtivo: boolean;
  atendenteLigadoPrimeiraVezEm: Date | null };
type Servico = { id: string; companyId: string; name: string; priceCents: number; durationMin: number; active: boolean; suggested: boolean; order: number };
let perfil: Perfil;
let empresa: { id: string; name: string; phone: string };
let servicos: Servico[];
let idCriado: number;
const asRecord = (v: unknown) => v as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks(); idCriado = 0;
  perfil = { atendenteConfiguracao: null, description: "Texto legado", address: "", paymentMethods: "", businessHours: [], diasFechados: [], faqs: [], segments: [],
    pricingInfo: "", productsServices: "", serviceRules: '[{"nome":"Ana","cargo":"Equipe"}]', atendenteNome: "Bia", atendenteJeito: "ACOLHEDOR",
    atendenteMarca: false, atendenteExpediente: true, handoffKeywords: [], whatsappStatus: "CONNECTED", whatsappInstance: "empresa-c1", plantaoAtivo: false,
    atendenteLigadoPrimeiraVezEm: null };
  empresa = { id: "c1", name: "Empresa antes", phone: "5511999998888" }; servicos = [];
  db.company.findUnique.mockImplementation(async () => ({ ...clone(empresa), profile: clone(perfil) }));
  db.knowledgeItem.findMany.mockResolvedValue([]);
  db.company.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(empresa, data); return clone(empresa); });
  db.companyProfile.updateMany.mockImplementation(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const esperado = asRecord(where.atendenteConfiguracao).equals;
    if (!(esperado === Prisma.DbNull && perfil.atendenteConfiguracao == null) && JSON.stringify(esperado) !== JSON.stringify(perfil.atendenteConfiguracao)) return { count: 0 };
    Object.assign(perfil, clone(data)); return { count: 1 };
  });
  db.service.findMany.mockImplementation(async ({ where }: { where: { companyId: string; active?: boolean; id?: { in?: string[] } } }) => clone(servicos.filter((s) =>
    s.companyId === where.companyId && (where.active === undefined || s.active === where.active) && (!where.id?.in || where.id.in.includes(s.id))).sort((a, b) => a.order - b.order)));
  db.service.create.mockImplementation(async ({ data }: { data: Omit<Servico, "id"> }) => { const s = { ...clone(data), id: `s-criado-${++idCriado}` }; servicos.push(s); return { id: s.id }; });
  db.service.updateMany.mockImplementation(async ({ where, data }: { where: { companyId: string; id?: string | { notIn: string[] } }; data: Partial<Servico> }) => {
    let count = 0;
    for (const s of servicos) if (s.companyId === where.companyId && (!where.id || (typeof where.id === "string" ? s.id === where.id : !where.id.notIn.includes(s.id)))) { Object.assign(s, clone(data)); count++; }
    return { count };
  });
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const snapshot = { perfil: clone(perfil), empresa: clone(empresa), servicos: clone(servicos) };
    try { return await fn(db); } catch (e) { perfil = snapshot.perfil; empresa = snapshot.empresa; servicos = snapshot.servicos; throw e; }
  });
});

describe("rascunho separado do atendimento publicado", () => {
  it("não anuncia perfil legado parcialmente ativado como atendente ligado", async () => {
    perfil.plantaoAtivo = true;
    const t = await getConfiguracao("c1");
    expect(t.conexao).toMatchObject({ conectado: true, ligado: false });
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("usa a mesma regra do atendimento real para ativado e pausado", async () => {
    perfil.plantaoAtivo = true; perfil.atendenteLigadoPrimeiraVezEm = new Date("2026-10-21T12:00:00Z");
    expect((await getConfiguracao("c1")).conexao.ligado).toBe(true);
    perfil.plantaoAtivo = false;
    expect((await getConfiguracao("c1")).conexao.ligado).toBe(false);
    expect(perfil.atendenteLigadoPrimeiraVezEm).not.toBeNull();
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("lê dados reais como REVISAR, sem escrever nem fabricar duração", async () => {
    servicos.push({ id: "s1", companyId: "c1", name: "Ajuste", durationMin: 0, priceCents: 0, active: true, suggested: false, order: 0 });
    db.knowledgeItem.findMany.mockResolvedValue([{ id: "k1", question: "Prazo?", answer: "Combinado por peça." }]);
    const t = await getConfiguracao("c1");
    expect(t.rascunho.informacoes.servicos[0]).toMatchObject({ duracaoMin: null, precoModo: "SOB_CONSULTA", situacao: "REVISAR" });
    expect(t.rascunho.conhecimento.itens[0]).toMatchObject({ id: "conhecimento:k1", situacao: "REVISAR" });
    expect(t.rascunho.conhecimento.itens.some((p) => p.resposta.includes("cargo"))).toBe(false);
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled(); expect(t.publicadoEm).toBeNull();
  });
  it("salva exclusivamente o envelope, sem ligar nem sobrescrever os fatos", async () => {
    const antes = clone(perfil); const c = config();
    const t = await salvarConfiguracao("c1", { revisao: 0, rascunho: c, etapa: 1 });
    expect(t.revisao).toBe(1); expect(perfil.description).toBe(antes.description); expect(empresa.name).toBe("Empresa antes");
    expect(perfil.plantaoAtivo).toBe(false); expect(perfil.serviceRules).toBe(antes.serviceRules);
    expect(Object.keys(db.companyProfile.updateMany.mock.calls[0][0].data)).toEqual(["atendenteConfiguracao"]);
  });
  it("avançar etapa preserva os testes e a revisão do conteúdo", async () => {
    perfil.atendenteConfiguracao = envelope();
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: config(), etapa: 4, concluirEtapa: true });
    expect(t.revisao).toBe(3); expect(t.testes).toHaveLength(3); expect(t.revisadas).toEqual([0, 1, 2, 3, 4]); expect(t.etapa).toBe(5);
  });
  it("conclui um grupo em uma única escrita e usa a etapa informada como destino", async () => {
    const e = envelope(); e.revisadas = [2, 3]; perfil.atendenteConfiguracao = e;
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: config(), etapa: 2, concluirEtapas: [1, 0] });
    expect(t.etapa).toBe(2); expect(t.revisadas).toEqual([0, 1, 2, 3]); expect(t.revisao).toBe(3); expect(t.testes).toEqual(e.testes);
    expect(db.companyProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(db.companyProfile.updateMany.mock.calls[0][0]).toMatchObject({
      where: { companyId: "c1", atendenteConfiguracao: { equals: e } },
      data: { atendenteConfiguracao: { etapa: 2, revisadas: [0, 1, 2, 3] } },
    });
  });
  it("confere a página inteira em uma escrita sem aprovar automaticamente informações ou testes", async () => {
    const e = envelope(); e.revisadas = []; perfil.atendenteConfiguracao = e;
    const c = config(); c.informacoes.pagamento = { valor: "Pix e cartão", situacao: "REVISAR", origem: "ASSISTENTE" };
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 4, concluirEtapas: [0, 1, 2, 3] });
    expect(t.revisadas).toEqual([0, 1, 2, 3]); expect(t.revisao).toBe(4); expect(t.testes).toEqual([]);
    expect(t.pendencias.some((p) => p.campo.startsWith("etapa:"))).toBe(false);
    expect(t.pendencias).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: "informacoes.pagamento", bloqueia: true }),
      expect.objectContaining({ campo: "teste:INFORMACOES", bloqueia: true }),
    ]));
    expect(t.rascunho.informacoes.pagamento.situacao).toBe("REVISAR");
    expect(db.companyProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(db.companyProfile.updateMany.mock.calls[0][0].where.atendenteConfiguracao).toEqual({ equals: e });
    await expect(publicarConfiguracao("c1", 4)).rejects.toMatchObject({ status: 409 });
    expect(db.company.update).not.toHaveBeenCalled();
  });
  it("salva e recarrega preenchimento parcial sem completar dados nem manter testes de outra versão", async () => {
    const e = envelope(); e.publicado = { revisao: 3, em: "2026-10-21", rascunho: config() }; perfil.atendenteConfiguracao = e;
    const c = config(); c.negocio.nome = "";
    c.informacoes.horarios = [{ day: 1, open: "09:", close: "", closed: false }];
    c.informacoes.servicos = [{ id: "novo:servico", nome: "", descricao: "", precoModo: "FIXO", precoCents: null,
      duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL" }];
    await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 0 });
    const t = await getConfiguracao("c1");
    expect(t.rascunho).toEqual(c); expect(t.revisao).toBe(4); expect(t.testes).toEqual([]);
    expect(t.revisadas).toEqual([2, 3]);
    expect(t.pendencias).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: "negocio.nome", bloqueia: true }),
      expect.objectContaining({ campo: "informacoes.horarios", bloqueia: true }),
      expect.objectContaining({ campo: "servico:novo:servico:preco", bloqueia: true }),
    ]));
    expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)).toEqual(e.publicado.rascunho);
    expect(perfil.businessHours).toEqual([]); expect(servicos).toEqual([]); expect(perfil.plantaoAtivo).toBe(false);
  });
  it("salvar e concluir um grupo invalida testes da revisão antiga sem perder as outras etapas", async () => {
    const e = envelope(); e.revisadas.push(4); e.publicado = { revisao: 3, em: "2026-10-21", rascunho: config() }; perfil.atendenteConfiguracao = e;
    const c = config(); c.atendimento.nome = "Bia"; c.conhecimento.itens = [{
      id: "novo:entrega", pergunta: "Faz entrega?", resposta: "Não fazemos entrega.", situacao: "REVISAR", origem: "MANUAL",
    }];
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 4, concluirEtapas: [2, 3] });
    expect(t.etapa).toBe(2); expect(t.revisao).toBe(4); expect(t.revisadas).toEqual([0, 1, 2, 3]); expect(t.testes).toEqual([]);
    expect(t.rascunho.conhecimento.itens[0].situacao).toBe("REVISAR");
    expect(t.pendencias).toContainEqual(expect.objectContaining({ campo: "pergunta:novo:entrega", bloqueia: true }));
    expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)?.atendimento.nome).toBe("Nexa");
    expect(db.companyProfile.updateMany).toHaveBeenCalledTimes(1);
    expect((await getConfiguracao("c1")).etapa).toBe(2);
    await expect(publicarConfiguracao("c1", 4)).rejects.toMatchObject({ status: 409 });
    expect(db.company.update).not.toHaveBeenCalled();
  });
  it("retoma o começo do grupo de informações com conteúdo a conferir, sem perder o rascunho", async () => {
    perfil.atendenteConfiguracao = envelope();
    const c = config(); c.informacoes.pagamento = { valor: "Pix e cartão", situacao: "REVISAR", origem: "ASSISTENTE" };
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 2, concluirEtapas: [1, 0] });
    expect(t.etapa).toBe(0); expect(t.revisao).toBe(4); expect(t.rascunho.informacoes.pagamento).toEqual(c.informacoes.pagamento);
    const recarregado = await getConfiguracao("c1");
    expect(recarregado.etapa).toBe(0); expect(recarregado.rascunho.informacoes.pagamento.situacao).toBe("REVISAR");
    expect(recarregado.pendencias).toContainEqual(expect.objectContaining({ campo: "informacoes.pagamento", bloqueia: true }));
  });
  it("grupo de comportamento válido avança para testes mesmo com testes antigos invalidados", async () => {
    perfil.atendenteConfiguracao = envelope();
    const c = config(); c.atendimento.nome = "Bia";
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 4, concluirEtapas: [2, 3] });
    expect(t.etapa).toBe(4); expect(t.revisao).toBe(4); expect(t.testes).toEqual([]);
    expect((await getConfiguracao("c1")).etapa).toBe(4);
  });
  it("a conclusão individual legada preserva o avanço mesmo quando há conteúdo pendente", async () => {
    perfil.atendenteConfiguracao = envelope();
    const c = config(); c.informacoes.pagamento.situacao = "REVISAR";
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 1, concluirEtapa: true });
    expect(t.etapa).toBe(2); expect(t.rascunho.informacoes.pagamento.situacao).toBe("REVISAR");
  });
  it("o conflito de um grupo não conclui nenhuma das etapas", async () => {
    const e = envelope(); e.revisadas = [0, 1]; perfil.atendenteConfiguracao = e;
    db.companyProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(salvarConfiguracao("c1", { revisao: 3, rascunho: config(), etapa: 4, concluirEtapas: [2, 3] })).rejects.toThrow("mudou enquanto");
    expect(perfil.atendenteConfiguracao).toEqual(e); expect(e.revisadas).toEqual([0, 1]);
    expect(db.companyProfile.updateMany).toHaveBeenCalledTimes(1);
  });
  it.each([[], [0, 0], [-1], [4], [1.5], [0, 1, 2, 3, 0]].map((concluirEtapas) => ({ concluirEtapas })))("recusa um grupo de etapas inválido ($concluirEtapas) antes da escrita", async ({ concluirEtapas }) => {
    await expect(salvarConfiguracao("c1", { revisao: 0, rascunho: config(), etapa: 2, concluirEtapas })).rejects.toThrow();
    expect(db.company.findUnique).not.toHaveBeenCalled(); expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("recusa conclusão de grupo junto da conclusão individual sem interpretar o destino", async () => {
    await expect(salvarConfiguracao("c1", { revisao: 0, rascunho: config(), etapa: 2, concluirEtapa: true, concluirEtapas: [0, 1] })).rejects.toThrow("Conclua uma etapa ou um grupo");
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("ordem das chaves JSON não transforma navegação em edição", async () => {
    const e = envelope(); e.rascunho.atendimento = { agendamento: "DESLIGADO", quando: "APOIO_EXPEDIENTE", nome: "Nexa", handoffKeywords: ["responsável"], jeito: "ACOLHEDOR" };
    perfil.atendenteConfiguracao = e;
    expect((await salvarConfiguracao("c1", { revisao: 3, rascunho: config(), etapa: 5 })).revisao).toBe(3);
  });
  it("editar conteúdo invalida testes e revisões, preservando a publicação anterior", async () => {
    const e = envelope(); e.publicado = { revisao: 3, em: "2026-10-21", rascunho: config() }; perfil.atendenteConfiguracao = e;
    const c = config(); c.negocio.descricao.valor = "Alteração ainda não publicada";
    const t = await salvarConfiguracao("c1", { revisao: 3, rascunho: c, etapa: 0 });
    expect(t.revisao).toBe(4); expect(t.testes).toEqual([]); expect(t.revisadas).toEqual([1, 2, 3]); expect(t.haAlteracoes).toBe(true);
    expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)?.negocio.descricao.valor).toBe("Ajustes de roupas sob encomenda.");
  });
  it("recusa versão antiga e escrita concorrente", async () => {
    perfil.atendenteConfiguracao = envelope();
    await expect(salvarConfiguracao("c1", { revisao: 2, rascunho: config(), etapa: 0 })).rejects.toBeInstanceOf(ConfiguracaoErro);
    db.companyProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(salvarConfiguracao("c1", { revisao: 3, rascunho: config(), etapa: 0 })).rejects.toThrow("mudou enquanto");
  });
  it("recusa ID externo e repetido no rascunho", async () => {
    const c = config(); c.informacoes.servicos = [{ id: "id-outra-empresa", nome: "Serviço", descricao: "", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL" }];
    await expect(salvarConfiguracao("c1", { revisao: 0, rascunho: c, etapa: 1 })).rejects.toThrow("não pertence");
    c.informacoes.servicos[0].id = "novo:1"; c.informacoes.servicos.push(clone(c.informacoes.servicos[0]));
    await expect(salvarConfiguracao("c1", { revisao: 0, rascunho: c, etapa: 1 })).rejects.toThrow("repetidos");
  });
  it("JSON inválido não recai silenciosamente no cadastro antigo", async () => {
    perfil.atendenteConfiguracao = { revisao: 2 };
    await expect(getConfiguracao("c1")).rejects.toThrow("revisão técnica");
  });
});

describe("revisão manual e prontidão por capacidade", () => {
  it("atendimento de dúvidas revisado fica pronto sem agenda ou duração inventada", () => {
    expect(pendenciasDaConfiguracao(envelope())).toEqual([]);
  });
  it("exige expediente para definir quando responder mesmo somente dúvidas", () => {
    const e = envelope(); e.rascunho.informacoes.horarios = []; e.rascunho.informacoes.horariosSituacao = "NAO_INFORMADO";
    expect(pendenciasDaConfiguracao(e)).toContainEqual(expect.objectContaining({ campo: "informacoes.horarios", bloqueia: true }));
  });
  it("agendamento exige duração, serviço e teste de horário", () => {
    const e = envelope(); e.rascunho.negocio.objetivo = "AGENDAMENTOS"; e.rascunho.atendimento.agendamento = "DIRETO";
    expect(pendenciasDaConfiguracao(e).map((p) => p.campo)).toContain("informacoes.servicos");
    e.rascunho.informacoes.servicos.push({ id: "novo:s1", nome: "Ajuste", descricao: "", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL" });
    expect(pendenciasDaConfiguracao(e).map((p) => p.campo)).toEqual(expect.arrayContaining(["servico:novo:s1:duracao", "teste:HORARIO"]));
  });
  it("um teste antigo ou sem confirmação não libera publicação", async () => {
    const e = envelope(); e.testes[0].revisao = 2; e.testes[1].correto = null; perfil.atendenteConfiguracao = e;
    await expect(publicarConfiguracao("c1", 3)).rejects.toMatchObject({ status: 409 });
    expect(db.company.update).not.toHaveBeenCalled();
  });
  it("a resposta mais recente de um cenário substitui a revisão anterior", () => {
    const e = envelope(); e.testes.push({ ...clone(e.testes[0]), id: "teste:reprovado", correto: false });
    expect(pendenciasDaConfiguracao(e)).toContainEqual(expect.objectContaining({ campo: "teste:INFORMACOES" }));
  });
  it("data impossível não é salva como fechamento real", async () => {
    const c = config(); c.informacoes.diasFechados = ["2026-02-30"];
    await expect(salvarConfiguracao("c1", { revisao: 0, rascunho: c, etapa: 1 })).rejects.toThrow();
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("guarda recibo da resposta efetivamente simulada antes de permitir revisão", async () => {
    perfil.atendenteConfiguracao = envelope();
    const teste = await registrarTesteConfiguracao("c1", { revisao: 3, cenario: "HUMANO", pergunta: "Quero uma pessoa", respostas: ["Você pode acompanhar o pedido na conversa."] });
    expect(teste.correto).toBeNull(); expect(teste.id).toMatch(/^teste:/);
    const t = await confirmarTesteConfiguracao("c1", { revisao: 3, testeId: teste.id, correto: true });
    expect(t.testes.find((i) => i.id === teste.id)?.correto).toBe(true);
    await expect(confirmarTesteConfiguracao("c1", { revisao: 3, testeId: "teste:outra-empresa", correto: true })).rejects.toThrow("não pertence");
    await expect(confirmarTesteConfiguracao("c1", { revisao: 1, testeId: teste.id, correto: true })).rejects.toThrow("outra tela");
  });
  it("dados em REVISAR, endereço presencial ausente ou horário invertido bloqueiam", () => {
    const e = envelope(); e.rascunho.negocio.modalidade = "PRESENCIAL"; e.rascunho.informacoes.pagamento.situacao = "REVISAR";
    e.rascunho.informacoes.horarios[1].close = "08:00";
    expect(pendenciasDaConfiguracao(e).map((p) => p.campo)).toEqual(expect.arrayContaining(["informacoes.endereco", "informacoes.pagamento", "informacoes.horarios"]));
  });
  it("bloqueia duas respostas confirmadas contraditórias para a mesma pergunta", () => {
    const e = envelope(); e.rascunho.conhecimento.itens = [
      { id: "novo:1", pergunta: "Aceitam cartão?", resposta: "Sim.", situacao: "CONFIRMADO", origem: "MANUAL" },
      { id: "novo:2", pergunta: "ACEITAM CARTAO", resposta: "Não.", situacao: "CONFIRMADO", origem: "MANUAL" },
    ];
    expect(pendenciasDaConfiguracao(e)).toContainEqual(expect.objectContaining({ campo: "pergunta:novo:2", bloqueia: true }));
  });
});

describe("publicação atômica e isolamento de empresa", () => {
  it("publica dados conferidos, converte IDs e preserva equipe e reservas", async () => {
    const e = envelope(); e.rascunho.informacoes.servicos.push({ id: "novo:1", nome: "Orçamento", descricao: "Avaliação", precoModo: "FIXO", precoCents: 0, duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL" });
    perfil.atendenteConfiguracao = e;
    servicos = [{ id: "s-antigo", companyId: "c1", name: "Antigo", durationMin: 30, priceCents: 2000, active: true, suggested: false, order: 0 },
      { id: "outro", companyId: "c2", name: "Outra empresa", durationMin: 30, priceCents: 3000, active: true, suggested: false, order: 0 }];
    const equipeAntes = perfil.serviceRules;
    const t = await publicarConfiguracao("c1", 3);
    expect(t.haAlteracoes).toBe(false); expect(t.rascunho.informacoes.servicos[0].id).toBe("s-criado-1");
    expect(servicos.find((s) => s.id === "s-antigo")?.active).toBe(false); expect(servicos.find((s) => s.id === "outro")?.active).toBe(true);
    expect(servicos.find((s) => s.id === "s-criado-1")).toMatchObject({ durationMin: 0, priceCents: 0 });
    expect(empresa.name).toBe("Ateliê Real"); expect(perfil.serviceRules).toBe(equipeAntes); expect(perfil.plantaoAtivo).toBe(false);
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
    expect(JSON.stringify(db.service.updateMany.mock.calls)).not.toContain("delete");
  });
  it("valida todos os serviços existentes pelo tenant antes de escrever", async () => {
    const e = envelope(); e.rascunho.informacoes.servicos.push({ id: "externo", nome: "Outro", descricao: "", precoModo: "FIXO", precoCents: 1000, duracaoMin: 10, situacao: "CONFIRMADO", origem: "MANUAL" });
    perfil.atendenteConfiguracao = e;
    servicos.push({ id: "externo", companyId: "c2", name: "Outro", durationMin: 10, priceCents: 1000, active: true, suggested: false, order: 0 });
    await expect(publicarConfiguracao("c1", 3)).rejects.toThrow("não pertence");
    expect(db.company.update).not.toHaveBeenCalled(); expect(db.service.create).not.toHaveBeenCalled();
  });
  it("conflito ao gravar envelope desfaz os dados canônicos da transação", async () => {
    perfil.atendenteConfiguracao = envelope(); db.companyProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(publicarConfiguracao("c1", 3)).rejects.toThrow("mudou enquanto");
    expect(empresa.name).toBe("Empresa antes"); expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)).toBeNull();
  });
  it("primeira publicação preserva bloqueios reais ausentes no rascunho antigo", async () => {
    perfil.atendenteConfiguracao = envelope(); perfil.diasFechados = ["2026-11-02"];
    const t = await publicarConfiguracao("c1", 3);
    expect(t.rascunho.informacoes.diasFechados).toEqual(["2026-11-02"]);
    expect(perfil.diasFechados).toEqual(["2026-11-02"]);
  });
  it("republicar pagamento preserva bloqueio feito depois pela Agenda", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3);
    perfil.diasFechados = ["2026-11-02"];
    const e = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    e.rascunho.informacoes.pagamento.valor = "Pix e cartão"; e.revisao = 4;
    e.testes.forEach((t) => { t.revisao = 4; }); perfil.atendenteConfiguracao = e;
    const t = await publicarConfiguracao("c1", 4);
    expect(perfil.paymentMethods).toBe("Pix e cartão");
    expect(perfil.diasFechados).toEqual(["2026-11-02"]);
    expect(t.rascunho.informacoes.diasFechados).toEqual(["2026-11-02"]);
    expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)?.informacoes.diasFechados).toEqual(["2026-11-02"]);
  });
  it("reabertura explícita remove só o dia editado e preserva novos bloqueios externos", async () => {
    const e = envelope(); e.rascunho.informacoes.diasFechados = ["2026-11-02"];
    perfil.atendenteConfiguracao = e; await publicarConfiguracao("c1", 3);
    perfil.diasFechados = ["2026-11-02", "2026-11-15"];
    const editado = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    editado.rascunho.informacoes.diasFechados = []; editado.revisao = 4;
    editado.testes.forEach((t) => { t.revisao = 4; }); perfil.atendenteConfiguracao = editado;
    expect((await publicarConfiguracao("c1", 4)).rascunho.informacoes.diasFechados).toEqual(["2026-11-15"]);
    expect(perfil.diasFechados).toEqual(["2026-11-15"]);
  });
  it("um dia reaberto na Agenda permanece aberto se o rascunho não o alterou", async () => {
    const e = envelope(); e.rascunho.informacoes.diasFechados = ["2026-11-02"];
    perfil.atendenteConfiguracao = e; await publicarConfiguracao("c1", 3);
    perfil.diasFechados = [];
    expect((await publicarConfiguracao("c1", 3)).rascunho.informacoes.diasFechados).toEqual([]);
    expect(perfil.diasFechados).toEqual([]);
  });
  it("ativação exige snapshot atual, conexão e cadastro coerente com a publicação", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3);
    expect(await validarAtivacaoConfiguracao("c1")).toEqual([]);
    perfil.paymentMethods = "Dinheiro (alterado fora da configuração)";
    expect(await validarAtivacaoConfiguracao("c1")).toContainEqual(expect.objectContaining({ campo: "cadastro" }));
    perfil.whatsappStatus = "DISCONNECTED";
    expect(await validarAtivacaoConfiguracao("c1")).toContainEqual(expect.objectContaining({ campo: "conexao" }));
    expect(perfil.plantaoAtivo).toBe(false);
  });
  it("GET sinaliza alteração externa e republicação não sobrescreve o preço invisivelmente", async () => {
    const e = envelope(); e.rascunho.informacoes.servicos.push({ id: "novo:1", nome: "Ajuste", descricao: "Ajuste conforme avaliação", precoModo: "FIXO", precoCents: 4500, duracaoMin: 40, situacao: "CONFIRMADO", origem: "MANUAL" });
    perfil.atendenteConfiguracao = e; await publicarConfiguracao("c1", 3);
    servicos[0].priceCents = 6500;
    const t = await getConfiguracao("c1");
    expect(t.haAlteracoes).toBe(true); expect(t.pendencias).toContainEqual(expect.objectContaining({ campo: "cadastro", bloqueia: true }));
    const draft = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    draft.rascunho.informacoes.pagamento.valor = "Dinheiro"; draft.revisao = 4; draft.testes.forEach((v) => { v.revisao = 4; }); perfil.atendenteConfiguracao = draft;
    await expect(publicarConfiguracao("c1", 4)).rejects.toMatchObject({ status: 409, pendencias: expect.arrayContaining([expect.objectContaining({ campo: "cadastro" })]) });
    expect(servicos[0].priceCents).toBe(6500); expect(perfil.paymentMethods).toBe("Pix");
  });
  it("importar prepara dados atuais para revisão e preserva escolhas e publicação, sem aprovar conhecimento antigo", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3);
    perfil.paymentMethods = "Cartão"; perfil.faqs = [{ question: "Prazo?", answer: "Combinado na avaliação." }];
    servicos.push({ id: "s-novo-agenda", companyId: "c1", name: "Ajuste atual", durationMin: 0, priceCents: 3000, active: true, suggested: false, order: 0 });
    servicos.push({ id: "s-outra-empresa", companyId: "c2", name: "Outro tenant", durationMin: 30, priceCents: 9000, active: true, suggested: false, order: 0 });
    db.knowledgeItem.findMany.mockResolvedValue([{ id: "k-obsoleto", question: "Prazo?", answer: "Uma hora (antigo)." }]);
    const e = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    e.rascunho.negocio.modalidade = "HIBRIDO"; e.rascunho.negocio.objetivo = "SOLICITACOES"; e.rascunho.negocio.regiao = info("Centro");
    e.rascunho.atendimento.nome = "Duda"; e.rascunho.atendimento.jeito = "DIRETO"; perfil.atendenteConfiguracao = e;
    const antesCanonical = clone(perfil); db.knowledgeItem.findMany.mockClear(); db.company.update.mockClear();
    const t = await importarCadastroConfiguracao("c1", 3);
    expect(t.revisao).toBe(4); expect(t.etapa).toBe(0); expect(t.revisadas).toEqual([]); expect(t.testes).toEqual([]);
    expect(t.rascunho.informacoes.pagamento).toMatchObject({ valor: "Cartão", situacao: "REVISAR" });
    expect(t.rascunho.informacoes.servicos).toEqual([expect.objectContaining({ id: "s-novo-agenda", precoCents: 3000, duracaoMin: null, situacao: "REVISAR" })]);
    expect(t.rascunho.negocio).toMatchObject({ modalidade: "HIBRIDO", objetivo: "SOLICITACOES", regiao: info("Centro") });
    expect(t.rascunho.atendimento).toMatchObject({ nome: "Duda", jeito: "DIRETO" });
    expect(t.rascunho.conhecimento.itens).toEqual([expect.objectContaining({ pergunta: "Prazo?", resposta: "Combinado na avaliação.", situacao: "REVISAR" })]);
    expect(db.knowledgeItem.findMany).not.toHaveBeenCalled(); expect(db.company.update).not.toHaveBeenCalled();
    expect(perfil.paymentMethods).toBe(antesCanonical.paymentMethods); expect(perfil.plantaoAtivo).toBe(false);
    expect(lerConfiguracaoPublicada(perfil.atendenteConfiguracao)?.atendimento.nome).toBe("Nexa");
    expect(t.pendencias.some((p) => p.campo === "cadastro")).toBe(false);
  });
  it("após importar e revisar é possível publicar o cadastro atual", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3); perfil.paymentMethods = "Cartão";
    await importarCadastroConfiguracao("c1", 3);
    const e = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    e.rascunho.negocio.descricao.situacao = "CONFIRMADO"; e.rascunho.informacoes.pagamento.situacao = "CONFIRMADO"; e.rascunho.informacoes.horariosSituacao = "CONFIRMADO";
    e.revisadas = [0, 1, 2, 3]; e.testes = envelope().testes.map((t) => ({ ...t, revisao: 4 })); perfil.atendenteConfiguracao = e;
    const t = await publicarConfiguracao("c1", 4);
    expect(t.haAlteracoes).toBe(false); expect(t.pendencias).toEqual([]); expect(perfil.paymentMethods).toBe("Cartão");
    expect((perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa).cadastroBase).toBeUndefined();
  });
  it("nova alteração canônica depois da importação exige importar novamente", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3); perfil.paymentMethods = "Cartão";
    await importarCadastroConfiguracao("c1", 3); perfil.paymentMethods = "Dinheiro";
    expect((await getConfiguracao("c1")).pendencias).toContainEqual(expect.objectContaining({ campo: "cadastro" }));
    await expect(importarCadastroConfiguracao("c1", 3)).rejects.toThrow("outra tela");
    const e = clone(perfil.atendenteConfiguracao) as EnvelopeConfiguracaoNexa;
    e.rascunho.negocio.descricao.situacao = "CONFIRMADO"; e.rascunho.informacoes.pagamento.situacao = "CONFIRMADO"; e.rascunho.informacoes.horariosSituacao = "CONFIRMADO";
    e.revisadas = [0, 1, 2, 3]; e.testes = envelope().testes.map((t) => ({ ...t, revisao: 4 })); perfil.atendenteConfiguracao = e;
    await expect(publicarConfiguracao("c1", 4)).rejects.toMatchObject({ status: 409, pendencias: expect.arrayContaining([expect.objectContaining({ campo: "cadastro" })]) });
    expect(perfil.paymentMethods).toBe("Dinheiro");
  });
  it("bloqueios operacionais não exigem importar cadastro nem impedem ativação", async () => {
    perfil.atendenteConfiguracao = envelope(); await publicarConfiguracao("c1", 3); perfil.diasFechados = ["2026-11-02"];
    const t = await getConfiguracao("c1"); expect(t.haAlteracoes).toBe(false);
    expect(t.pendencias.some((p) => p.campo === "cadastro")).toBe(false); expect(await validarAtivacaoConfiguracao("c1")).toEqual([]);
  });
  it("um rascunho já salvo detecta mudança externa mesmo antes da primeira publicação", async () => {
    await salvarConfiguracao("c1", { revisao: 0, rascunho: config(), etapa: 0 });
    perfil.paymentMethods = "Pagamento alterado fora da configuração";
    expect((await getConfiguracao("c1")).pendencias).toContainEqual(expect.objectContaining({ campo: "cadastro" }));
  });
});
