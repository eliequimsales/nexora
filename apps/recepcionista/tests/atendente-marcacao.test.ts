import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco falso: a marcação é testada sem Postgres, e a transação roda o
// callback com o mesmo objeto.
vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    appointment: { findMany: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn() },
    supressao: { count: vi.fn() },
    companyProfile: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };
  return { prisma: db };
});

import { prisma } from "@/lib/db";
import { lerDiasFechados } from "@/lib/agenda/horario";
import { livresDoDia } from "@/lib/agenda/livres";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";

/**
 * A MARCAÇÃO É UMA SÓ: A DA PÁGINA PÚBLICA E A DO ATENDENTE.
 *
 * A transação serializável que impede dois clientes no mesmo horário saiu da
 * rota pública para lib/agenda/marcacao.ts, e o Atendente usa a mesma. Assim o
 * que é "livre" nunca significa uma coisa no link e outra no WhatsApp.
 */

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  appointment: { findMany: Fn; create: Fn };
  customer: { findFirst: Fn; create: Fn };
  supressao: { count: Fn };
  companyProfile: { findUnique: Fn; update: Fn };
  $transaction: Fn;
};

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};

const AGORA = emBrasilia("2026-09-22", 22);
const HORARIOS = [{ day: 3, open: "09:00", close: "19:00", closed: false }];
const EQUIPE = JSON.stringify([
  { id: "p1", nome: "Léo", cargo: "Cabeleireiro" },
  { id: "p2", nome: "Diego", cargo: "Cabeleireiro" },
]);

const pedido = (p: Partial<Parameters<typeof marcarNaAgenda>[0]> = {}): Parameters<typeof marcarNaAgenda>[0] => ({
  companyId: "c1",
  servico: { id: "s1", nome: "Corte", duracaoMin: 40 },
  inicio: emBrasilia("2026-09-23", 11),
  profissional: "Léo",
  cliente: { nome: "Rafael", telefone: "5511988887777" },
  origem: "ATENDENTE",
  agora: AGORA,
  ...p,
});

const ocupadoLeo11h = {
  startsAt: emBrasilia("2026-09-23", 11),
  endsAt: emBrasilia("2026-09-23", 11, 40),
  notes: JSON.stringify({ profissional: "Léo" }),
};

describe("marcarNaAgenda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.companyProfile.findUnique.mockResolvedValue({ businessHours: HORARIOS, diasFechados: [], serviceRules: EQUIPE });
    db.appointment.findMany.mockResolvedValue([]);
    db.customer.findFirst.mockResolvedValue(null);
    db.customer.create.mockResolvedValue({ id: "cli1" });
    db.supressao.count.mockResolvedValue(0);
    db.appointment.create.mockResolvedValue({ id: "ag1" });
  });

  it("horário livre: marca com a origem, o profissional e o serviço", async () => {
    const r = await marcarNaAgenda(pedido());
    expect(r).toMatchObject({ ok: true, profissional: "Léo", appointmentId: "ag1" });
    const criado = db.appointment.create.mock.calls[0][0].data;
    expect(criado.source).toBe("ATENDENTE");
    expect(criado.serviceId).toBe("s1");
    expect(JSON.parse(criado.notes)).toMatchObject({ profissional: "Léo", servicoNome: "Corte" });
    expect(db.customer.create.mock.calls[0][0].data.source).toBe("ATENDENTE");
  });

  it("a transação é serializável, como na página pública", async () => {
    await marcarNaAgenda(pedido());
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });

  it("profissional pedido ocupado: não marca", async () => {
    db.appointment.findMany.mockResolvedValue([ocupadoLeo11h]);
    expect(await marcarNaAgenda(pedido())).toEqual({ ok: false, motivo: "OCUPADO" });
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it("profissionais diferentes no mesmo horário: o Diego ocupado não bloqueia o Léo", async () => {
    db.appointment.findMany.mockResolvedValue([{ ...ocupadoLeo11h, notes: JSON.stringify({ profissional: "Diego" }) }]);
    expect(await marcarNaAgenda(pedido())).toMatchObject({ ok: true, profissional: "Léo" });
  });

  it("sem profissional pedido, o primeiro livre da equipe", async () => {
    db.appointment.findMany.mockResolvedValue([ocupadoLeo11h]);
    expect(await marcarNaAgenda(pedido({ profissional: null }))).toMatchObject({ ok: true, profissional: "Diego" });
  });

  it("fora do expediente não é horário", async () => {
    expect(await marcarNaAgenda(pedido({ inicio: emBrasilia("2026-09-23", 20) }))).toEqual({
      ok: false,
      motivo: "OCUPADO",
    });
  });

  it("dia fechado pelo botão não é horário", async () => {
    db.companyProfile.findUnique.mockResolvedValue({
      businessHours: HORARIOS,
      diasFechados: ["2026-09-23"],
      serviceRules: EQUIPE,
    });
    expect(await marcarNaAgenda(pedido())).toEqual({ ok: false, motivo: "OCUPADO" });
  });

  it("cliente que já existe não é reescrito", async () => {
    db.customer.findFirst.mockResolvedValue({ id: "cli-antigo" });
    await marcarNaAgenda(pedido());
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.appointment.create.mock.calls[0][0].data.customerId).toBe("cli-antigo");
  });

  it("perder a corrida no banco é o horário ocupado, não um erro", async () => {
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error("conflito"), { code: "P2034" }));
    expect(await marcarNaAgenda(pedido())).toEqual({ ok: false, motivo: "OCUPADO" });
  });

  it("no simulador, só confere: nada é criado", async () => {
    const r = await marcarNaAgenda(pedido({ simulacao: true }));
    expect(r).toMatchObject({ ok: true, profissional: "Léo", appointmentId: null });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.appointment.create).not.toHaveBeenCalled();
    expect(db.customer.create).not.toHaveBeenCalled();
  });
});

