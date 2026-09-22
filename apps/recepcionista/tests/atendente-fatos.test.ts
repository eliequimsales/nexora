import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    company: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn(), update: vi.fn() },
    service: { updateMany: vi.fn(), findMany: vi.fn() },
    knowledgeItem: { findMany: vi.fn() },
    atendenteAtendimento: { count: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
  };
  return { prisma: db };
});

import { prisma } from "@/lib/db";
import { fatosDaEmpresa, textoDosFatos, type Fatos } from "@/lib/atendente/fatos";
import { mesDoDia, registrarAtendimento, usoDoAtendente } from "@/lib/atendente/uso";

/**
 * OS FATOS DA EMPRESA — A ÚNICA FONTE DO ATENDENTE.
 *
 * Serviços, preços e duração vêm da agenda; horário, endereço, pagamento e
 * perguntas vêm do cadastro e do Treinamento aprovado. A equipe de exemplo da
 * agenda nunca aparece para o cliente, e a lista de profissionais guardada em
 * `serviceRules` nunca vira "regra".
 */

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  company: { findUnique: Fn };
  companyProfile: { findUnique: Fn; update: Fn };
  service: { updateMany: Fn; findMany: Fn };
  knowledgeItem: { findMany: Fn };
  atendenteAtendimento: { count: Fn; upsert: Fn; findUnique: Fn };
};

const PERFIL = {
  atendenteNome: "Bia",
  atendenteJeito: "DESCONTRAIDO",
  atendenteMarca: true,
  atendenteExpediente: true,
  businessHours: [{ day: 1, open: "09:00", close: "19:00", closed: false }],
  diasFechados: ["2026-10-12"],
  address: "Rua das Flores, 100",
  paymentMethods: "Pix e cartão",
  faqs: [{ question: "Tem estacionamento?", answer: "Sim, conveniado." }],
  serviceRules: JSON.stringify([{ id: "p1", nome: "Léo", cargo: "Cabeleireiro" }]),
};

describe("fatosDaEmpresa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://app.exemplo";
    db.company.findUnique.mockResolvedValue({ name: "Barbearia do Léo", slug: "barbearia-do-leo", profile: PERFIL });
    db.companyProfile.findUnique.mockResolvedValue(PERFIL);
    db.service.updateMany.mockResolvedValue({ count: 0 });
    db.service.findMany.mockResolvedValue([
      { id: "s1", name: "Corte", durationMin: 40, priceCents: 4500 },
      { id: "s2", name: "Luzes", durationMin: 90, priceCents: 0 },
    ]);
    db.knowledgeItem.findMany.mockResolvedValue([{ question: "Fazem barba?", answer: "Sim, com toalha quente." }]);
  });

  it("junta agenda, cadastro e Treinamento", async () => {
    const f = await fatosDaEmpresa("c1");
    expect(f.empresa).toBe("Barbearia do Léo");
    expect(f.nome).toBe("Bia");
    expect(f.jeito).toBe("DESCONTRAIDO");
    expect(f.servicos).toEqual([
      { id: "s1", nome: "Corte", precoCents: 4500, duracaoMin: 40 },
      { id: "s2", nome: "Luzes", precoCents: 0, duracaoMin: 90 },
    ]);
    expect(f.profissionais).toEqual(["Léo"]);
    expect(f.perguntas.map((p) => p.question)).toEqual(["Tem estacionamento?", "Fazem barba?"]);
    expect(f.diasFechados).toEqual(["2026-10-12"]);
    expect(f.linkAgenda).toBe("https://app.exemplo/agendar/barbearia-do-leo");
  });

  it("a equipe de exemplo da agenda não vira profissional para o cliente", async () => {
    db.companyProfile.findUnique.mockResolvedValue({ ...PERFIL, serviceRules: "" });
    expect((await fatosDaEmpresa("c1")).profissionais).toEqual([]);
  });

  it("o simulador pode testar nome, jeito e marcação antes de salvar", async () => {
    const f = await fatosDaEmpresa("c1", { nome: "Duda", jeito: "DIRETO", marcaDireto: false });
    expect(f).toMatchObject({ nome: "Duda", jeito: "DIRETO", marcaDireto: false });
  });

  it("sem endereço do app, não inventa link", async () => {
    delete process.env.APP_URL;
    expect((await fatosDaEmpresa("c1")).linkAgenda).toBeNull();
  });
});

