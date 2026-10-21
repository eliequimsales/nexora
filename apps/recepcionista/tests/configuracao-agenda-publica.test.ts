import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

vi.mock("@/lib/db", () => ({ prisma: { company: { findFirst: vi.fn() }, appointment: { findMany: vi.fn() } } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "127.0.0.1", rateLimit: () => true }));
vi.mock("@/lib/agenda/painel", () => ({ listarProfissionais: vi.fn(async () => []), extrairProfissional: () => "Ana", gerarTextoLembrete: () => "Lembrete" }));
vi.mock("@/lib/agenda/marcacao", () => ({ marcarNaAgenda: vi.fn() }));

import { GET, POST } from "@/app/api/agendar/[slug]/route";
import { calcularSlots } from "@/lib/agenda/disponibilidade";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";
import { prisma } from "@/lib/db";
const db = prisma as unknown as { company: { findFirst: ReturnType<typeof vi.fn> }; appointment: { findMany: ReturnType<typeof vi.fn> } };

function negocio(servicos: { id: string; name: string; durationMin: number; priceCents: number }[]) {
  const c = configuracaoExemplo();
  return { id: "empresa1", name: "Oficina Exemplo", services: servicos, profile: { address: "Rua Exemplo", businessHours: c.informacoes.horarios,
    diasFechados: [], atendenteConfiguracao: { versao: 1, revisao: 1, etapa: 5, revisadas: [0, 1, 2, 3], testes: [], rascunho: c,
      publicado: { revisao: 1, em: "2026-10-21T12:00:00Z", rascunho: c } } } };
}
const reserva = (serviceId: string | undefined) => new Request("http://localhost/api/agendar/empresa1", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nome: "Cliente Exemplo", telefone: "11999990000", dia: "2026-10-22", hora: "10:00", serviceId }) });

beforeEach(() => { vi.clearAllMocks(); db.appointment.findMany.mockResolvedValue([]); });

describe("cadastro revisado sem durações inventadas na agenda pública", () => {
  it.each([{ servicos: [] }, { servicos: [{ id: "s1", name: "Avaliação", durationMin: 0, priceCents: 0 }] }])("não oferece serviço genérico quando faltam serviços agendáveis: %j", async ({ servicos }) => {
    db.company.findFirst.mockResolvedValue(negocio(servicos));
    const r = await GET(new Request("http://localhost/api/agendar/empresa1"), { params: { slug: "empresa1" } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ servicos: [], dias: [], servicoSelecionado: null });
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });

  it("não cria uma reserva de 30 minutos para serviço cuja duração é desconhecida", async () => {
    db.company.findFirst.mockResolvedValue(negocio([{ id: "s1", name: "Avaliação", durationMin: 0, priceCents: 0 }]));
    expect((await POST(reserva("s1"), { params: { slug: "empresa1" } })).status).toBe(409);
    expect(marcarNaAgenda).not.toHaveBeenCalled();
  });

  it("um ID desconhecido não vira atendimento genérico na configuração revisada", async () => {
    db.company.findFirst.mockResolvedValue(negocio([{ id: "s1", name: "Revisão", durationMin: 45, priceCents: 9900 }]));
    expect((await POST(reserva("outro-servico"), { params: { slug: "empresa1" } })).status).toBe(409);
    expect(marcarNaAgenda).not.toHaveBeenCalled();
  });

  it("pede escolha do serviço quando há mais de uma duração possível", async () => {
    db.company.findFirst.mockResolvedValue(negocio([{ id: "s1", name: "Revisão", durationMin: 45, priceCents: 9900 }, { id: "s2", name: "Ajuste", durationMin: 20, priceCents: 5000 }]));
    expect((await POST(reserva(undefined), { params: { slug: "empresa1" } })).status).toBe(409);
    expect(marcarNaAgenda).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("não calcula disponibilidade com duração inválida %s", (duracaoMin) => {
    expect(calcularSlots({ dia: new Date("2026-10-21T00:00:00Z"), horarios: [{ day: 3, open: "09:00", close: "18:00", closed: false }],
      duracaoMin, ocupados: [], agora: new Date("2026-10-20T00:00:00Z") })).toEqual([]);
  });
});
