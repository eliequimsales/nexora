import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ contexto: vi.fn() }));
vi.mock("@/lib/atendente/configuracao", () => ({ getContextoConversaConfiguracao: mocks.contexto }));
import { getConversaConfiguracao } from "@/lib/atendente/conversa";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

describe("retomar um assunto pela interface", () => {
  beforeEach(() => {
    const c = configuracaoExemplo();
    c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    mocks.contexto.mockResolvedValue({ tela: { rascunho: c, pendencias: [] }, conversa: {
      mensagens: [], ignoradas: [], ultimaPergunta: null, topicoAtual: "FUNCIONAMENTO", perguntaSuspensa: true,
    } });
  });
  it("uma escolha explícita de assunto volta a perguntar o que falta", async () => {
    const r = await getConversaConfiguracao("empresa-ficticia", "FUNCIONAMENTO");
    expect(r.pergunta?.chave).toBe("informacoes.endereco");
    expect(r.topicoAtual).toBe("FUNCIONAMENTO");
  });
  it("uma leitura comum preserva a pausa após responder uma dúvida", async () => {
    const r = await getConversaConfiguracao("empresa-ficticia");
    expect(r.pergunta).toBeNull();
  });
});
