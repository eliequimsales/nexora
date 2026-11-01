import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth",()=>({getSessionCompanyId:vi.fn()}));
vi.mock("@/lib/billing/guarda",()=>({exigirAcesso:vi.fn()}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:vi.fn(),TOO_MANY_ATTEMPTS:"Aguarde"}));
vi.mock("@/lib/db",()=>({prisma:{company:{update:vi.fn(),findUnique:vi.fn()}}}));
vi.mock("@/lib/whatsapp/instance",()=>({connectWhatsApp:vi.fn()}));
vi.mock("@/lib/errors",()=>({logError:vi.fn()}));
import { getSessionCompanyId } from "@/lib/auth";
import { exigirAcesso } from "@/lib/billing/guarda";
import { rateLimit } from "@/lib/rate-limit";
import { connectWhatsApp } from "@/lib/whatsapp/instance";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/whatsapp/connect/route";
const req=(phone:string,origin="http://localhost:3002")=>new Request("http://localhost:3002/api/whatsapp/connect",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({phone})});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getSessionCompanyId).mockResolvedValue("empresa-sessao");vi.mocked(exigirAcesso).mockResolvedValue(null);vi.mocked(rateLimit).mockReturnValue(true);vi.mocked(prisma.company.update).mockResolvedValue({} as never);});
describe("conexão do WhatsApp sem confirmação fictícia",()=>{
  it("exige sessão e origem autorizada antes de provisionar",async()=>{
    expect((await POST(req("11999990000","https://outra.invalid"))).status).toBe(403);
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await POST(req("11999990000"))).status).toBe(401);expect(connectWhatsApp).not.toHaveBeenCalled();
  });
  it.each(["123","1234567890123456"])("recusa telefone incompleto ou longo: %s",async phone=>{
    expect((await POST(req(phone))).status).toBe(400);expect(prisma.company.update).not.toHaveBeenCalled();expect(connectWhatsApp).not.toHaveBeenCalled();
  });
  it("preserva erro técnico no servidor e mostra uma indisponibilidade clara ao empresário",async()=>{
    vi.mocked(connectWhatsApp).mockResolvedValue({status:"ERROR",error:"EVOLUTION_API_KEY: detalhe-interno"} as never);
    const r=await POST(req("11999990000"));const body=await r.json();
    expect(r.status).toBe(502);expect(body.error).toContain("Não foi possível conectar");expect(JSON.stringify(body)).not.toContain("detalhe-interno");
    expect(body.state.status).toBe("ERROR");expect(connectWhatsApp).toHaveBeenCalledWith("empresa-sessao","11999990000");
  });
});