describe("livresDoDia — o que está livre, e com quem", () => {
  const base = {
    dia: "2026-09-23",
    horarios: HORARIOS,
    duracaoMin: 30,
    agendamentos: [] as { startsAt: Date; endsAt: Date; notes: string }[],
    profissionais: ["Léo", "Diego"],
    mostrarProfissional: true,
    agora: AGORA,
  };
  const hora = (d: Date) => {
    const local = new Date(d.getTime() - 3 * 60 * 60_000);
    return `${local.getUTCHours()}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  };

  it("cada horário vai para o primeiro profissional livre", () => {
    const livres = livresDoDia({
      ...base,
      agendamentos: [
        { startsAt: emBrasilia("2026-09-23", 9), endsAt: emBrasilia("2026-09-23", 9, 30), notes: JSON.stringify({ profissional: "Léo" }) },
      ],
    });
    expect(livres.slice(0, 2).map((l) => `${hora(l.inicio)} ${l.profissional}`)).toEqual(["9:00 Diego", "9:30 Léo"]);
  });

  it("com todos ocupados, o horário some", () => {
    const livres = livresDoDia({
      ...base,
      agendamentos: ["Léo", "Diego"].map((p) => ({
        startsAt: emBrasilia("2026-09-23", 10),
        endsAt: emBrasilia("2026-09-23", 10, 30),
        notes: JSON.stringify({ profissional: p }),
      })),
    });
    expect(livres.map((l) => hora(l.inicio))).not.toContain("10:00");
  });

  it("pedido de profissional: só os horários dele", () => {
    const livres = livresDoDia({
      ...base,
      profissional: "Léo",
      agendamentos: [
        { startsAt: emBrasilia("2026-09-23", 9), endsAt: emBrasilia("2026-09-23", 9, 30), notes: JSON.stringify({ profissional: "Léo" }) },
      ],
    });
    expect(livres[0] && `${hora(livres[0].inicio)} ${livres[0].profissional}`).toBe("9:30 Léo");
  });

  it("equipe de exemplo não aparece no texto do cliente", () => {
    const livres = livresDoDia({ ...base, profissionais: ["Profissional Carlos"], mostrarProfissional: false });
    expect(livres[0].profissional).toBeNull();
  });

  it("respeita a antecedência mínima de uma hora", () => {
    const livres = livresDoDia({ ...base, agora: emBrasilia("2026-09-23", 10, 10) });
    expect(livres.map((l) => hora(l.inicio))[0]).toBe("11:30");
  });
});

describe("lerDiasFechados", () => {
  it("só aceita datas no formato AAAA-MM-DD", () => {
    expect(lerDiasFechados(["2026-10-12", "ontem", 5, "2026-13-40x"])).toEqual(["2026-10-12"]);
    expect(lerDiasFechados(null)).toEqual([]);
  });
});

describe("a página pública usa a mesma marcação", () => {
  const RAIZ = join(__dirname, "..");
  const rota = readFileSync(join(RAIZ, "app/api/agendar/[slug]/route.ts"), "utf8");
  const marcacao = readFileSync(join(RAIZ, "lib/agenda/marcacao.ts"), "utf8");

  it("a rota chama marcarNaAgenda com a origem LINK", () => {
    expect(rota).toContain("marcarNaAgenda(");
    expect(rota).toMatch(/origem:\s*"LINK"/);
  });

  it("as regras de entrada do cliente e da supressão ficam na marcação", () => {
    expect(marcacao).toContain("entradaPorLink(");
    expect(marcacao).toContain("hashTelefone(");
    expect(marcacao).toContain("ehConflitoDeConcorrencia(");
  });

  it("dia fechado pelo botão some da página pública", () => {
    expect(rota).toContain("lerDiasFechados(");
  });
});
