import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@nexora/recepcionista-prisma";
import type { EnvelopeConfiguracaoNexa } from "@/lib/atendente/configuracao";

vi.mock("@/lib/db", () => ({ prisma: {
  companyProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
  knowledgeItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  knowledgeGap: { findFirst: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn(),
} }));
import { prisma } from "@/lib/db";
import { atualizarConhecimentoNoEnvelope } from "@/lib/atendente/conhecimento-configuracao";
import { aplicarConfiguracaoAosFatos } from "@/lib/atendente/configuracao-fatos";
import { catalogoDeRespostas, validarSelecaoDeFontes } from "@/lib/atendente/conhecimento";
import { deleteKnowledgeItem, reviewKnowledgeItem, teachAnswer } from "@/lib/training";
import { configuracaoExemplo, fatosExemplo } from "./fixtures/configuracao-nexa";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  companyProfile: { findUnique: Fn; updateMany: Fn };
  knowledgeItem: { findFirst: Fn; create: Fn; update: Fn; deleteMany: Fn };
  knowledgeGap: { findFirst: Fn; updateMany: Fn }; $transaction: Fn;
};
type Item = { id: string; companyId: string; question: string; answer: string; status: string; gapId?: string | null };
let itens: Item[];
let perfil: { atendenteConfiguracao: unknown; outraPreferencia: string; faqs: unknown };
let lacunaRespondida: boolean;
let conflito: boolean;
const copia = <T>(v: T): T => structuredClone(v);
const itemNovo = { id: "k-novo", question: "Há estacionamento?", answer: "Há estacionamento conveniado ao lado." };

function envelope(): EnvelopeConfiguracaoNexa {
  const c = configuracaoExemplo();
  return {
    versao: 1, revisao: 7, etapa: 4, revisadas: [0, 1, 2, 3, 4], rascunho: c,
    testes: [{ id: "teste:informacoes", cenario: "INFORMACOES", revisao: 7, em: "2026-10-26T12:00:00Z",
      pergunta: "Há estacionamento?", respostas: ["Não há estacionamento próprio."], correto: true }],
    publicado: { revisao: 7, em: "2026-10-26T12:00:00Z", rascunho: copia(c) },
  };
}

beforeEach(() => {
  vi.clearAllMocks(); itens = []; lacunaRespondida = false; conflito = false;
  const e = envelope();
  perfil = { atendenteConfiguracao: e, outraPreferencia: "preservar",
    faqs: e.publicado!.rascunho.conhecimento.itens.map(i => ({ question: i.pergunta, answer: i.resposta })) };
  db.companyProfile.findUnique.mockImplementation(async ({ where }: { where: { companyId: string } }) =>
    where.companyId === "empresa1" ? copia(perfil) : null);
  db.companyProfile.updateMany.mockImplementation(async ({ where, data }: { where: { companyId: string; atendenteConfiguracao: { equals: unknown } }; data: Record<string, unknown> }) => {
    if (conflito || where.companyId !== "empresa1" || JSON.stringify(where.atendenteConfiguracao.equals) !== JSON.stringify(perfil.atendenteConfiguracao)) return { count: 0 };
    Object.assign(perfil, copia(data)); return { count: 1 };
  });
  db.knowledgeItem.findFirst.mockImplementation(async ({ where }: { where: { companyId: string; id: string } }) =>
    copia(itens.find((i) => i.id === where.id && i.companyId === where.companyId) ?? null));
  db.knowledgeItem.create.mockImplementation(async ({ data }: { data: Omit<Item, "id"> }) => {
    const item = { ...copia(data), id: `k-${itens.length + 1}` }; itens.push(item); return copia(item);
  });
  db.knowledgeItem.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Item> }) => {
    const i = itens.find((v) => v.id === where.id)!; Object.assign(i, copia(data)); return copia(i);
  });
  db.knowledgeItem.deleteMany.mockImplementation(async ({ where }: { where: { companyId: string; id: string } }) => {
    const antes = itens.length; itens = itens.filter((i) => i.companyId !== where.companyId || i.id !== where.id); return { count: antes - itens.length };
  });
  db.knowledgeGap.findFirst.mockImplementation(async ({ where }: { where: { companyId: string; id: string } }) =>
    where.companyId === "empresa1" && where.id === "gap1" ? { id: "gap1", companyId: "empresa1" } : null);
  db.knowledgeGap.updateMany.mockImplementation(async () => { lacunaRespondida = true; return { count: 1 }; });
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const antes = { itens: copia(itens), perfil: copia(perfil), lacunaRespondida };
    try { return await fn(db); } catch (e) { itens = antes.itens; perfil = antes.perfil; lacunaRespondida = antes.lacunaRespondida; throw e; }
  });
});

