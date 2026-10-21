import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/limites", () => ({ limitar: vi.fn(), LIMITES: { leitura: {}, escrita: {} } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/atendente/configuracao", async (original) => {
  const real = await original<typeof import("@/lib/atendente/configuracao")>();
  return { ...real, getConfiguracao: vi.fn(), salvarConfiguracao: vi.fn(), publicarConfiguracao: vi.fn(), confirmarTesteConfiguracao: vi.fn(), importarCadastroConfiguracao: vi.fn() };
});
import { getSessionCompanyId } from "@/lib/auth";
import { limitar } from "@/lib/limites";
import { ConfiguracaoErro, confirmarTesteConfiguracao, getConfiguracao, importarCadastroConfiguracao, publicarConfiguracao, salvarConfiguracao } from "@/lib/atendente/configuracao";
import { GET, POST, PUT } from "@/app/api/atendente/configuracao/route";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

function req(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3002/api/atendente/configuracao", { method, headers: { origin: "http://localhost:3002", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSessionCompanyId).mockResolvedValue("c-sessao"); vi.mocked(limitar).mockReturnValue(true); });

describe("API de configuração isolada pela sessão", () => {
  it.each([GET, PUT, POST])("exige autenticação", async (handler) => {
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await handler(req(handler === GET ? "GET" : handler === PUT ? "PUT" : "POST", handler === GET ? undefined : {}))).status).toBe(401);
    expect(getConfiguracao).not.toHaveBeenCalled(); expect(publicarConfiguracao).not.toHaveBeenCalled();
  });
  it("limita leituras e escritas autenticadas", async () => {
    vi.mocked(limitar).mockReturnValue(false);
    expect((await GET(req("GET"))).status).toBe(429); expect((await POST(req("POST", {}))).status).toBe(429);
  });
  it("lê somente a empresa da sessão", async () => {
    vi.mocked(getConfiguracao).mockResolvedValue({ revisao: 4 } as Awaited<ReturnType<typeof getConfiguracao>>);
    const resposta = await GET(req("GET")); expect(resposta.status).toBe(200); expect(await resposta.json()).toEqual({ revisao: 4 });
    expect(getConfiguracao).toHaveBeenCalledWith("c-sessao");
  });
  it("publicação e revisão não aceitam sobrescrever tenant pelo corpo", async () => {
    expect((await POST(req("POST", { acao: "PUBLICAR", revisao: 4, companyId: "outra" }))).status).toBe(400);
    expect((await PUT(req("PUT", { revisao: 4, etapa: 1, rascunho: {} }))).status).toBe(400);
    expect(publicarConfiguracao).not.toHaveBeenCalled(); expect(salvarConfiguracao).not.toHaveBeenCalled();
  });
  it("encaminha grupo e destino completos em uma única chamada da empresa autenticada", async () => {
    const input = { revisao: 4, etapa: 4, rascunho: configuracaoExemplo(), concluirEtapas: [2, 3] };
    vi.mocked(salvarConfiguracao).mockResolvedValue({ revisao: 4, etapa: 4, revisadas: [0, 1, 2, 3] } as Awaited<ReturnType<typeof getConfiguracao>>);
    const resposta = await PUT(req("PUT", input));
    expect(resposta.status).toBe(200); expect(await resposta.json()).toMatchObject({ etapa: 4, revisadas: [0, 1, 2, 3] });
    expect(salvarConfiguracao).toHaveBeenCalledTimes(1); expect(salvarConfiguracao).toHaveBeenCalledWith("c-sessao", input);
  });
  it.each([
    { concluirEtapas: [] }, { concluirEtapas: [0, 0] }, { concluirEtapas: [4] },
    { concluirEtapas: [0, 1], concluirEtapa: true },
  ])("recusa conclusão inválida ou ambígua antes de salvar (%j)", async (conclusao) => {
    const resposta = await PUT(req("PUT", { revisao: 4, etapa: 2, rascunho: configuracaoExemplo(), ...conclusao }));
    expect(resposta.status).toBe(400); expect(await resposta.json()).toMatchObject({ pendencias: expect.any(Array) });
    expect(salvarConfiguracao).not.toHaveBeenCalled();
  });
  it("bloqueia formulários e origem cruzada antes de qualquer mutação", async () => {
    expect((await POST(req("POST", { acao: "PUBLICAR", revisao: 4 }, { origin: "https://site-invasor.invalid" }))).status).toBe(403);
    expect((await PUT(req("PUT", {}, { "content-type": "text/plain" }))).status).toBe(415);
    expect(publicarConfiguracao).not.toHaveBeenCalled(); expect(salvarConfiguracao).not.toHaveBeenCalled();
  });
  it("retorna conflito e pendências compreensíveis sem publicação", async () => {
    vi.mocked(publicarConfiguracao).mockRejectedValue(new ConfiguracaoErro("Revise os testes.", 409, [{ campo: "teste:HUMANO", etapa: 4, mensagem: "Confira a resposta.", bloqueia: true }]));
    const r = await POST(req("POST", { acao: "PUBLICAR", revisao: 4 }));
    expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ error: "Revise os testes.", pendencias: [{ campo: "teste:HUMANO" }] });
    expect(publicarConfiguracao).toHaveBeenCalledWith("c-sessao", 4);
  });
  it("revisão usa o recibo da simulação da empresa autenticada", async () => {
    vi.mocked(confirmarTesteConfiguracao).mockResolvedValue({ revisao: 4 } as Awaited<ReturnType<typeof getConfiguracao>>);
    expect((await POST(req("POST", { acao: "REVISAR_TESTE", revisao: 4, testeId: "teste:recibo", correto: false }))).status).toBe(200);
    expect(confirmarTesteConfiguracao).toHaveBeenCalledWith("c-sessao", { acao: "REVISAR_TESTE", revisao: 4, testeId: "teste:recibo", correto: false });
  });
  it("conflito serializável orienta recarregar com 409", async () => {
    vi.mocked(publicarConfiguracao).mockRejectedValue({ code: "P2034" });
    expect((await POST(req("POST", { acao: "PUBLICAR", revisao: 4 }))).status).toBe(409);
  });
  it("importação explícita usa a sessão e revisão atual", async () => {
    vi.mocked(importarCadastroConfiguracao).mockResolvedValue({ revisao: 5 } as Awaited<ReturnType<typeof getConfiguracao>>);
    expect((await POST(req("POST", { acao: "IMPORTAR_CADASTRO", revisao: 4 }))).status).toBe(200);
    expect(importarCadastroConfiguracao).toHaveBeenCalledWith("c-sessao", 4);
    expect((await POST(req("POST", { acao: "IMPORTAR_CADASTRO", revisao: 4, companyId: "outra" }))).status).toBe(400);
  });
});