describe("textoDosFatos — o que a IA recebe e o verificador confere", () => {
  const fatos: Fatos = {
    empresa: "Barbearia do Léo",
    nome: "Bia",
    jeito: "ACOLHEDOR",
    marcaDireto: true,
    expediente: true,
    servicos: [
      { id: "s1", nome: "Corte", precoCents: 4500, duracaoMin: 40 },
      { id: "s2", nome: "Luzes", precoCents: 0, duracaoMin: 90 },
    ],
    profissionais: ["Léo", "Diego"],
    horarios: [
      { day: 1, open: "09:00", close: "19:00", closed: false },
      { day: 0, open: "09:00", close: "19:00", closed: true },
    ],
    diasFechados: [],
    endereco: "Rua das Flores, 100",
    pagamento: "Pix e cartão",
    perguntas: [{ question: "Tem estacionamento?", answer: "Sim, conveniado." }],
    linkAgenda: "https://app.exemplo/agendar/barbearia-do-leo",
  };

  it("preço formatado, duração, profissionais, horário, endereço, pagamento e perguntas", () => {
    const t = textoDosFatos(fatos);
    expect(t).toContain("Corte — R$ 45,00, 40 min");
    expect(t).toContain("Luzes — valor não cadastrado, 90 min");
    expect(t).toContain("Profissionais: Léo, Diego");
    expect(t).toContain("seg das 09:00 às 19:00");
    expect(t).toContain("Rua das Flores, 100");
    expect(t).toContain("Pix e cartão");
    expect(t).toContain("P: Tem estacionamento?");
  });

  it("o que falta é dito como falta, nunca preenchido", () => {
    const t = textoDosFatos({ ...fatos, endereco: "", pagamento: "", perguntas: [], servicos: [] });
    expect(t).toContain("Endereço: não cadastrado");
    expect(t).toContain("Formas de pagamento: não cadastradas");
    expect(t).toContain("Serviços: nenhum cadastrado");
  });
});

describe("uso do Atendente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("o mês de um dia", () => {
    expect(mesDoDia("2026-09-22")).toBe("2026-09");
  });

  it("conta as conversas do mês pelo dia de Brasília e as da semana grátis desde a primeira vez", async () => {
    const primeira = new Date("2026-09-20T12:00:00.000Z");
    db.companyProfile.findUnique.mockResolvedValue({ atendenteLigadoPrimeiraVezEm: primeira });
    db.atendenteAtendimento.count.mockResolvedValueOnce(37).mockResolvedValueOnce(12);
    const uso = await usoDoAtendente("c1", new Date("2026-09-23T01:00:00.000Z"));
    expect(uso).toEqual({ conversasNoMes: 37, conversasNaSemana: 12, primeiraVezEm: primeira });
    expect(db.atendenteAtendimento.count.mock.calls[0][0].where).toMatchObject({
      companyId: "c1",
      dia: { startsWith: "2026-09" },
    });
  });

  it("nunca ligado: nada na semana grátis", async () => {
    db.companyProfile.findUnique.mockResolvedValue({ atendenteLigadoPrimeiraVezEm: null });
    db.atendenteAtendimento.count.mockResolvedValueOnce(0);
    const uso = await usoDoAtendente("c1", new Date());
    expect(uso.conversasNaSemana).toBe(0);
    expect(db.atendenteAtendimento.count).toHaveBeenCalledTimes(1);
  });

  it("registrar soma na conversa do dia, sem duplicar", async () => {
    await registrarAtendimento({
      companyId: "c1",
      conversationId: "conv1",
      dia: "2026-09-22",
      foraDoHorario: true,
      clienteNome: "Rafael",
      clienteTelefone: "5511988887777",
      respostas: 1,
      marcados: 1,
      valorMarcadoCents: 4500,
    });
    const chamada = db.atendenteAtendimento.upsert.mock.calls[0][0];
    expect(chamada.where).toEqual({ conversationId_dia: { conversationId: "conv1", dia: "2026-09-22" } });
    expect(chamada.update.respostas).toEqual({ increment: 1 });
    expect(chamada.update.marcados).toEqual({ increment: 1 });
    expect(chamada.create).toMatchObject({ respostas: 1, marcados: 1, valorMarcadoCents: 4500 });
  });
});
