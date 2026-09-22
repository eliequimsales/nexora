import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/limites", () => ({
  LIMITES: { escrita: 10, leitura: 30 },
  limitar: vi.fn(() => true),
}));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/agenda/painel", () => ({
  listarServicos: vi.fn(async () => [
    { id: "srv-1", name: "Corte masculino", durationMin: 30, priceCents: 4000 },
  ]),
  criarServico: vi.fn(async (_cid, dados) => ({
    id: "srv-novo",
    name: dados.name,
    durationMin: dados.durationMin ?? 30,
    priceCents: dados.priceCents ?? 0,
  })),
}));

import { DELETE, GET, POST, PUT } from "@/app/api/agenda/servicos/route";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";

describe("rotas de /api/agenda/servicos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionCompanyId).mockResolvedValue("emp-1");
  });

  it("GET: lista serviços da empresa autenticada", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.servicos).toHaveLength(1);
    expect(json.servicos[0].name).toBe("Corte masculino");
  });

  it("POST: cria novo serviço com nome, preço e duração", async () => {
    const req = new Request("http://localhost/api/agenda/servicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Barba completa", precoCents: 3500, duracaoMin: 30 }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.servico.name).toBe("Barba completa");
  });

  it("PUT: atualiza dados do serviço existente", async () => {
    vi.mocked(prisma.service.updateMany).mockResolvedValue({ count: 1 });
    const req = new Request("http://localhost/api/agenda/servicos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "srv-1", nome: "Corte degradê", precoCents: 5000, duracaoMin: 45 }),
    });
    const res = await PUT(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.service.updateMany).toHaveBeenCalledWith({
      where: { id: "srv-1", companyId: "emp-1", active: true },
      data: { name: "Corte degradê", priceCents: 5000, durationMin: 45 },
    });
  });

  it("DELETE: desativa o serviço pelo id", async () => {
    vi.mocked(prisma.service.updateMany).mockResolvedValue({ count: 1 });
    const req = new Request("http://localhost/api/agenda/servicos?id=srv-1", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.service.updateMany).toHaveBeenCalledWith({
      where: { id: "srv-1", companyId: "emp-1" },
      data: { active: false },
    });
  });
});
