import { afterEach, describe, expect, it, vi } from "vitest";
import { entregarResposta, planejarEntrega, type DependenciasDaEntrega } from "@/lib/atendente/entrega";
import { mostrarDigitacaoWhatsApp } from "@/lib/whatsapp/evolution";

function dependencias(p: Partial<DependenciasDaEntrega<string>> = {}): DependenciasDaEntrega<string> {
  return { podeContinuar: vi.fn(async () => null), esperar: vi.fn(async () => {}),
    enviar: vi.fn(async () => {}), ...p };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("plano da entrega preserva o texto decidido pelo motor", () => {
  it("fraciona somente parágrafos e preserva todas as palavras e perguntas", () => {
    const plano = planejarEntrega(["Oi, Marcos!\n\nO corte custa R$ 45,00 e dura 40 minutos.\n\nQual dia você prefere?"]);
    expect(plano.bolhas.map((b) => b.texto)).toEqual([
      "Oi, Marcos!", "O corte custa R$ 45,00 e dura 40 minutos.", "Qual dia você prefere?",
    ]);
    expect(plano.bolhas.flatMap((b) => b.texto.match(/\?/g) ?? [])).toHaveLength(1);
    expect(plano.esperaTotalMs).toBeGreaterThanOrEqual(3_000);
    expect(plano.bolhas.reduce((total, b) => total + b.esperaMs, 0)).toBe(plano.esperaTotalMs);
  });

  it("nunca corta URL, Pix, preço, horário, lista ou um token comprido", () => {
    const link = `https://empresa.example/pagar/${"x".repeat(900)}?valor=45.00&hora=14:30`;
    const pix = `0002012658${"0".repeat(300)}6304ABCD`;
    const lista = "Serviços e horários:\n\n- Corte: R$ 45,00, às 14:30\n- Barba: R$ 30,00, às 15:00";
    const plano = planejarEntrega([link, `Pix copia e cola:\n\n${pix}`, lista, "Qual prefere?"]);
    expect(plano.bolhas).toHaveLength(3);
    expect(plano.bolhas[0].texto).toBe(link);
    expect(plano.bolhas[1].texto).toBe(`Pix copia e cola:\n\n${pix}`);
    expect(plano.bolhas[2].texto).toBe(`${lista}\n\nQual prefere?`);
    expect(plano.esperaTotalMs).toBe(5_000);
  });

  it("limita a três balões reunindo o restante sem perder conteúdo", () => {
    expect(planejarEntrega(["Um\n\nDois\n\nTrês\n\nQuatro", "Cinco"]).bolhas.map((b) => b.texto))
      .toEqual(["Um", "Dois", "Três\n\nQuatro\n\nCinco"]);
  });

  it("não transforma sentença longa em fragmentos e cresce até 5 segundos", () => {
    const longo = "Informação confirmada. ".repeat(100);
    expect(planejarEntrega([longo]).bolhas).toEqual([{ texto: longo.trim(), esperaMs: 5_000 }]);
    expect(planejarEntrega(["x".repeat(120)]).esperaTotalMs)
      .toBeGreaterThan(planejarEntrega(["x".repeat(60)]).esperaTotalMs);
    expect(planejarEntrega(["", "  "])).toEqual({ bolhas: [], esperaTotalMs: 0 });
  });
});

describe("entrega controlada e interrompível", () => {
  it("mostra presença e espera em paralelo, envia em ordem e encerra o indicador", async () => {
    vi.useFakeTimers();
    const plano = planejarEntrega(["Olá!", "Qual dia você prefere?"]);
    const enviadas: string[] = [];
    const presenca = vi.fn(async (_digitando: boolean, _ms: number, _signal: AbortSignal) => {});
    const deps = dependencias({ presenca, esperar: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      enviar: async (texto) => { enviadas.push(texto); } });
    const tarefa = entregarResposta(plano, deps);
    await vi.advanceTimersByTimeAsync(plano.bolhas[0].esperaMs - 1);
    expect(enviadas).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(enviadas).toEqual(["Olá!"]);
    await vi.runAllTimersAsync();
    expect(await tarefa).toEqual({ acao: "CONCLUIDA", enviadas: 2 });
    expect(enviadas).toEqual(["Olá!", "Qual dia você prefere?"]);
    expect(presenca.mock.calls.map((c) => c[0])).toEqual([true, true, false]);
  });

  it("urgência entrega imediatamente, sem presença nem espera", async () => {
    const deps = dependencias({ presenca: vi.fn(async () => {}) });
    const resultado = await entregarResposta(planejarEntrega(["Procure atendimento de urgência."], { urgente: true }), deps);
    expect(resultado).toEqual({ acao: "CONCLUIDA", enviadas: 1 });
    expect(deps.esperar).not.toHaveBeenCalled();
    expect(deps.presenca).not.toHaveBeenCalled();
  });

  it("não inicia nada se a equipe já assumiu", async () => {
    const deps = dependencias({ podeContinuar: vi.fn(async () => "DONO_ASSUMIU"), presenca: vi.fn(async () => {}) });
    expect(await entregarResposta(planejarEntrega(["Olá!"]), deps))
      .toEqual({ acao: "INTERROMPIDA", enviadas: 0, motivo: "DONO_ASSUMIU" });
    expect(deps.esperar).not.toHaveBeenCalled();
    expect(deps.presenca).not.toHaveBeenCalled();
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("revalida a tomada humana depois da espera e impede o envio", async () => {
    let tomada = false;
    const presenca = vi.fn(async (_digitando: boolean, _ms: number, _signal: AbortSignal) => {});
    const deps = dependencias({ podeContinuar: async () => tomada ? "DONO_ASSUMIU" : null,
      esperar: async () => { tomada = true; }, presenca });
    expect(await entregarResposta(planejarEntrega(["Olá!"]), deps))
      .toEqual({ acao: "INTERROMPIDA", enviadas: 0, motivo: "DONO_ASSUMIU" });
    expect(deps.enviar).not.toHaveBeenCalled();
    expect(presenca.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("mensagem nova após o primeiro balão cancela os seguintes", async () => {
    let novaMensagem = false;
    const deps = dependencias({ podeContinuar: async () => novaMensagem ? "RAJADA" : null,
      enviar: vi.fn(async () => { novaMensagem = true; }) });
    expect(await entregarResposta(planejarEntrega(["Olá!", "Qual dia prefere?"]), deps))
      .toEqual({ acao: "INTERROMPIDA", enviadas: 1, motivo: "RAJADA" });
    expect(deps.enviar).toHaveBeenCalledTimes(1);
  });

  it("abort interrompe uma espera pendente sem enviar posteriormente", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const deps = dependencias({ esperar: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) });
    const tarefa = entregarResposta(planejarEntrega(["Olá!"]), deps, { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    expect(await tarefa).toEqual({ acao: "INTERROMPIDA", enviadas: 0, motivo: null });
    await vi.runAllTimersAsync();
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("não inicia uma espera que excederia o prazo", async () => {
    const deps = dependencias();
    expect(await entregarResposta(planejarEntrega(["Olá!"]), deps, { agora: () => 10_000, prazoEm: 11_000 }))
      .toEqual({ acao: "PRAZO_ESGOTADO", enviadas: 0 });
    expect(deps.esperar).not.toHaveBeenCalled();
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("espera travada encerra no prazo e não envia depois", async () => {
    vi.useFakeTimers();
    const deps = dependencias({ esperar: async () => new Promise<void>(() => {}) });
    const tarefa = entregarResposta(planejarEntrega(["Olá!"]), deps, { prazoEm: Date.now() + 4_000 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await tarefa).toEqual({ acao: "PRAZO_ESGOTADO", enviadas: 0 });
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("presença indisponível ou travada é opcional e limitada", async () => {
    vi.useFakeTimers();
    let signalDaPresenca: AbortSignal | undefined;
    const deps = dependencias({ presenca: vi.fn(async (digitando, _ms, signal) => {
      signalDaPresenca = signal;
      if (digitando) return new Promise<void>(() => {});
      throw new Error("API indisponível");
    }), esperar: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) });
    const tarefa = entregarResposta(planejarEntrega(["Olá!"]), deps);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await tarefa).toEqual({ acao: "CONCLUIDA", enviadas: 1 });
    expect(signalDaPresenca?.aborted).toBe(true);
    expect(deps.enviar).toHaveBeenCalledOnce();
  });

  it("timeout do canal propaga sem repetir o balão ou seguir a resposta", async () => {
    const erro = new Error("The operation was aborted due to timeout");
    const deps = dependencias({ enviar: vi.fn(async () => { throw erro; }), presenca: vi.fn(async () => {}) });
    await expect(entregarResposta(planejarEntrega(["Olá!", "Qual dia?"]), deps)).rejects.toBe(erro);
    expect(deps.enviar).toHaveBeenCalledTimes(1);
    expect(deps.presenca).toHaveBeenLastCalledWith(false, 0, expect.any(AbortSignal));
  });
});

describe("presença da Evolution não é um envio", () => {
  it("manda apenas o estado transitório e admite cancelamento", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "https://whatsapp.example");
    vi.stubEnv("EVOLUTION_API_KEY", "chave-somente-do-teste");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await mostrarDigitacaoWhatsApp("empresa/1", "5511999999999", true, 90_000, controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("https://whatsapp.example/chat/sendPresence/empresa%2F1", expect.objectContaining({
      method: "POST", signal: controller.signal,
      body: JSON.stringify({ number: "5511999999999", presence: "composing", delay: 5_000 }),
    }));
    await mostrarDigitacaoWhatsApp("empresa/1", "5511999999999", false, 90_000);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ number: "5511999999999", presence: "paused", delay: 0 }),
    }));
  });
});
