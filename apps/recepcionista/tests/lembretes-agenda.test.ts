import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  separarSlotsPorTurno,
  gerarGoogleCalendarLink,
  gerarIcsConteudo,
} from "@/lib/agenda/disponibilidade";
import {
  formatarDataPorExtensoBr,
  gerarTextoLembrete,
  marcarLembreteEnviado,
  obterLembretes,
} from "@/lib/agenda/painel";

vi.mock("@/lib/db", () => {
  const db = {
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    companyProfile: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: db };
});

import { prisma } from "@/lib/db";

describe("Sistema de Lembretes Anti-Faltas e Disponibilidade por Turnos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("separarSlotsPorTurno", () => {
    it("agrupa horários corretamente entre Manhã, Tarde e Noite", () => {
      const slots = ["08:00", "09:30", "11:45", "12:00", "14:30", "17:45", "18:00", "19:30", "20:15"];
      const turnos = separarSlotsPorTurno(slots);

      expect(turnos.manha).toEqual(["08:00", "09:30", "11:45"]);
      expect(turnos.tarde).toEqual(["12:00", "14:30", "17:45"]);
      expect(turnos.noite).toEqual(["18:00", "19:30", "20:15"]);
    });

    it("retorna listas vazias para turnos sem slots", () => {
      const slots = ["13:00", "15:00"];
      const turnos = separarSlotsPorTurno(slots);

      expect(turnos.manha).toEqual([]);
      expect(turnos.tarde).toEqual(["13:00", "15:00"]);
      expect(turnos.noite).toEqual([]);
    });
  });

  describe("gerarGoogleCalendarLink", () => {
    it("monta a URL do Google Calendar com parâmetros codificados", () => {
      const link = gerarGoogleCalendarLink({
        titulo: "Consulta Dermatologia - Clínica Bem Estar",
        descricao: "Atendimento com Dra. Camila",
        localizacao: "Av. Paulista, 1000",
        startsAt: new Date("2026-06-15T13:00:00.000Z"),
        endsAt: new Date("2026-06-15T13:30:00.000Z"),
      });

      expect(link).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
      expect(link).toContain("Consulta+Dermatologia+-+Cl%C3%ADnica+Bem+Estar");
      expect(link).toContain("20260615T130000Z");
      expect(link).toContain("20260615T133000Z");
      expect(link).toContain("Av.+Paulista%2C+1000");
    });
  });

  describe("gerarIcsConteudo", () => {
    it("gera arquivo no formato iCalendar (.ics) com alarme de 2 horas antes", () => {
      const ics = gerarIcsConteudo({
        titulo: "Limpeza Dental - Odonto Premium",
        descricao: "Dr. Marcelo",
        localizacao: "Rua das Flores, 50",
        startsAt: new Date("2026-06-15T14:00:00.000Z"),
        endsAt: new Date("2026-06-15T14:45:00.000Z"),
      });

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("SUMMARY:Limpeza Dental - Odonto Premium");
      expect(ics).toContain("DTSTART:20260615T140000Z");
      expect(ics).toContain("DTEND:20260615T144500Z");
      expect(ics).toContain("BEGIN:VALARM");
      expect(ics).toContain("TRIGGER:-PT2H");
      expect(ics).toContain("END:VCALENDAR");
    });
  });

  describe("formatarDataPorExtensoBr e gerarTextoLembrete", () => {
    it("formata a data para texto por extenso legível em português", () => {
      const texto = formatarDataPorExtensoBr("2026-06-15");
      expect(texto).toContain("segunda-feira");
      expect(texto).toContain("15 de junho");
    });

    it("gera mensagem humanizada e universal para WhatsApp", () => {
      const msg = gerarTextoLembrete({
        clienteNome: "Rodrigo Mendonça",
        empresaNome: "Clínica Vida Ativa",
        servicoNome: "Sessão de Fisioterapia",
        profissionalNome: "Dr. André",
        dataIso: "2026-06-15",
        hora: "10:30",
        endereco: "Rua do Comércio, 123",
      });

      expect(msg).toContain("Olá, Rodrigo!");
      expect(msg).toContain("Clínica Vida Ativa");
      expect(msg).toContain("Sessão de Fisioterapia");
      expect(msg).toContain("Dr. André");
      expect(msg).toContain("10:30");
      expect(msg).toContain("Rua do Comércio, 123");
      expect(msg).toContain("Caso precise remarcar");
    });
  });

  describe("obterLembretes e marcarLembreteEnviado", () => {
    it("marca lembrete como enviado com timestamp no campo notes", async () => {
      (prisma.appointment.findFirst as any).mockResolvedValueOnce({
        id: "app_123",
        notes: JSON.stringify({ profissional: "Dra. Camila", observacoes: "Primeira consulta" }),
      });
      (prisma.appointment.update as any).mockResolvedValueOnce({ id: "app_123" });

      await marcarLembreteEnviado("comp_1", "app_123");

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "app_123" },
        data: {
          notes: expect.stringContaining('"lembreteEnviado":true'),
        },
      });
    });

    it("obterLembretes filtra agendamentos válidos e anexa link para WhatsApp", async () => {
      (prisma.company.findUnique as any).mockResolvedValueOnce({
        id: "comp_1",
        name: "Studio Beleza Pura",
        profile: { address: "Rua Augusta, 500" },
      });

      (prisma.appointment.findMany as any).mockResolvedValueOnce([
        {
          id: "app_1",
          companyId: "comp_1",
          customerId: "cli_1",
          startsAt: new Date("2026-06-15T12:00:00.000Z"), // 09:00 Brasília
          endsAt: new Date("2026-06-15T12:30:00.000Z"),
          status: "MARCADO",
          source: "LINK",
          notes: JSON.stringify({ profissional: "Fernanda", lembreteEnviado: false }),
          customer: {
            id: "cli_1",
            name: "Juliana Silva",
            phone: "11999998888",
            notes: "",
            optOut: false,
            visits: [],
          },
          service: { id: "srv_1", name: "Design de Sobrancelhas", priceCents: 6000, durationMin: 30 },
        },
      ]);

      const lembretes = await obterLembretes("comp_1", "2026-06-15");
      expect(lembretes).toHaveLength(1);
      expect(lembretes[0].nome).toBe("Juliana Silva");
      expect(lembretes[0].whatsappUrl).toContain("https://wa.me/5511999998888");
      expect(decodeURIComponent(lembretes[0].whatsappUrl)).toContain("Design de Sobrancelhas");
    });
  });
});
