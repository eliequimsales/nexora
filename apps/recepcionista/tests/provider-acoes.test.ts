import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const anthropicCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({ default: class {
  messages = { create: anthropicCreate };
} }));

import { generateReceptionistReply, parseReceptionistReply, type FerramentaDaIa, type ReceptionistInput } from "@/lib/ai/provider";
import { ferramentasDoAtendente, type ContextoDasAcoes } from "@/lib/atendente/acoes";

const c: ContextoDasAcoes = { companyId: "empresa-a", conversaId: "conversa-a", operacaoId: "mensagem-a",
  cliente: { nome: "Rafael", telefone: "5511988887777" }, agora: new Date("2026-10-23T12:00:00-03:00"),
  fatos: { empresa: "Barbearia A", nome: "Sofia", jeito: "ACOLHEDOR", marcaDireto: true, agendamento: "DIRETO",
    expediente: false, servicos: [{ id: "s1", nome: "Corte", duracaoMin: 30, precoCents: 4500 }], profissionais: [],
    horarios: [{ day: 6, open: "09:00", close: "18:00", closed: false }], diasFechados: [], endereco: "", pagamento: "Pix",
    descricao: "", perguntas: [], linkAgenda: null } };
const ferramentas: FerramentaDaIa[] = ferramentasDoAtendente(c, { agenda: { companyId: "empresa-a", livres: vi.fn(), marcar: vi.fn() } });
const apenasConsulta = [ferramentas.find((f) => f.function.name === "consultar_horarios")!];
const input = (p: Partial<ReceptionistInput> = {}): ReceptionistInput => ({ systemPrompt: "Use somente dados aprovados.",
  history: [{ role: "CUSTOMER", content: "Quais os horários amanhã?" }], ferramentas: apenasConsulta, ...p });
const argumentos = { servicoId: "s1", dias: ["2026-10-24"], profissional: null };
const chamada = (p: Record<string, unknown> = {}) => ({ id: "call-1", type: "function",
  function: { name: "consultar_horarios", arguments: JSON.stringify(argumentos) }, ...p });
const resposta = { resposta: "Informação interna", transferir_humano: false, fontes_ids: ["faq:1"], duvida_pendente: false };
const chat = (message: unknown) => ({ choices: [{ message }] });
const json = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload }) as Response;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GROQ_API_KEY", "chave-falsa-apenas-teste");
  vi.stubEnv("OPENAI_API_KEY", "chave-falsa-apenas-teste");
  vi.stubEnv("ANTHROPIC_API_KEY", "chave-falsa-apenas-teste");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe.each(["groq", "openai"])("function calling no provider %s", (provider) => {
  beforeEach(() => { vi.stubEnv("AI_PROVIDER", provider); });

  it("envia ferramentas estritas, desliga paralelismo e retorna ação sem executar ou publicar texto acompanhante", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: "Já reservei e cobrei!", tool_calls: [chamada()] })));
    const r = await generateReceptionistReply(input());
    expect(r).toMatchObject({ resposta: "Consulta estruturada solicitada", fontes_ids: [], duvida_pendente: false,
      acao_solicitada: { acao: "consultar_horarios", ...argumentos } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ tools: apenasConsulta, tool_choice: "auto", parallel_tool_calls: false });
    expect(body.response_format).toBeUndefined();
    expect(body.tools[0].function.strict).toBe(true);
    expect(body.tools[0].function.parameters.additionalProperties).toBe(false);
    expect(body.tools[0].function.parameters.required.slice().sort()).toEqual(Object.keys(body.tools[0].function.parameters.properties).sort());
  });

  it("preserva JSON mode e formato legado quando nenhuma ferramenta foi fornecida", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: JSON.stringify(resposta) })));
    expect(await generateReceptionistReply(input({ ferramentas: undefined }))).toMatchObject(resposta);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.tools).toBeUndefined();
    expect(body.parallel_tool_calls).toBeUndefined();
  });

  it("permite resposta comum com fontes quando o modelo não solicita ferramenta", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: JSON.stringify(resposta), tool_calls: [] })));
    expect(await generateReceptionistReply(input())).toMatchObject(resposta);
  });

  it("rejeita ferramenta não anunciada mesmo que a ação seja válida", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: JSON.stringify(resposta), tool_calls: [chamada()] })));
    await expect(generateReceptionistReply(input({ ferramentas: undefined }))).rejects.toThrow("não autorizada");
    fetchMock.mockResolvedValueOnce(json(chat({ tool_calls: [chamada({ function: { name: "reservar_horario",
      arguments: JSON.stringify({ servicoId: "s1", inicio: "2026-10-24T14:00:00-03:00", profissional: null }) } })] })));
    await expect(generateReceptionistReply(input())).rejects.toThrow("não autorizada");
  });

  it.each([
    { tool_calls: [chamada(), chamada()] }, { tool_calls: null }, { tool_calls: {} },
    { tool_calls: [null] }, { tool_calls: [chamada({ type: "custom" })] }, { tool_calls: [chamada({ function: null })] },
    { tool_calls: [chamada({ function: { name: "consultar_horarios", arguments: "{quebrado" } })] },
    { tool_calls: [chamada({ function: { name: "consultar_horarios", arguments: "[]" } })] },
    { tool_calls: [chamada({ function: { name: "consultar_horarios", arguments: JSON.stringify({ ...argumentos, companyId: "empresa-b" }) } })] },
    { tool_calls: [chamada({ function: { name: "consultar_horarios", arguments: JSON.stringify({ ...argumentos, acao: "reservar_horario" }) } })] },
    { tool_calls: [chamada({ function: { name: "consultar_horarios", arguments: argumentos } })] },
  ])("rejeita tool_calls malformadas sem recuperar texto acompanhante: %j", async ({ tool_calls }) => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: JSON.stringify(resposta), tool_calls })));
    await expect(generateReceptionistReply(input())).rejects.toThrow();
  });

  it("rejeita múltiplas chamadas sem escolher uma arbitrariamente", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ tool_calls: [chamada(), chamada()] })));
    await expect(generateReceptionistReply(input())).rejects.toThrow("múltiplas");
  });

  it("não aceita function_call legado fora do contrato", async () => {
    fetchMock.mockResolvedValueOnce(json(chat({ content: JSON.stringify(resposta), function_call: { name: "consultar_horarios", arguments: "{}" } })));
    await expect(generateReceptionistReply(input())).rejects.toThrow("fora do contrato");
  });
});

