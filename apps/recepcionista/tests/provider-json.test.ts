import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
import { configurationCompletion, jsonCompletion, metadadosFalhaDaIa } from "@/lib/ai/provider";

const fetchMock = vi.fn();
let aviso: MockInstance<Parameters<typeof console.warn>, ReturnType<typeof console.warn>>;
const formato = { name: "dados_empresa", schema: { type: "object", properties: { nome: { type: ["string", "null"] } }, required: ["nome"], additionalProperties: false } };
const resposta = (payload: unknown, status = 200) => ({ ok: status === 200, status, json: async () => payload }) as Response;
const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock);
  aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GROQ_MODEL", ""); vi.stubEnv("AI_CONFIG_MODEL", ""); vi.stubEnv("AI_CONFIG_TIMEOUT_MS", "");
  vi.stubEnv("OPENAI_API_KEY", "teste-openai"); vi.stubEnv("GROQ_API_KEY", "teste-groq"); vi.stubEnv("ANTHROPIC_API_KEY", "teste-anthropic");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("estruturação usa apenas o provedor configurado", () => {
  it("OpenAI recebe contrato estrito sem modificar o provedor de atendimento", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: '{"nome":"Espaço"}' } }] }));
    expect(await jsonCompletion("Organize os dados.", "Minha empresa é Espaço.", 1800, formato)).toBe('{"nome":"Espaço"}');
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(body()).toMatchObject({ max_tokens: 1800, response_format: { type: "json_schema", json_schema: { name: formato.name, strict: true, schema: formato.schema } } });
    expect(body().messages[1].content).toBe("Minha empresa é Espaço.");
  });
  it("Groq preserva JSON mode, sem exigir schema de um modelo incompatível", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await jsonCompletion("JSON", "Dados", 1000, formato);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(body().response_format).toEqual({ type: "json_object" });
    expect(body().messages[0].content).toContain(JSON.stringify(formato.schema));
  });
  it("preserva chamada JSON legada sem schema opcional", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await jsonCompletion("JSON", "Dados");
    expect(body()).toMatchObject({ max_tokens: 512, response_format: { type: "json_object" } });
  });
  it("Ollama usa modelo local e não exige chaves de outro provedor", async () => {
    vi.stubEnv("AI_PROVIDER", "ollama"); vi.stubEnv("OLLAMA_URL", "http://localhost:11434/"); vi.stubEnv("GROQ_API_KEY", "");
    fetchMock.mockResolvedValueOnce(resposta({ message: { content: "{}" } }));
    expect(await jsonCompletion("JSON", "Dados", 900, formato)).toBe("{}");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    expect(body()).toMatchObject({ format: formato.schema, options: { num_predict: 900 } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("Anthropic usa ferramenta de extração única sem chamar Groq", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic"); vi.stubEnv("GROQ_API_KEY", "");
    create.mockResolvedValueOnce({ content: [{ type: "tool_use", name: formato.name, input: { nome: "Espaço" } }], stop_reason: "tool_use" });
    expect(JSON.parse(await jsonCompletion("JSON", "Dados", 900, formato))).toEqual({ nome: "Espaço" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ tool_choice: { type: "tool", name: formato.name }, tools: [expect.objectContaining({ input_schema: formato.schema })] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("Anthropic preserva o consumidor legado de JSON em texto", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    create.mockResolvedValueOnce({ content: [{ type: "text", text: '{"nome":null}' }], stop_reason: "end_turn" });
    expect(await jsonCompletion("JSON", "Dados")).toBe('{"nome":null}');
  });
  it("rejeita ferramenta incorreta ou múltipla em vez de aceitar conteúdo alternativo", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    create.mockResolvedValueOnce({ content: [{ type: "tool_use", name: "outra", input: {} }], stop_reason: "tool_use" });
    await expect(jsonCompletion("JSON", "Dados", 900, formato)).rejects.toThrow("ferramenta esperada");
  });
  it("provedor desconhecido falha sem enviar informação para outro serviço", async () => {
    vi.stubEnv("AI_PROVIDER", "desconhecido");
    await expect(jsonCompletion("JSON", "Dados")).rejects.toThrow("AI_PROVIDER");
    expect(fetchMock).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it("chave ausente falha antes da rede mesmo havendo outra chave configurada", async () => {
    vi.stubEnv("AI_PROVIDER", "openai"); vi.stubEnv("OPENAI_API_KEY", "");
    await expect(jsonCompletion("JSON", "Dados")).rejects.toThrow("OPENAI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("não usa resposta cortada como extração completa", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" }, finish_reason: "length" }] }));
    await expect(jsonCompletion("JSON", "Dados")).rejects.toThrow("excedeu");
  });
  it("falha HTTP não expõe o corpo retornado nem tenta outro provedor", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); fetchMock.mockResolvedValueOnce(resposta({}, 429));
    await expect(jsonCompletion("JSON", "Dados")).rejects.toThrow("Chamada JSON falhou: 429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("IA exclusiva da configuração", () => {
  it("usa modelo com contrato estrito sem herdar o modelo de atendimento", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("GROQ_MODEL", "llama-3.3-70b-versatile");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: '{"nome":"Espaço"}' } }] }));
    await configurationCompletion("Organize em JSON", "Minha empresa é Espaço.", 2200, formato);
    expect(body()).toMatchObject({ model: "openai/gpt-oss-120b", max_tokens: 2200,
      response_format: { type: "json_schema", json_schema: { strict: true, schema: formato.schema } } });
    expect(timeout).toHaveBeenCalledWith(20000);
    expect(process.env.GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("respeita modelo administrativo e limita o tempo a 30 segundos", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("AI_CONFIG_MODEL", "openai/gpt-oss-20b"); vi.stubEnv("AI_CONFIG_TIMEOUT_MS", "90000");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("JSON", "Dados", 2000, formato);
    expect(body().model).toBe("openai/gpt-oss-20b");
    expect(body().response_format.type).toBe("json_schema");
    expect(timeout).toHaveBeenCalledWith(30000);
  });
  it("limita a saída e não duplica o schema no prompt do modo estrito", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("INSTRUCAO", "Dados", 9000, formato);
    expect(body()).toMatchObject({ max_tokens: 3072, reasoning_effort: "medium" });
    expect(body().messages[0].content).toBe("INSTRUCAO");
    expect(body().response_format.json_schema.schema).toEqual(formato.schema);
  });
  it("não muda o esforço de chamadas genéricas", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await jsonCompletion("JSON", "Dados", 1000, formato);
    expect(body().reasoning_effort).toBeUndefined();
  });
  it("classifica recusa de tamanho sem expor o conteúdo nem fazer nova chamada", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ error: { message: "DADO_PRIVADO" } }, 413));
    await expect(configurationCompletion("JSON", "CONTEUDO_PRIVADO", 2000, formato)).rejects.toThrow("413");
    expect(aviso).toHaveBeenCalledWith("[ia-json] falha", expect.objectContaining({ categoria: "limite", status: 413, promptChars: expect.any(Number), maxOutputTokens: 2000 }));
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("PRIVADO");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("chamada genérica respeita GROQ_MODEL sem trocar GPT-OSS por modelo legado", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await jsonCompletion("JSON", "Dados", 1000, formato);
    expect(body().model).toBe("openai/gpt-oss-20b");
    expect(body().response_format.type).toBe("json_schema");
  });

  it("preserva o provedor e modelo de outras contas sem usar Groq", async () => {
    vi.stubEnv("AI_PROVIDER", "openai"); vi.stubEnv("OPENAI_MODEL", "gpt-4.1-nano");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("JSON", "Dados", 1200, formato);
    expect(body().model).toBe("gpt-4.1-nano");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("suporta opções locais sem alterar variáveis compartilhadas", async () => {
    vi.stubEnv("AI_PROVIDER", "openai"); vi.stubEnv("OPENAI_MODEL", "modelo-atual");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await jsonCompletion("JSON", "Dados", 1200, formato, { model: "modelo-da-tarefa", timeoutMs: 100, temperature: 0.4 });
    expect(body()).toMatchObject({ model: "modelo-da-tarefa", temperature: 0.4 });
    expect(timeout).toHaveBeenCalledWith(3000);
    expect(process.env.OPENAI_MODEL).toBe("modelo-atual");
  });

  it("categoriza limites sem registrar texto, resposta externa ou credenciais", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ error: { message: "CONTEUDO_PRIVADO teste-groq" } }, 429));
    fetchMock.mockResolvedValueOnce(resposta({ error: { message: "CONTEUDO_PRIVADO teste-groq" } }, 429));
    await expect(configurationCompletion("MANUAL_PRIVADO", "CLIENTE_PRIVADO", 1200, formato)).rejects.toThrow("429");
    expect(aviso).toHaveBeenCalledWith("[ia-json] falha", expect.objectContaining({
      finalidade: "configuracao", categoria: "limite", provedor: "groq", modelo: "openai/gpt-oss-20b", status: 429, latenciaMs: expect.any(Number),
    }));
    const logs = JSON.stringify(aviso.mock.calls);
    for (const privado of ["CONTEUDO_PRIVADO", "MANUAL_PRIVADO", "CLIENTE_PRIVADO", "teste-groq"]) expect(logs).not.toContain(privado);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não propaga nem registra mensagens de erro vindas da rede", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockRejectedValueOnce(new Error("texto confidencial e teste-groq"));
    await expect(configurationCompletion("JSON", "Dados")).rejects.toThrow("Não foi possível obter uma resposta JSON da IA");
    expect(aviso).toHaveBeenCalledWith("[ia-json] falha", expect.objectContaining({ categoria: "rede" }));
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("confidencial");
  });

  it("distingue timeout de JSON inválido sem trocar de provedor", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockRejectedValueOnce(new DOMException("dado privado", "TimeoutError"));
    await expect(configurationCompletion("JSON", "Dados")).rejects.toThrow("excedeu o tempo");
    expect(aviso).toHaveBeenLastCalledWith("[ia-json] falha", expect.objectContaining({ categoria: "tempo" }));
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "texto sem JSON" } }] }));
    await expect(configurationCompletion("JSON", "Dados")).rejects.toThrow("JSON inválido");
    expect(aviso).toHaveBeenLastCalledWith("[ia-json] falha", expect.objectContaining({ categoria: "formato" }));
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(create).not.toHaveBeenCalled();
  });
});

