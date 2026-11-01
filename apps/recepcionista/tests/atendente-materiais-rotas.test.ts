import { beforeEach, describe, expect, it, vi } from "vitest";
import { File } from "node:buffer";
vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/limites", () => ({ limitar: vi.fn(), LIMITES: { leitura: { limit:100,windowMs:60000 } } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/atendente/materiais", async original => ({ ...await original<typeof import("@/lib/atendente/materiais")>(), importarMaterial: vi.fn(), removerMaterial: vi.fn() }));
vi.mock("@/lib/ai/transcricao", () => ({ configuracaoDaTranscricao: vi.fn(), transcreverMaterial: vi.fn() }));
import { getSessionCompanyId } from "@/lib/auth";
import { limitar } from "@/lib/limites";
import { importarMaterial, removerMaterial } from "@/lib/atendente/materiais";
import { transcreverMaterial, configuracaoDaTranscricao } from "@/lib/ai/transcricao";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { GET, POST, DELETE } from "@/app/api/atendente/configuracao/materiais/route";
import { POST as EXTRAIR } from "@/app/api/atendente/configuracao/materiais/extrair/route";
const entrada = { revisao:3, nome:"Informações", texto:"Não temos estacionamento.", tipo:"TEXTO" };
function req(method: string, body?:unknown, headers:Record<string,string>={}) { return new Request("http://localhost:3002/api/atendente/configuracao/materiais", { method, headers:{ origin:"http://localhost:3002","content-type":"application/json",...headers }, ...(body===undefined?{}:{body:JSON.stringify(body)}) }); }
function upload(nome:string, conteudo:string) { const f=new FormData(); f.append("arquivo", new File([conteudo],nome) as unknown as Blob,nome); return new Request("http://localhost:3002/api/atendente/configuracao/materiais/extrair",{method:"POST",headers:{origin:"http://localhost:3002"},body:f}); }
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getSessionCompanyId).mockResolvedValue("empresa-da-sessao");vi.mocked(limitar).mockReturnValue(true);vi.mocked(configuracaoDaTranscricao).mockReturnValue(null);});
describe("rotas privadas de materiais",()=>{
  it("exige sessão em todas as entradas",async()=>{
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(req("POST",entrada))).status).toBe(401);
    expect((await DELETE(req("DELETE",{revisao:3,id:"novo:material:1"}))).status).toBe(401); expect((await EXTRAIR(upload("teste.txt","texto"))).status).toBe(401);
  });
  it("não divulga chaves nem conteúdo em capacidades públicas da sessão",async()=>{
    vi.mocked(configuracaoDaTranscricao).mockReturnValue({provedor:"groq",chave:"segredo",modelo:"x"});
    const r=await GET();const body=await r.text();expect(r.headers.get("cache-control")).toBe("no-store");expect(body).toContain('"audioDisponivel":true');expect(body).not.toContain("segredo");
  });
  it("usa exclusivamente empresa da sessão e recusa campos extras",async()=>{
    vi.mocked(importarMaterial).mockResolvedValue({tela:{},resumo:"ok"} as never);
    expect((await POST(req("POST",entrada))).status).toBe(200);expect(importarMaterial).toHaveBeenCalledWith("empresa-da-sessao",entrada);
    expect((await POST(req("POST",{...entrada,companyId:"outra"}))).status).toBe(400);expect(importarMaterial).toHaveBeenCalledTimes(1);
  });
  it("recusa origem cruzada antes de interpretar ou salvar",async()=>{
    expect((await POST(req("POST",entrada,{origin:"https://outra.invalid"}))).status).toBe(403);
    const r=upload("a.txt","texto");r.headers.set("origin","https://outra.invalid");expect((await EXTRAIR(r)).status).toBe(403);expect(importarMaterial).not.toHaveBeenCalled();
  });
  it("limita corpo real sem depender do content-length",async()=>{
    expect((await POST(req("POST",{...entrada,texto:"x".repeat(33000)}))).status).toBe(413);expect(importarMaterial).not.toHaveBeenCalled();
  });
  it("devolve conflito sem alegar importação salva",async()=>{
    vi.mocked(importarMaterial).mockRejectedValue(new ConfiguracaoErro("A configuração mudou.",409));
    const r=await POST(req("POST",entrada));expect(r.status).toBe(409);expect(await r.json()).toEqual({error:"A configuração mudou."});
  });
  it("extração de texto devolve prévia e nunca chama importação",async()=>{
    const r=await EXTRAIR(upload("negocio.txt","Aceitamos cartão."));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({texto:"Aceitamos cartão.",nome:"negocio.txt",tipo:"ARQUIVO"});expect(importarMaterial).not.toHaveBeenCalled();
  });
  it("arquivo incompatível não passa silenciosamente",async()=>expect((await EXTRAIR(upload("negocio.pdf","abc"))).status).toBe(415));
  it("áudio transcrito exige conferência antes de salvar",async()=>{
    vi.mocked(transcreverMaterial).mockResolvedValue("Corte custa cinquenta reais.");const r=await EXTRAIR(upload("voz.mp3","abc"));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({tipo:"AUDIO",texto:"Corte custa cinquenta reais."});expect(importarMaterial).not.toHaveBeenCalled();
  });
  it("transcrição indisponível não gera prévia fictícia",async()=>{
    vi.mocked(transcreverMaterial).mockRejectedValue(new ConfiguracaoErro("Transcrição indisponível.",503));expect((await EXTRAIR(upload("voz.mp3","abc"))).status).toBe(503);
  });
  it("remoção preserva isolamento e revisão esperada",async()=>{
    vi.mocked(removerMaterial).mockResolvedValue({tela:{},resumo:"ok"} as never);expect((await DELETE(req("DELETE",{revisao:3,id:"novo:material:1"}))).status).toBe(200);expect(removerMaterial).toHaveBeenCalledWith("empresa-da-sessao",{revisao:3,id:"novo:material:1"});
  });
  it("limita chamadas antes de processar material",async()=>{
    vi.mocked(limitar).mockReturnValue(false);expect((await EXTRAIR(upload("a.txt","texto"))).status).toBe(429);expect((await POST(req("POST",entrada))).status).toBe(429);expect(importarMaterial).not.toHaveBeenCalled();
  });
});
