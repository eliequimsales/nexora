import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/limites", () => ({ limitar: vi.fn(), LIMITES: { leitura: { limit: 120, windowMs: 300_000 } } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/atendente/conversa", async original => {
  const real = await original<typeof import("@/lib/atendente/conversa")>();
  return { ...real, conversarConfiguracao: vi.fn(), getConversaConfiguracao: vi.fn() };
});
import { getSessionCompanyId } from "@/lib/auth";
import { limitar } from "@/lib/limites";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { conversarConfiguracao, getConversaConfiguracao } from "@/lib/atendente/conversa";
import { GET, POST } from "@/app/api/atendente/configuracao/conversa/route";
const entrada = { revisao: 1, mensagemId: "25110d83-33c2-4573-84e9-27bfbc9b6d9d", texto: "Pix e cartão", perguntaChave: "informacoes.pagamento" };
function req(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3002/api/atendente/configuracao/conversa", { method, headers: { origin: "http://localhost:3002", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSessionCompanyId).mockResolvedValue("empresa-sessao"); vi.mocked(limitar).mockReturnValue(true); });
describe("rota autenticada de configuração por conversa", () => {
  it.each([GET, POST])("exige sessão", async handler => {
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await handler(req(handler === GET ? "GET" : "POST", handler === GET ? undefined : entrada))).status).toBe(401);
    expect(conversarConfiguracao).not.toHaveBeenCalled(); expect(getConversaConfiguracao).not.toHaveBeenCalled();
  });
  it("usa somente empresa da sessão e impede cache de conversa privada", async () => {
    vi.mocked(getConversaConfiguracao).mockResolvedValue({ mensagens: [] } as never);
    const r = await GET(req("GET")); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store");
    expect(getConversaConfiguracao).toHaveBeenCalledWith("empresa-sessao");
  });
  it("abre o tópico escolhido sem trocar a empresa autenticada", async () => {
    vi.mocked(getConversaConfiguracao).mockResolvedValue({ mensagens: [] } as never);
    const r = await GET(new Request("http://localhost:3002/api/atendente/configuracao/conversa?topico=SERVICOS"));
    expect(r.status).toBe(200);
    expect(getConversaConfiguracao).toHaveBeenCalledWith("empresa-sessao", "SERVICOS");
  });
  it("recusa um tópico inexistente sem ler nem gravar outra conversa", async () => {
    const r = await GET(new Request("http://localhost:3002/api/atendente/configuracao/conversa?topico=OUTRA_EMPRESA"));
    expect(r.status).toBe(400); expect(getConversaConfiguracao).not.toHaveBeenCalled();
    expect((await POST(req("POST", { ...entrada, topico: "OUTRA_EMPRESA" }))).status).toBe(400);
    expect(conversarConfiguracao).not.toHaveBeenCalled();
  });
  it("mantém o tópico no recibo da mensagem", async () => {
    vi.mocked(conversarConfiguracao).mockResolvedValue({ mensagens: [] } as never);
    expect((await POST(req("POST", { ...entrada, topico: "FUNCIONAMENTO" }))).status).toBe(200);
    expect(conversarConfiguracao).toHaveBeenCalledWith("empresa-sessao", { ...entrada, topico: "FUNCIONAMENTO" });
  });
  it("valida origem antes de salvar", async () => {
    expect((await POST(req("POST", entrada, { origin: "https://outra.invalid" }))).status).toBe(403);
    expect((await POST(req("POST", entrada, { "content-type": "text/plain" }))).status).toBe(415);
    expect(conversarConfiguracao).not.toHaveBeenCalled();
  });
  it("encaminha recibo, pergunta e revisão sem permitir companyId no corpo", async () => {
    vi.mocked(conversarConfiguracao).mockResolvedValue({ mensagens: [] } as never);
    expect((await POST(req("POST", entrada))).status).toBe(200);
    expect(conversarConfiguracao).toHaveBeenCalledWith("empresa-sessao", entrada);
    expect((await POST(req("POST", { ...entrada, companyId: "outra" }))).status).toBe(400);
    expect(conversarConfiguracao).toHaveBeenCalledTimes(1);
  });
  it.each([{ ...entrada, perguntaChave: undefined }, { ...entrada, texto: "" }, { ...entrada, texto: "a".repeat(6001) }, { ...entrada, mensagemId: "qualquer" }])("recusa mensagem fora do contrato", async input => {
    expect((await POST(req("POST", input))).status).toBe(400); expect(conversarConfiguracao).not.toHaveBeenCalled();
  });
  it("limita chamadas antes de interpretação", async () => {
    vi.mocked(limitar).mockReturnValue(false);
    expect((await POST(req("POST", entrada))).status).toBe(429); expect(conversarConfiguracao).not.toHaveBeenCalled();
  });
  it("devolve conflito compreensível sem fingir salvamento", async () => {
    vi.mocked(conversarConfiguracao).mockRejectedValue(new ConfiguracaoErro("A conversa avançou em outra tela.", 409));
    const r = await POST(req("POST", entrada)); expect(r.status).toBe(409); expect(await r.json()).toEqual({ error: "A conversa avançou em outra tela." });
  });
});