describe("resiliência administrativa e diagnóstico sem conteúdo privado", () => {
  const erroHttp = (status: number, code: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify({
    error: { code, type: "invalid_request_error", message: "RESPOSTA_PRIVADA teste-groq", failed_generation: "PAYLOAD_PRIVADO" },
  }), { status, headers });

  it("mantém saída padrão de 2000 quando o chamador não informa outro teto", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("JSON", "Dados", undefined, formato);
    expect(body().max_tokens).toBe(2000);
  });

  it("uma recusa400 de validação estrita faz só uma repetição JSONobject na mesma conta e modelo", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(erroHttp(400, "json_validate_failed"));
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: '{"nome":"Aurora"}' } }] }));
    expect(await configurationCompletion("REGRAS", "DADOS_DA_EMPRESA", 3072, formato)).toBe('{"nome":"Aurora"}');
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(create).not.toHaveBeenCalled();
    const primeiro = JSON.parse(fetchMock.mock.calls[0][1].body);
    const segundo = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(primeiro.response_format.type).toBe("json_schema");
    expect(segundo).toMatchObject({ model: "openai/gpt-oss-120b", max_tokens: 3072, reasoning_effort: "medium", response_format: { type: "json_object" } });
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(fetchMock.mock.calls[0][1].headers.Authorization);
    expect(fetchMock.mock.calls[1][1].signal).toBe(fetchMock.mock.calls[0][1].signal);
    expect(segundo.messages[0].content).toContain('"nome":string|null');
    expect(segundo.messages[0].content).not.toContain(JSON.stringify(formato.schema));
    expect(segundo.messages[1].content).toBe("DADOS_DA_EMPRESA");
    const logs = JSON.stringify(aviso.mock.calls);
    for (const privado of ["RESPOSTA_PRIVADA", "PAYLOAD_PRIVADO", "DADOS_DA_EMPRESA", "teste-groq"]) expect(logs).not.toContain(privado);
  });

  it("reconhece erro explícito de schema e nunca cria terceira tentativa", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(erroHttp(400, "invalid_json_schema"));
    fetchMock.mockResolvedValueOnce(erroHttp(400, "json_validate_failed"));
    const falha = await configurationCompletion("JSON", "Dados", 2200, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toMatchObject({ status: 400, categoria: "formato", codigo: "json_validate_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não troca modelo explícito no429 e preserva somente números limitados dos cabeçalhos", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("AI_CONFIG_MODEL", "openai/gpt-oss-120b");
    fetchMock.mockResolvedValueOnce(erroHttp(429, "rate_limit_exceeded", {
      "retry-after": "13.5", "x-ratelimit-limit-tokens": "8000", "x-ratelimit-remaining-tokens": "0", "x-ratelimit-reset-tokens": "1m2.5s",
    }));
    const falha = await configurationCompletion("MANUAL_PRIVADO", "CLIENTE_PRIVADO", 2200, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toEqual({ status: 429, categoria: "limite", codigo: "rate_limit_exceeded",
      esperaMs: 13500, limiteTokens: 8000, tokensRestantes: 0, redefinicaoTokensMs: 62500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenLastCalledWith("[ia-json] falha", expect.objectContaining({ esperaMs: 13500, limiteTokens: 8000 }));
    const visivel = JSON.stringify({ metadados: metadadosFalhaDaIa(falha), logs: aviso.mock.calls, erro: String(falha) });
    for (const privado of ["MANUAL_PRIVADO", "CLIENTE_PRIVADO", "RESPOSTA_PRIVADA", "PAYLOAD_PRIVADO", "teste-groq"]) expect(visivel).not.toContain(privado);
  });

  it("usa o reset numérico em429 sem Retry-After e recusa cabeçalhos adulterados", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("AI_CONFIG_MODEL", "openai/gpt-oss-120b");
    fetchMock.mockResolvedValueOnce(erroHttp(429, "rate_limit_exceeded", {
      "retry-after": "segredo", "x-ratelimit-limit-tokens": "99999999999999999999", "x-ratelimit-remaining-tokens": "-1",
      "x-ratelimit-reset-tokens": "2.25",
    }));
    const falha = await configurationCompletion("JSON", "Dados", 2000, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toEqual({ status: 429, categoria: "limite", codigo: "rate_limit_exceeded", esperaMs: 2250, redefinicaoTokensMs: 2250 });
  });

  it.each(["invalid_request_error", "codigo-com-dado-privado"])("não repete400 sem código inequívoco de schema: %s", async codigo => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(erroHttp(400, codigo));
    const falha = await configurationCompletion("JSON", "Dados", 2000, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toMatchObject({ status: 400, categoria: "provedor", codigo: "invalid_request_error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("codigo-com-dado-privado");
  });

  it("o modo genérico e outro provedor não ganham repetição administrativa", async () => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    fetchMock.mockResolvedValueOnce(erroHttp(400, "json_validate_failed"));
    await expect(jsonCompletion("JSON", "Dados", 1000, formato)).rejects.toThrow("400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.stubEnv("AI_PROVIDER", "openai");
    fetchMock.mockResolvedValueOnce(erroHttp(400, "json_validate_failed"));
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("400");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("metadados de erros arbitrários não incluem mensagem, payload nem números inválidos", () => {
    const falha = Object.assign(new Error("SEGREDO_PRIVADO"), { status: 429, code: "codigo-SEGREDO", type: "rate_limit_error",
      esperaMs: Infinity, limiteTokens: "token-privado", tokensRestantes: -1, redefinicaoTokensMs: 999999999, payload: "DADOS_PRIVADOS" });
    expect(metadadosFalhaDaIa(falha)).toEqual({ status: 429, categoria: "limite", codigo: "rate_limit_error" });
  });

  it("classifica contexto excedido mesmo quando o provedor usa400", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(erroHttp(400, "context_length_exceeded"));
    const falha = await configurationCompletion("JSON", "Dados", 2000, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toEqual({ status: 400, categoria: "limite", codigo: "context_length_exceeded" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("continuidade do modelo padrão da configuração", () => {
  const limite = () => new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "RESPOSTA_PRIVADA teste-groq" } }), { status: 429 });
  const sucesso = () => resposta({ choices: [{ message: { content: '{"nome":"Aurora"}' } }] });
  const pedidos = () => fetchMock.mock.calls.map(chamada => JSON.parse(chamada[1].body));

  it("usa20b uma única vez no429, na mesma conta, com histórico e contrato integrais", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const messages = [{ role: "user" as const, content: "nois faz corte e escova" },
      { role: "assistant" as const, content: "Quais os preços?" }, { role: "user" as const, content: "corte80 escova90" }];
    fetchMock.mockResolvedValueOnce(limite()).mockResolvedValueOnce(sucesso());
    expect(await configurationCompletion("REGRAS_PRIVADAS", '{"empresa":"Aurora"}', 3072, formato, { messages })).toBe('{"nome":"Aurora"}');
    const [primeiro, segundo] = pedidos();
    expect(segundo).toEqual({ ...primeiro, model: "openai/gpt-oss-20b" });
    expect(primeiro.model).toBe("openai/gpt-oss-120b");
    expect(segundo.messages.slice(1)).toEqual(messages);
    expect(segundo.response_format).toEqual(primeiro.response_format);
    expect(segundo.response_format.json_schema.schema).toEqual(formato.schema);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
    expect(fetchMock.mock.calls[1][1].headers).toEqual(fetchMock.mock.calls[0][1].headers);
    expect(fetchMock.mock.calls[1][1].signal).toBe(fetchMock.mock.calls[0][1].signal);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith("[ia-json] alternativa_por_limite", expect.objectContaining({
      modelo: "openai/gpt-oss-20b", modeloAnterior: "openai/gpt-oss-120b", status: 429,
    }));
    for (const privado of ["RESPOSTA_PRIVADA", "REGRAS_PRIVADAS", "teste-groq", "Aurora", "corte80"])
      expect(JSON.stringify(aviso.mock.calls)).not.toContain(privado);
    expect(process.env.AI_CONFIG_MODEL).toBe("");
  });

  it("reutiliza JSONobject após400 e429, sem ultrapassar três chamadas nem renovar o prazo", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "json_validate_failed" } }), { status: 400 }));
    fetchMock.mockResolvedValueOnce(limite()).mockResolvedValueOnce(sucesso());
    await configurationCompletion("REGRAS", "DADOS_ATUAIS", 2200, formato);
    const [primeiro, segundo, terceiro] = pedidos();
    expect([primeiro.model, segundo.model, terceiro.model]).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect([primeiro.response_format.type, segundo.response_format.type, terceiro.response_format.type]).toEqual(["json_schema", "json_object", "json_object"]);
    expect(terceiro).toEqual({ ...segundo, model: "openai/gpt-oss-20b" });
    expect(terceiro.messages[0].content).toContain('"nome":string|null');
    expect(terceiro.messages[1].content).toBe("DADOS_ATUAIS");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Set(fetchMock.mock.calls.map(c => c[1].signal)).size).toBe(1);
    expect(timeout).toHaveBeenCalledTimes(1);
  });

  it.each(["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"])("preserva escolha administrativa explícita: %s", async modelo => {
    vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("AI_CONFIG_MODEL", modelo);
    fetchMock.mockResolvedValueOnce(limite());
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body().model).toBe(modelo);
  });

  it("não aplica a alternativa às chamadas genéricas, mesmo com a opção interna", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(limite());
    await expect(jsonCompletion("JSON", "Dados", 2000, formato, { model: "openai/gpt-oss-120b", continuarConfiguracaoNoLimite: true })).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não envia chamadas de outra conta para Groq", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    fetchMock.mockResolvedValueOnce(limite());
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("falha com segurança se a alternativa também estiver limitada e registra o modelo efetivo", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(limite()).mockResolvedValueOnce(limite());
    const falha = await configurationCompletion("JSON", "Dados", 2000, formato).catch(e => e);
    expect(metadadosFalhaDaIa(falha)).toMatchObject({ categoria: "limite", status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(aviso).toHaveBeenLastCalledWith("[ia-json] falha", expect.objectContaining({ modelo: "openai/gpt-oss-20b", status: 429 }));
  });

  it("não faz uma nova repetição de schema depois de usar a alternativa", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(limite()).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "json_validate_failed" } }), { status: 400 }));
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("400");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("continua rejeitando JSON inválido da alternativa", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(limite()).mockResolvedValueOnce(resposta({ choices: [{ message: { content: "inválido" } }] }));
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("JSON inválido");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não inicia a alternativa quando o prazo total já acabou", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    let agora = 0; vi.spyOn(Date, "now").mockImplementation(() => agora);
    fetchMock.mockImplementationOnce(async () => { agora = 20001; return limite(); });
    await expect(configurationCompletion("JSON", "Dados", 2000, formato)).rejects.toThrow("excedeu o tempo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenLastCalledWith("[ia-json] falha", expect.objectContaining({ categoria: "tempo", modelo: "openai/gpt-oss-120b" }));
  });
});

