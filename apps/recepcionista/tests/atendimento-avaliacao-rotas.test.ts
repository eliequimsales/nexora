import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), limit: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionCompanyId: m.session }));
vi.mock("@/lib/limites", () => ({ LIMITES: { leitura: {}, escrita: {} }, limitar: m.limit }));
vi.mock("@/lib/errors", () => ({ logErroSemConteudo: vi.fn() }));
vi.mock("@/lib/atendimento/avaliacao", () => ({ AvaliacaoErro: class extends Error { constructor(message: string, public status: number) { super(message); } }, getAvaliacaoAtendimento: m.get, avaliarAtendimento: m.save }));
import { GET, POST } from "@/app/api/conversations/[id]/avaliacao/route";
import { AvaliacaoErro } from "@/lib/atendimento/avaliacao";
const params = { params: { id: "c1" } };
function request(body = {}, origin = "http://localhost:3002", contentType = "application/json") {
  return new Request("http://localhost:3002/api/conversations/c1/avaliacao", { method: "POST", headers: { origin, "Content-Type": contentType }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue("empresa-sessao"); m.limit.mockReturnValue(true); m.get.mockResolvedValue({ evaluation: null, lastMessageId: "m" }); m.save.mockResolvedValue({ id: "e" }); });
describe("rotas de avaliação", () => {
  it("origem cruzada é barrada antes de consultar sessão e gravar", async () => {
    expect((await POST(request({}, "https://outra.invalid"), params)).status).toBe(403);
    expect(m.session).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled();
  });
  it("exige JSON", async () => { expect((await POST(request({}, "http://localhost:3002", "text/plain"), params)).status).toBe(415); });
  it("não lê ou grava sem autenticação", async () => {
    m.session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost:3002"), params)).status).toBe(401);
    expect((await POST(request(), params)).status).toBe(401);
    expect(m.save).not.toHaveBeenCalled(); expect(m.get).not.toHaveBeenCalled();
  });
  it("usa a empresa da sessão e não guarda cache de contexto", async () => {
    const response = await GET(new Request("http://localhost:3002"), params);
    expect(m.get).toHaveBeenCalledWith("empresa-sessao", "c1"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("salvamento devolve sucesso apenas após persistência confirmada", async () => {
    const body = { outcome: "DESCONHECIDO" };
    expect((await POST(request(body), params)).status).toBe(200);
    expect(m.save).toHaveBeenCalledWith("empresa-sessao", "c1", body);
  });
  it("preserva conflito para a tela pedir leitura das novas mensagens", async () => {
    m.save.mockRejectedValue(new AvaliacaoErro("Chegaram novas mensagens.", 409));
    expect((await POST(request(), params)).status).toBe(409);
  });
  it("limita escrita e não executa a persistência", async () => { m.limit.mockReturnValue(false); expect((await POST(request(), params)).status).toBe(429); expect(m.save).not.toHaveBeenCalled(); });
});