describe("function calling no Ollama", () => {
  beforeEach(() => { vi.stubEnv("AI_PROVIDER", "ollama"); });

  it("envia tools sem format=json e valida os argumentos como objeto do protocolo Ollama", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: { content: "confirmado sem prova", tool_calls: [
      { function: { name: "consultar_horarios", arguments: argumentos } },
    ] } }));
    expect(await generateReceptionistReply(input())).toMatchObject({ acao_solicitada: { acao: "consultar_horarios", ...argumentos }, fontes_ids: [] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual(apenasConsulta);
    expect(body.format).toBeUndefined();
    expect(body.stream).toBe(false);
  });

  it("preserva o protocolo legado quando não há ferramentas", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: { content: JSON.stringify(resposta) } }));
    expect(await generateReceptionistReply(input({ ferramentas: [] }))).toMatchObject(resposta);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).format).toBe("json");
  });

  it.each([
    { name: "inventada", arguments: argumentos },
    { name: "consultar_horarios", arguments: JSON.stringify(argumentos) },
    { name: "consultar_horarios", arguments: { ...argumentos, precoCents: 1 } },
    { name: "consultar_horarios", arguments: { ...argumentos, acao: "solicitar_link_pagamento" } },
  ])("rejeita argumentos ou função indevidos: %j", async (funcao) => {
    fetchMock.mockResolvedValueOnce(json({ message: { content: JSON.stringify(resposta), tool_calls: [{ function: funcao }] } }));
    await expect(generateReceptionistReply(input())).rejects.toThrow();
  });
});

describe("function calling no Anthropic", () => {
  beforeEach(() => { vi.stubEnv("AI_PROVIDER", "anthropic"); });

  it("oferece enviar_resposta e ações com escolha automática e apenas uma ferramenta", async () => {
    anthropicCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "Horário confirmado" },
      { type: "tool_use", id: "tool-1", name: "consultar_horarios", input: argumentos }], stop_reason: "tool_use" });
    expect(await generateReceptionistReply(input())).toMatchObject({ acao_solicitada: { acao: "consultar_horarios", ...argumentos }, fontes_ids: [] });
    const request = anthropicCreate.mock.calls[0][0];
    expect(request.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(request.tools.map((t: { name: string }) => t.name)).toEqual(["enviar_resposta", "consultar_horarios"]);
    expect(request.tools[1].input_schema).toEqual(apenasConsulta[0].function.parameters);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserva enviar_resposta forçado sem ações e aceita resposta comum quando ações estão disponíveis", async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: "tool_use", id: "tool-1", name: "enviar_resposta", input: resposta }], stop_reason: "tool_use" });
    expect(await generateReceptionistReply(input({ ferramentas: undefined }))).toMatchObject(resposta);
    expect(anthropicCreate.mock.calls[0][0].tool_choice).toEqual({ type: "tool", name: "enviar_resposta" });
    expect(await generateReceptionistReply(input())).toMatchObject(resposta);
  });

  it.each([
    { content: [{ type: "text", text: JSON.stringify(resposta) }] },
    { content: [{ type: "tool_use", name: "funcao_inventada", input: argumentos }] },
    { content: [{ type: "tool_use", name: "consultar_horarios", input: { ...argumentos, companyId: "empresa-b" } }] },
    { content: [{ type: "tool_use", name: "consultar_horarios", input: { ...argumentos, acao: "reservar_horario" } }] },
  ])("rejeita retorno fora do contrato: %j", async ({ content }) => {
    anthropicCreate.mockResolvedValueOnce({ content, stop_reason: "tool_use" });
    await expect(generateReceptionistReply(input())).rejects.toThrow();
  });

  it("rejeita múltiplas chamadas inclusive enviar_resposta misturado com ação", async () => {
    anthropicCreate.mockResolvedValueOnce({ content: [
      { type: "tool_use", name: "consultar_horarios", input: argumentos },
      { type: "tool_use", name: "enviar_resposta", input: resposta },
    ], stop_reason: "tool_use" });
    await expect(generateReceptionistReply(input())).rejects.toThrow("múltiplas");
  });
});

it("JSON comum nunca pode preencher acao_solicitada, mesmo com argumentos válidos", () => {
  expect(parseReceptionistReply(JSON.stringify({ ...resposta,
    acao_solicitada: { acao: "consultar_horarios", ...argumentos } })).acao_solicitada).toBeUndefined();
});