describe("conhecimento explicitamente aprovado atualiza somente sua origem em cada versão", () => {
  it("acrescenta apenas o novo item à publicação existente e preserva os demais campos", () => {
    const antes = envelope(); const novo = atualizarConhecimentoNoEnvelope(antes, itemNovo, "APROVAR");
    expect(novo.revisao).toBe(8); expect(novo.testes).toEqual([]); expect(novo.revisadas).toEqual([0, 1, 2]);
    expect(novo.publicado!.rascunho).toEqual({ ...antes.publicado!.rascunho,
      conhecimento: { itens: novo.rascunho.conhecimento.itens } });
    expect(novo.publicado!.revisao).toBe(8); expect(novo.historico).toEqual([antes.publicado]);
    expect(novo.rascunho.conhecimento.itens).toEqual([...antes.rascunho.conhecimento.itens,
      { id: "conhecimento:k-novo", pergunta: itemNovo.question, resposta: itemNovo.answer, situacao: "CONFIRMADO", origem: "MANUAL" }]);
    expect(antes.rascunho.conhecimento.itens).toHaveLength(1);
  });
  it("atualiza pelo ID da origem e não substitui outra resposta com pergunta parecida", () => {
    const antes = atualizarConhecimentoNoEnvelope(envelope(), itemNovo, "APROVAR");
    const novo = atualizarConhecimentoNoEnvelope(antes, { ...itemNovo, answer: "Agora não há convênio." }, "APROVAR");
    expect(novo.rascunho.conhecimento.itens).toHaveLength(2);
    expect(novo.rascunho.conhecimento.itens[0].resposta).toBe("Não há estacionamento próprio.");
    expect(novo.rascunho.conhecimento.itens[1].resposta).toBe("Agora não há convênio.");
  });
  it("aprovação repetida da mesma versão não invalida testes novamente", () => {
    const antes = atualizarConhecimentoNoEnvelope(envelope(), itemNovo, "APROVAR");
    antes.testes = envelope().testes;
    expect(atualizarConhecimentoNoEnvelope(antes, itemNovo, "APROVAR")).toBe(antes);
  });
  it("não reimporta item removido só porque outro foi aprovado", () => {
    const antes = envelope(); antes.rascunho.conhecimento.itens = [];
    const novo = atualizarConhecimentoNoEnvelope(antes, itemNovo, "APROVAR");
    expect(novo.rascunho.conhecimento.itens.map((i) => i.id)).toEqual(["conhecimento:k-novo"]);
    expect(novo.publicado!.rascunho.conhecimento.itens).toHaveLength(2);
    expect(novo.publicado!.rascunho.conhecimento.itens[0]).toEqual(antes.publicado!.rascunho.conhecimento.itens[0]);
  });
  it("remoção atinge somente a origem no rascunho e no snapshot ativo", () => {
    const antes = atualizarConhecimentoNoEnvelope(envelope(), itemNovo, "APROVAR");
    const novo = atualizarConhecimentoNoEnvelope(antes, itemNovo, "REMOVER");
    expect(novo.rascunho.conhecimento.itens).toEqual(envelope().rascunho.conhecimento.itens);
    expect(novo.publicado!.rascunho).toEqual(envelope().publicado!.rascunho);
    expect(novo.revisao).toBe(9);
  });
  it("remover origem não presente não muda a versão", () => {
    const e = envelope(); expect(atualizarConhecimentoNoEnvelope(e, itemNovo, "REMOVER")).toBe(e);
  });
  it("não publica outras alterações e informações em revisão do rascunho", () => {
    const e = envelope(); const ativa = copia(e.publicado!.rascunho);
    e.rascunho.negocio.nome = "Nome ainda em preparação";
    e.rascunho.informacoes.servicos[0].precoCents = 99999;
    e.rascunho.conhecimento.itens[0] = { ...e.rascunho.conhecimento.itens[0], resposta: "Rascunho em revisão", situacao: "REVISAR" };
    const novo = atualizarConhecimentoNoEnvelope(e, itemNovo, "APROVAR");
    expect(novo.rascunho.negocio.nome).toBe("Nome ainda em preparação");
    expect(novo.publicado!.rascunho.negocio).toEqual(ativa.negocio);
    expect(novo.publicado!.rascunho.informacoes).toEqual(ativa.informacoes);
    expect(novo.publicado!.rascunho.conhecimento.itens[0]).toEqual(ativa.conhecimento.itens[0]);
  });
  it("não cria primeira publicação ao ensinar para uma configuração nova", () => {
    const e = envelope(); e.publicado = null;
    const novo = atualizarConhecimentoNoEnvelope(e, itemNovo, "APROVAR");
    expect(novo.publicado).toBeNull(); expect(novo.rascunho.conhecimento.itens).toHaveLength(2);
  });
  it("retira a origem ativa mesmo quando ela já foi removida do rascunho", () => {
    const e = atualizarConhecimentoNoEnvelope(envelope(), itemNovo, "APROVAR");
    e.rascunho.conhecimento.itens = e.rascunho.conhecimento.itens.filter(i => i.id !== "conhecimento:k-novo");
    const novo = atualizarConhecimentoNoEnvelope(e, itemNovo, "REMOVER");
    expect(novo.publicado!.rascunho.conhecimento.itens.some(i => i.id === "conhecimento:k-novo")).toBe(false);
  });
  it("recusa exceder o limite sem apagar as respostas existentes", () => {
    const e = envelope(); e.rascunho.conhecimento.itens = Array.from({ length: 150 }, (_, i) => ({
      id: `novo:${i}`, pergunta: `Pergunta ${i}`, resposta: `Resposta ${i}`, situacao: "CONFIRMADO", origem: "MANUAL",
    }));
    expect(() => atualizarConhecimentoNoEnvelope(e, itemNovo, "APROVAR")).toThrow("quantidade");
    expect(e.rascunho.conhecimento.itens).toHaveLength(150);
  });
});

