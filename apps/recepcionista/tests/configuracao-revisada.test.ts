import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { company: { update: vi.fn() }, knowledgeItem: { create: vi.fn() } } }));
vi.mock("@/lib/whatsapp/instance", () => ({ connectWhatsApp: vi.fn() }));
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { connectWhatsApp } from "@/lib/whatsapp/instance";
import { GET, POST } from "@/app/api/atendente/configurar-nexora/route";

describe("atalho legado não aprova exemplos ou ativa conta por navegação", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("GET não executa configuração", () => {
    expect(GET().status).toBe(405);
    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(connectWhatsApp).not.toHaveBeenCalled();
  });
  it("exige sessão para explicar alternativa de configuração", async () => {
    vi.mocked(getSessionCompanyId).mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
  });
  it("conta autenticada recebe orientação sem alterar assinatura, conhecimento ou conexão", async () => {
    vi.mocked(getSessionCompanyId).mockResolvedValue("empresa-teste");
    const r = await POST();
    expect(r.status).toBe(410);
    expect(await r.json()).toMatchObject({ proximoPasso: "/painel/atendente" });
    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(prisma.knowledgeItem.create).not.toHaveBeenCalled();
    expect(connectWhatsApp).not.toHaveBeenCalled();
  });
});
