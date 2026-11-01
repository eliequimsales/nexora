import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { knowledgeItem: { findMany: vi.fn() } } }));
import { prisma } from "@/lib/db";
import { getApprovedKnowledge } from "@/lib/training";
import { selecionarConhecimentoRelevante } from "@/lib/atendente/recuperacao-conhecimento";
beforeEach(() => { vi.clearAllMocks(); });
describe("recuperação de fontes aprovadas", () => {
  const documentos = [
    { question: "Como pagar?", answer: "Aceitamos Pix." },
    { question: "Onde estacionar?", answer: "Há estacionamento conveniado na Rua A." },
    { question: "Quanto dura a massagem esportiva?", answer: "A massagem esportiva dura 45 minutos." },
  ];
  it("encontra equivalência explícita de linguagem", () => expect(selecionarConhecimentoRelevante(documentos, "Tem vaga para carro?")[0]).toEqual(documentos[1]));
  it("prioriza serviço relevante e preserva literalmente a fonte", () => expect(selecionarConhecimentoRelevante(documentos, "Qual a duração da massagem esportiva?", 1)).toEqual([documentos[2]]));
  it("não usa fonte sem termo relevante como resposta conhecida", () => expect(selecionarConhecimentoRelevante(documentos, "Existe manobrista? ")).toEqual([]));
  it("não permite que duplicação altere a resposta", () => expect(selecionarConhecimentoRelevante([documentos[0], documentos[0]], "Como pagar?")).toEqual([documentos[0]]));
  it("omite conflito aprovado até esclarecimento do responsável", () => expect(selecionarConhecimentoRelevante([{ question: "Tem estacionamento?", answer: "Sim." }, { question: "Tem estacionamento", answer: "Não." }], "Tem estacionamento?")).toEqual([]));
  it("não confunde respostas com negacão diferente", () => expect(selecionarConhecimentoRelevante([{ question: "Aceitam Pix?", answer: "Aceitamos Pix." }, { question: "Aceitam Pix?", answer: "Não aceitamos Pix." }], "Pix")).toEqual([]));
  it("limite da resposta não impede encontrar fonte antiga depois de centenas de recentes", async () => {
    const itens = Array.from({length: 200}, (_, n) => ({ question: `Produto modelo ${n}`, answer: "Consulte a equipe." })); itens.push(documentos[1]);
    vi.mocked(prisma.knowledgeItem.findMany).mockResolvedValue(itens as never);
    expect(await getApprovedKnowledge("empresa-autorizada", 5, "Onde estacionar?")).toContainEqual(documentos[1]);
    expect(prisma.knowledgeItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "empresa-autorizada", status: "APPROVED" } }));
    expect(vi.mocked(prisma.knowledgeItem.findMany).mock.calls[0][0]).not.toHaveProperty("take");
  });
  it("mantém limite e compatibilidade na leitura sem pergunta", () => expect(selecionarConhecimentoRelevante(documentos, undefined, 2)).toHaveLength(2));
});
