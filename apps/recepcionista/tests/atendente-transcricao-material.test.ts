import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { File } from "node:buffer";
import { configuracaoDaTranscricao, transcreverMaterial } from "@/lib/ai/transcricao";
const arquivo = (nome = "audio.mp3", conteudo = new Uint8Array([1,2,3])) => new File([conteudo], nome, { type: "audio/mpeg" }) as unknown as Blob & { name: string };
beforeEach(() => { vi.stubEnv("AI_PROVIDER", "groq"); vi.stubEnv("GROQ_API_KEY", "teste-nao-real"); vi.stubEnv("TRANSCRIPTION_PROVIDER", "groq"); vi.stubEnv("TRANSCRIPTION_MODEL", ""); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("transcrição de material administrativo", () => {
  it("não utiliza credenciais de outro provedor silenciosamente", () => { vi.stubEnv("TRANSCRIPTION_PROVIDER", "anthropic"); expect(configuracaoDaTranscricao()).toBeNull(); });
  it("sem chave informa indisponibilidade sem chamada externa", async () => { vi.stubEnv("GROQ_API_KEY", ""); const fetcher=vi.fn(); await expect(transcreverMaterial(arquivo(), fetcher)).rejects.toMatchObject({ status:503 }); expect(fetcher).not.toHaveBeenCalled(); });
  it("envia multipart ao provedor configurado e devolve texto para conferência", async () => {
    const fetcher=vi.fn().mockResolvedValue(Response.json({text:"A massagem custa cento e cinquenta reais."}));
    expect(await transcreverMaterial(arquivo(), fetcher)).toContain("cento e cinquenta");
    const [url, req] = fetcher.mock.calls[0]; expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(req.body.get("language")).toBe("pt"); expect(req.body.get("model")).toBe("whisper-large-v3-turbo");
    expect(req.body.get("file").name).toBe("audio.mp3");
  });
  it("usa campos atuais da OpenAI quando selecionada", async () => {
    vi.stubEnv("TRANSCRIPTION_PROVIDER", "openai"); vi.stubEnv("OPENAI_API_KEY", "teste-nao-real");
    const fetcher=vi.fn().mockResolvedValue(Response.json({text:"Funcionamos de manhã."})); await transcreverMaterial(arquivo(),fetcher);
    const [url, req]=fetcher.mock.calls[0]; expect(url).toBe("https://api.openai.com/v1/audio/transcriptions"); expect(req.body.get("model")).toBe("gpt-transcribe"); expect(req.body.get("languages[]")).toBe("pt"); expect(req.body.has("language")).toBe(false);
  });
  it("não inventa fala em áudio vazio", async () => { const fetcher=vi.fn().mockResolvedValue(Response.json({text:"   "})); await expect(transcreverMaterial(arquivo(),fetcher)).rejects.toMatchObject({status:422}); });
  it("não apresenta texto de erro do provedor como transcrição", async () => { const fetcher=vi.fn().mockResolvedValue(Response.json({text:"falha",error:"erro"},{status:429})); await expect(transcreverMaterial(arquivo(),fetcher)).rejects.toMatchObject({status:502}); });
  it("falha de rede deixa o material sem salvar e permite tentar depois", async () => { await expect(transcreverMaterial(arquivo(), vi.fn().mockRejectedValue(new Error("rede")))).rejects.toMatchObject({status:502}); });
  it("limita extensão e tamanho antes de enviar", async () => {
    const fetcher=vi.fn(); await expect(transcreverMaterial(arquivo("x.exe"), fetcher)).rejects.toMatchObject({status:415});
    await expect(transcreverMaterial(arquivo("x.mp3", new Uint8Array(10*1024*1024+1)), fetcher)).rejects.toMatchObject({status:413}); expect(fetcher).not.toHaveBeenCalled();
  });
});