describe("histórico nativo separado dos dados da empresa", () => {
  const messages = [{ role: "user" as const, content: "Oferecemos corte e escova." },
    { role: "assistant" as const, content: "Qual valor do corte?" }, { role: "user" as const, content: "Ele custa 80." }];

  it("envia turnos cronológicos e fala atual uma única vez, com cadastro separado no system", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("REGRAS", '{"empresa":"Aurora"}', 3072, formato, { messages });
    const pedido = body();
    expect(pedido.messages.slice(1)).toEqual(messages);
    expect(pedido.messages[0]).toMatchObject({ role: "system" });
    expect(pedido.messages[0].content).toContain("# DADOS DE CONFIGURAÇÃO");
    expect(pedido.messages[0].content).toContain('{"empresa":"Aurora"}');
    expect(pedido.messages[0].content).not.toContain("Ele custa 80.");
    expect(JSON.stringify(pedido.messages).match(/Ele custa 80\./g)).toHaveLength(1);
    expect(messages).toHaveLength(3);
  });

  it("mantém histórico e dados na repetição JSONobject, sem recolocar o cadastro como fala do dono", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "json_validate_failed" } }), { status: 400 }));
    fetchMock.mockResolvedValueOnce(resposta({ choices: [{ message: { content: "{}" } }] }));
    await configurationCompletion("REGRAS", '{"empresa":"Aurora"}', 3072, formato, { messages });
    const segundo = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(segundo.messages.slice(1)).toEqual(messages);
    expect(segundo.messages[0].content).toContain('{"empresa":"Aurora"}');
    expect(segundo.messages.at(-1)).toEqual(messages.at(-1));
  });

  it.each(["ollama", "anthropic"])("preserva o contrato de histórico também em %s", async provider => {
    vi.stubEnv("AI_PROVIDER", provider);
    if (provider === "ollama") fetchMock.mockResolvedValueOnce(resposta({ message: { content: "{}" } }));
    else create.mockResolvedValueOnce({ content: [{ type: "tool_use", name: formato.name, input: { nome: null } }], stop_reason: "tool_use" });
    await configurationCompletion("REGRAS", "CADASTRO", 2000, formato, { messages });
    if (provider === "ollama") expect(body().messages.slice(1)).toEqual(messages);
    else { expect(create.mock.calls[0][0].messages).toEqual(messages); expect(create.mock.calls[0][0].system).toContain("CADASTRO"); }
  });

  it("não envia histórico sem a fala atual ao provedor", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    await expect(configurationCompletion("JSON", "Dados", 2000, formato, { messages: messages.slice(0, 2) })).rejects.toThrow("mensagem atual");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
