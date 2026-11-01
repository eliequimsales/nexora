import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectInstance, createInstance } from "@/lib/whatsapp/evolution";

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EVOLUTION_API_URL", "https://gateway.example");
  vi.stubEnv("EVOLUTION_API_KEY", "chave-apenas-de-teste");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("gateway não reconstrói sessão com estado desconhecido", () => {
  it("preserva a instância quando criação e consulta falham", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "indisponível" }, 503));
    fetchMock.mockRejectedValueOnce(new Error("Tempo de consulta esgotado"));
    await expect(createInstance("nexora-empresa", "11999990000")).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://gateway.example/instance/create", "POST"],
      ["https://gateway.example/instance/connectionState/nexora-empresa", "GET"],
    ]);
  });

  it("aceita sessão existente confirmada sem exclusão nem segunda criação", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "falha" }, 500));
    fetchMock.mockResolvedValueOnce(response({ state: "open" }));
    await expect(createInstance("nexora-empresa")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([{ state: "open" }, { instance: { state: "open" } }])("reconhece conexão aberta no formato %j", async (body) => {
    fetchMock.mockResolvedValueOnce(response(body));
    expect(await connectInstance("nexora-empresa")).toEqual({ state: "open", qrCode: null, pairingCode: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
