import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSessionCompanyId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    company: { findUnique: vi.fn(), update: vi.fn() },
    companyProfile: { findUnique: vi.fn(), update: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/agenda/painel", () => ({
  obterGradeDoDia: vi.fn(async () => ({ profissionais: [], agendamentos: [], slotsHorario: [] })),
  obterResumoDaAgenda: vi.fn(async () => ({ totalGeral: 0 })),
  listarServicos: vi.fn(async () => []),
  formatarDataLocal: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
  formatarHoraLocal: vi.fn(() => "10:00"),
  extrairProfissional: vi.fn(() => "Profissional"),
  salvarProfissionais: vi.fn(async () => []),
  criarAgendamento: vi.fn(async () => ({ id: "ag1" })),
}));

vi.mock("@/lib/limites", () => ({
  limitar: vi.fn(() => true),
  LIMITES: { leitura: { max: 100, janelaSegundos: 60 }, escrita: { max: 100, janelaSegundos: 60 } },
}));

import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "@/app/api/agenda/route";

describe("Gestão de feriados e dias fechados na Agenda (/api/agenda)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionCompanyId as any).mockResolvedValue("empresa_teste");
    (prisma.company.findUnique as any).mockResolvedValue({ name: "Clínica Teste", slug: "clinica-teste" });
    (prisma.companyProfile.findUnique as any).mockResolvedValue({ diasFechados: ["2026-09-29"] });
    (prisma.companyProfile.update as any).mockResolvedValue({});
    (prisma.appointment.findMany as any).mockResolvedValue([]);
  });

  it("GET /api/agenda retorna a lista de diasFechados da empresa", async () => {
    const res = await GET(new Request("https://meunexora.com.br/api/agenda?data=2026-09-29"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.diasFechados).toEqual(["2026-09-29"]);
  });

  it("POST /api/agenda com acao 'bloquear_dia' adiciona a data aos diasFechados", async () => {
    const req = new Request("https://meunexora.com.br/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "bloquear_dia", data: "2026-09-30" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(prisma.companyProfile.update).toHaveBeenCalledWith({
      where: { companyId: "empresa_teste" },
      data: { diasFechados: ["2026-09-29", "2026-09-30"] },
    });
    expect(data.diasFechados).toEqual(["2026-09-29", "2026-09-30"]);
  });

  it("POST /api/agenda com acao 'desbloquear_dia' remove a data dos diasFechados", async () => {
    const req = new Request("https://meunexora.com.br/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "desbloquear_dia", data: "2026-09-29" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(prisma.companyProfile.update).toHaveBeenCalledWith({
      where: { companyId: "empresa_teste" },
      data: { diasFechados: [] },
    });
    expect(data.diasFechados).toEqual([]);
  });

  it("rejeita data inválida em bloquear_dia", async () => {
    const req = new Request("https://meunexora.com.br/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "bloquear_dia", data: "data-invalida" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
