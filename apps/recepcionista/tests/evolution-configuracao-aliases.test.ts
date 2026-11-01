import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConnectionState } from "@/lib/whatsapp/evolution";

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
const originalEnv = process.env;
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ state: "open" })));
  vi.stubGlobal("fetch", fetchMock);
  // A Vercel diferencia maiúsculas/minúsculas. Um objeto separado reproduz
  // esse ambiente também no Windows, cujo process.env nativo não diferencia.
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    EVOLUTION_API_URL: "https://canonical.example",
    EVOLUTION_API_KEY: "chave-canonical-de-teste",
    EVOLUTION_API_URl: "",
    EVOLUTION_API_KEy: "",
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env = originalEnv;
});

describe("compatibilidade do par de configuração do gateway", () => {
  it("usa integralmente os dois aliases quando preenchidos", async () => {
    process.env.EVOLUTION_API_URl = " https://atual.example/ ";
    process.env.EVOLUTION_API_KEy = " chave-alias-de-teste ";
    expect(await getConnectionState("instancia-teste")).toBe("open");
    expect(fetchMock).toHaveBeenCalledWith("https://atual.example/instance/connectionState/instancia-teste", expect.objectContaining({
      method: "GET",
      headers: { "Content-Type": "application/json", apikey: "chave-alias-de-teste" },
    }));
  });

  it.each([
    ["https://alias-incompleto.example", ""],
    ["", "chave-alias-de-teste"],
    ["https://alias-incompleto.example", " "],
  ])("par incompleto não mistura endereço/chave: %s", async (url, key) => {
    process.env.EVOLUTION_API_URl = url;
    process.env.EVOLUTION_API_KEy = key;
    expect(await getConnectionState("instancia-teste")).toBe("open");
    expect(fetchMock).toHaveBeenCalledWith("https://canonical.example/instance/connectionState/instancia-teste", expect.objectContaining({
      headers: { "Content-Type": "application/json", apikey: "chave-canonical-de-teste" },
    }));
  });

  it("aplica a validação HTTPS ao par escolhido pelos aliases", async () => {
    process.env.EVOLUTION_API_URl = "http://atual.example";
    process.env.EVOLUTION_API_KEy = "chave-alias-de-teste";
    await expect(getConnectionState("instancia-teste")).rejects.toThrow("sem criptografia");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