describe("aprovação e sincronização são atômicas e isoladas por empresa", () => {
  it("lacuna ensinada entra na fonte ativa e encerra a pendência numa transação serializável", async () => {
    const publicada = copia((perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa).publicado);
    const salvo = await teachAnswer("empresa1", { gapId: "gap1", question: " Aceitam animais? ", answer: " Apenas animais de assistência. " });
    expect(salvo.question).toBe("Aceitam animais?"); expect(itens).toHaveLength(1); expect(lacunaRespondida).toBe(true);
    const e = perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa;
    expect(e.rascunho.conhecimento.itens.at(-1)).toMatchObject({ id: "conhecimento:k-1", resposta: "Apenas animais de assistência." });
    expect(e.publicado!.rascunho.informacoes).toEqual(publicada!.rascunho.informacoes);
    const fontes = catalogoDeRespostas(aplicarConfiguracaoAosFatos(e.publicado!.rascunho, fatosExemplo));
    const fonte = fontes.find(f => f.texto === "Apenas animais de assistência.")!;
    expect(fonte).toBeDefined();
    expect(validarSelecaoDeFontes({ fontes_ids: [fonte.id], duvida_pendente: false }, fontes)?.fontes[0].texto)
      .toBe("Apenas animais de assistência.");
    expect(perfil.faqs).toEqual(e.publicado!.rascunho.conhecimento.itens.map(i => ({ question: i.pergunta, answer: i.resposta })));
    expect(perfil.outraPreferencia).toBe("preservar");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(db.companyProfile.updateMany.mock.calls[0][0].where.companyId).toBe("empresa1");
  });
  it("conflito com outra alteração desfaz também o item e a lacuna", async () => {
    conflito = true; const antes = copia(perfil);
    await expect(teachAnswer("empresa1", { gapId: "gap1", question: "Qual prazo?", answer: "Dois dias úteis." })).rejects.toMatchObject({ status: 409 });
    expect(itens).toEqual([]); expect(lacunaRespondida).toBe(false); expect(perfil).toEqual(antes);
  });
  it("configuração corrompida não confirma uma aprovação parcial", async () => {
    perfil.atendenteConfiguracao = { versao: "inválida" };
    await expect(teachAnswer("empresa1", { question: "Qual prazo?", answer: "Dois dias." })).rejects.toMatchObject({ status: 409 });
    expect(itens).toEqual([]); expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("conta anterior às versões mantém o acervo aprovado sem criar publicação", async () => {
    perfil.atendenteConfiguracao = null;
    await teachAnswer("empresa1", { question: "Qual prazo?", answer: "Dois dias." });
    expect(itens[0].status).toBe("APPROVED"); expect(perfil.atendenteConfiguracao).toBeNull();
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("uma lacuna de outra empresa não autoriza gravar conhecimento", async () => {
    await expect(teachAnswer("empresa1", { gapId: "gap-outra", question: "Qual prazo?", answer: "Dois dias." })).rejects.toThrow("Dúvida não encontrada");
    expect(itens).toEqual([]); expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("aprovar observação usa somente a resposta explicitamente revisada", async () => {
    itens.push({ id: "observacao1", companyId: "empresa1", question: "Parcelam?", answer: "Talvez em 12x.", status: "OBSERVED", gapId: "gap1" });
    await reviewKnowledgeItem("empresa1", "observacao1", "aprovar", { answer: "Parcelamos em 3x no cartão." });
    expect(itens[0].status).toBe("APPROVED"); expect(lacunaRespondida).toBe(true);
    const e = perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa;
    expect(e.rascunho.conhecimento.itens.at(-1)?.resposta).toBe("Parcelamos em 3x no cartão.");
    expect(e.publicado!.rascunho.conhecimento.itens.some((i) => i.resposta.includes("3x"))).toBe(true);
    expect(e.publicado!.rascunho.conhecimento.itens.some((i) => i.resposta.includes("12x"))).toBe(false);
  });
  it("rejeitar observação nunca a inclui na configuração", async () => {
    itens.push({ id: "observacao1", companyId: "empresa1", question: "Parcelam?", answer: "Talvez em 12x.", status: "OBSERVED" });
    const antes = copia(perfil);
    await reviewKnowledgeItem("empresa1", "observacao1", "rejeitar");
    expect(itens[0].status).toBe("REJECTED"); expect(perfil).toEqual(antes);
  });
  it("aprovação de item de outra empresa não altera nenhum dado", async () => {
    itens.push({ id: "observacao1", companyId: "outra", question: "Parcelam?", answer: "Em 12x.", status: "OBSERVED" });
    await expect(reviewKnowledgeItem("empresa1", "observacao1", "aprovar")).rejects.toThrow("Item não encontrado");
    expect(itens[0].status).toBe("OBSERVED"); expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
  it("excluir conhecimento retira do uso ativo e evita exclusão cruzada", async () => {
    await teachAnswer("empresa1", { question: "Qual prazo?", answer: "Dois dias." });
    const publicado = copia((perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa).publicado);
    await deleteKnowledgeItem("outra", "k-1"); expect(itens).toHaveLength(1);
    await deleteKnowledgeItem("empresa1", "k-1"); expect(itens).toEqual([]);
    const e = perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa;
    expect(e.rascunho.conhecimento.itens.some((i) => i.id === "conhecimento:k-1")).toBe(false);
    expect(e.publicado!.rascunho.conhecimento.itens.some((i) => i.id === "conhecimento:k-1")).toBe(false);
    expect(e.publicado!.rascunho.informacoes).toEqual(publicado!.rascunho.informacoes);
    expect(perfil.faqs).toEqual(e.publicado!.rascunho.conhecimento.itens.map(i => ({ question: i.pergunta, answer: i.resposta })));
  });
  it("não sobrescreve uma edição externa divergente das perguntas operacionais", async () => {
    const externo = [{ question: "Pergunta alterada em outra área", answer: "Aguardando conferência" }];
    perfil.faqs = copia(externo);
    await teachAnswer("empresa1", { question: "Qual prazo?", answer: "Dois dias." });
    expect(perfil.faqs).toEqual(externo);
    expect((perfil.atendenteConfiguracao as EnvelopeConfiguracaoNexa).publicado!.rascunho.conhecimento.itens.at(-1)?.resposta).toBe("Dois dias.");
  });
});

describe("descrição de serviço integra o conhecimento realmente confirmado", () => {
  it("expõe descrição com ID do serviço e não cria preço ou duração novos", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].descricao = "Revisão dos freios e da transmissão.";
    const f = aplicarConfiguracaoAosFatos(c, fatosExemplo); const fontes = catalogoDeRespostas(f);
    const selecao = validarSelecaoDeFontes({ fontes_ids: ["servico:servico1:descricao"], duvida_pendente: false }, fontes);
    expect(selecao?.fontes[0].texto).toBe("Revisão: Revisão dos freios e da transmissão.");
    expect(selecao?.fontes[0].texto).not.toMatch(/R\$|minutos/);
    expect(fontes.find((i) => i.id === "servico:servico1:preco")?.texto).toContain("99,00");
  });
  it("descrição não confirmada ou ausente não vira fonte de resposta", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].situacao = "REVISAR";
    expect(catalogoDeRespostas(aplicarConfiguracaoAosFatos(c, fatosExemplo)).some((i) => i.id === "servico:servico1:descricao")).toBe(false);
    expect(catalogoDeRespostas({ ...fatosExemplo, servicos: [{ id: "s1", nome: "Serviço", precoCents: 0, duracaoMin: 0 }] })
      .some((i) => i.id === "servico:s1:descricao")).toBe(false);
  });
});
