import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/training", () => ({ reviewKnowledgeItem: vi.fn(), deleteKnowledgeItem: vi.fn(), teachAnswer: vi.fn() }));
vi.mock("@/lib/limites", () => ({ limitar: vi.fn(() => true), LIMITES: { escrita: {}, ia: {} } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
import { getSessionCompanyId } from "@/lib/auth";
import { deleteKnowledgeItem, reviewKnowledgeItem, teachAnswer } from "@/lib/training";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { PATCH, DELETE } from "@/app/api/training/items/[id]/route";
import { POST } from "@/app/api/training/teach/route";
const req = (method: string, body?: unknown, origin = "http://localhost:3002") => new Request("http://localhost:3002/api/training/items/item1", {
  method, headers: { origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSessionCompanyId).mockResolvedValue("empresa-da-sessao"); });

describe("ensino e revisão usam sincronização do rascunho da empresa autenticada", () => {
  it("revisão encaminha edição exata, com empresa da sessão", async () => {
    const r = await PATCH(req("PATCH", { action: "aprovar", question: "Há estacionamento?", answer: "Não temos estacionamento." }), { params: { id: "item1" } });
    expect(r.status).toBe(200);
    expect(reviewKnowledgeItem).toHaveBeenCalledWith("empresa-da-sessao", "item1", "aprovar", { question: "Há estacionamento?", answer: "Não temos estacionamento." });
  });
  it("exclusão usa o caminho que retira do rascunho e preserva a publicação", async () => {
    expect((await DELETE(req("DELETE"), { params: { id: "item1" } })).status).toBe(200);
    expect(deleteKnowledgeItem).toHaveBeenCalledWith("empresa-da-sessao", "item1");
  });
  it("ensino usa uma gravação transacional, sem executar estruturação livre", async () => {
    const entrada = { question: "Tem estacionamento?", answer: "Não temos estacionamento." };
    expect((await POST(req("POST", entrada))).status).toBe(200);
    expect(teachAnswer).toHaveBeenCalledWith("empresa-da-sessao", entrada);
  });
  it.each(["PATCH", "DELETE"])("%s rejeita origem cruzada antes de consultar a conta", async (metodo) => {
    const r = metodo === "PATCH" ? await PATCH(req("PATCH", { action: "aprovar" }, "https://outro.invalid"), { params: { id: "item1" } }) : await DELETE(req("DELETE", undefined, "https://outro.invalid"), { params: { id: "item1" } });
    expect(r.status).toBe(403); expect(getSessionCompanyId).not.toHaveBeenCalled();
    expect(reviewKnowledgeItem).not.toHaveBeenCalled(); expect(deleteKnowledgeItem).not.toHaveBeenCalled();
  });
  it("não escreve sem sessão", async () => {
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await PATCH(req("PATCH", { action: "aprovar" }), { params: { id: "item1" } })).status).toBe(401);
    expect((await DELETE(req("DELETE"), { params: { id: "item1" } })).status).toBe(401);
    expect(deleteKnowledgeItem).not.toHaveBeenCalled(); expect(reviewKnowledgeItem).not.toHaveBeenCalled();
  });
  it("conflito da versão não aparece como sucesso nem erro genérico", async () => {
    vi.mocked(reviewKnowledgeItem).mockRejectedValueOnce(new ConfiguracaoErro("A configuração mudou. Recarregue.", 409));
    const r = await PATCH(req("PATCH", { action: "aprovar" }), { params: { id: "item1" } });
    expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ error: "A configuração mudou. Recarregue." });
  });
});
