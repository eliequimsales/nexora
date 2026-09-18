import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  instanteLocalParaUtc,
  formatarHoraLocal,
  formatarDataLocal,
  criarAgendamento,
  concluirAtendimento,
  atualizarStatusAgendamento,
} from "@/lib/agenda/painel";
import { classificar } from "@/lib/recuperacao/esteiras";
import { calcularCiclo } from "@/lib/recuperacao/ciclo";

// Mock do prisma para isolamento em testes unitários rápidos
vi.mock("@/lib/db", () => {
  const db = {
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    visit: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(db)),
  };
  return { prisma: db };
});

import { prisma } from "@/lib/db";

describe("Fase 3: Agenda Inteligente da Nexora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cálculos de fuso horário de Brasília (UTC-3)", () => {
    it("converte data e hora local de Brasília para o instante UTC correto", () => {
      // 09:00 em Brasília (UTC-3) corresponde a 12:00 UTC
      const instante = instanteLocalParaUtc("2026-06-15", "09:00");
      expect(instante.toISOString()).toBe("2026-06-15T12:00:00.000Z");
    });

    it("formata instante UTC de volta para horário local de Brasília", () => {
      const utc = new Date("2026-06-15T12:00:00.000Z");
      expect(formatarHoraLocal(utc)).toBe("09:00");
      expect(formatarDataLocal(utc)).toBe("2026-06-15");
    });
  });

  describe("Auto-cadastro de clientes na Agenda", () => {
    it("cadastra automaticamente um novo cliente em Customer ao agendar", async () => {
      const fakeCustomer = {
        id: "cli_123",
        name: "Carlos Ferreira",
        phone: "11988887777",
      };
      const fakeAppointment = {
        id: "app_123",
        companyId: "comp_1",
        customerId: "cli_123",
        startsAt: new Date("2026-06-15T13:00:00.000Z"),
        endsAt: new Date("2026-06-15T13:30:00.000Z"),
        status: "MARCADO",
        source: "PAINEL",
        customer: fakeCustomer,
        service: { id: "srv_1", name: "Corte Masculino", priceCents: 5000, durationMin: 30 },
      };

      // Cliente não existe
      (prisma.customer.findFirst as any).mockResolvedValueOnce(null);
      (prisma.customer.create as any).mockResolvedValueOnce(fakeCustomer);
      (prisma.service.findFirst as any).mockResolvedValueOnce({
        id: "srv_1",
        name: "Corte Masculino",
        priceCents: 5000,
        durationMin: 30,
      });
      (prisma.appointment.create as any).mockResolvedValueOnce(fakeAppointment);

      const res = await criarAgendamento("comp_1", {
        nome: "Carlos Ferreira",
        telefone: "(11) 98888-7777",
        serviceId: "srv_1",
        data: "2026-06-15",
        hora: "10:00",
        duracaoMin: 30,
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "comp_1",
          name: "Carlos Ferreira",
          phone: "11988887777",
          source: "PAINEL",
        }),
        select: { id: true, name: true, phone: true },
      });

      expect(prisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "comp_1",
          customerId: "cli_123",
          serviceId: "srv_1",
          status: "MARCADO",
          source: "PAINEL",
        }),
        include: expect.any(Object),
      });

      expect(res.id).toBe("app_123");
    });

    it("reaproveita cliente existente pelo telefone sem criar duplicata", async () => {
      const clienteExistente = {
        id: "cli_existente",
        name: "Mariana Souza",
        phone: "11977776666",
      };

      (prisma.customer.findFirst as any).mockResolvedValueOnce(clienteExistente);
      (prisma.appointment.create as any).mockResolvedValueOnce({
        id: "app_456",
        customerId: "cli_existente",
        status: "MARCADO",
      });

      await criarAgendamento("comp_1", {
        nome: "Mariana Souza",
        telefone: "11 97777-6666",
        data: "2026-06-15",
        hora: "14:00",
      });

      // Não deve chamar customer.create
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: "cli_existente",
          }),
        }),
      );
    });

    it("cria Visit imediatamente quando jaAtendido for marcado", async () => {
      const cliente = { id: "cli_999", name: "Lucas", phone: "11999990000" };
      (prisma.customer.findFirst as any).mockResolvedValueOnce(cliente);
      (prisma.service.findFirst as any).mockResolvedValueOnce(null);
      (prisma.service.create as any).mockResolvedValueOnce({ id: "srv_criado", priceCents: 4500 });
      (prisma.appointment.create as any).mockResolvedValueOnce({
        id: "app_ja_feito",
        customerId: "cli_999",
        status: "ATENDIDO",
      });

      await criarAgendamento("comp_1", {
        nome: "Lucas",
        telefone: "11999990000",
        servicoNome: "Barba Terapia",
        valorCents: 4500,
        data: "2026-06-15",
        hora: "11:00",
        jaAtendido: true,
      });

      expect(prisma.visit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: "cli_999",
          valueCents: 4500,
          service: "Barba Terapia",
        }),
      });
    });
  });

  describe("Conclusão de atendimento e registro de Visita", () => {
    it("concluirAtendimento atualiza status para ATENDIDO e cria Visit", async () => {
      const agendamento = {
        id: "app_concluir",
        companyId: "comp_1",
        customerId: "cli_555",
        startsAt: new Date("2026-06-15T15:00:00.000Z"),
        service: { name: "Corte e Barba", priceCents: 7500 },
      };

      (prisma.appointment.findFirst as any).mockResolvedValueOnce(agendamento);
      (prisma.appointment.update as any).mockResolvedValueOnce({
        ...agendamento,
        status: "ATENDIDO",
      });
      (prisma.visit.findFirst as any).mockResolvedValueOnce(null); // Sem visita prévia

      await concluirAtendimento("comp_1", "app_concluir", {
        valorCents: 7500,
        servicoNome: "Corte e Barba",
      });

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "app_concluir" },
        data: { status: "ATENDIDO" },
        include: expect.any(Object),
      });

      expect(prisma.visit.create).toHaveBeenCalledWith({
        data: {
          customerId: "cli_555",
          occurredAt: agendamento.startsAt,
          valueCents: 7500,
          service: "Corte e Barba",
        },
      });
    });

    it("não duplica visita se concluirAtendimento for chamado mais de uma vez", async () => {
      const agendamento = {
        id: "app_repetido",
        companyId: "comp_1",
        customerId: "cli_555",
        startsAt: new Date("2026-06-15T15:00:00.000Z"),
        service: { name: "Corte", priceCents: 4000 },
      };

      (prisma.appointment.findFirst as any).mockResolvedValueOnce(agendamento);
      (prisma.appointment.update as any).mockResolvedValueOnce({
        ...agendamento,
        status: "ATENDIDO",
      });
      // Visita já existe!
      (prisma.visit.findFirst as any).mockResolvedValueOnce({
        id: "visita_existente",
      });

      await concluirAtendimento("comp_1", "app_repetido");

      expect(prisma.visit.create).not.toHaveBeenCalled();
    });
  });

  describe("Integração com Monitoramento de Retorno e Onda", () => {
    it("cliente com agendamento futuro marcado NÃO entra na esteira de recuperação", () => {
      const hoje = new Date("2026-06-15T12:00:00.000Z");
      const ultimaVisita = new Date("2026-05-01T12:00:00.000Z"); // 45 dias atrás
      const ciclo = { dias: 24, confianca: "alta" as const, visitas: 3, motivo: "" };

      // Se tem agendamento futuro marcado:
      const classificacao = classificar({
        ultimaVisita,
        ciclo,
        temAgendamentoFuturo: true,
        hoje,
      });

      expect(classificacao.esteira).toBe("EM_DIA");
    });

    it("cliente sem agendamento futuro e com visita antiga entra na esteira de atraso", () => {
      const hoje = new Date("2026-06-15T12:00:00.000Z");
      const ultimaVisita = new Date("2026-05-10T12:00:00.000Z"); // 36 dias atrás (ciclo 24 dias)
      const ciclo = { dias: 24, confianca: "alta" as const, visitas: 3, motivo: "" };

      const classificacao = classificar({
        ultimaVisita,
        ciclo,
        temAgendamentoFuturo: false,
        hoje,
      });

      expect(["PRE_ATRASO", "ATRASO", "RESGATE"]).toContain(classificacao.esteira);
      expect(classificacao.diasAlemDoCiclo).toBeGreaterThan(0);
    });
  });
});
