import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    companyProfile: { findMany: vi.fn(), updateMany: vi.fn() },
    company: { findUnique: vi.fn() },
    conversation: { findMany: vi.fn() },
    atendenteAtendimento: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/atendente/executar", () => ({ atender: vi.fn() }));
vi.mock("@/lib/reengajamento/email", () => ({ enviarEmail: vi.fn() }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));

import { prisma } from "@/lib/db";
import { CARENCIA_DO_RESGATE_MS, IDADE_MAXIMA_DO_RESGATE_MS, MINUTOS_SEM_RESPOSTA } from "@/lib/atendente/constantes";
import { ultimoFechamento } from "@/lib/atendente/datas";
import { atender } from "@/lib/atendente/executar";
import {
  pendentesParaResgate,
  resumoDaManha,
  rodadaDoResgate,
  type AtendimentoDoResumo,
  type Candidata,
} from "@/lib/atendente/resgate";
import { logError } from "@/lib/errors";
import { enviarEmail } from "@/lib/reengajamento/email";

/**
 * O RESGATE DE CADA MINUTO E O RESUMO DA MANHÃ.
 *
 * No expediente, a mensagem é do dono; se ninguém responder em 5 minutos, o
 * Atendente entra. Com a loja fechada, quem responde é o webhook, na hora — o
 * resgate só pega o que ficou para trás. Na abertura, o dono recebe por e-mail
 * o que aconteceu enquanto estava fechado.
 */

const RAIZ = join(__dirname, "..");
const MIN = 60_000;
const emBrasilia = (data: string, h: number, m = 0, s = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m, s));
};

const HORARIOS = [
  { day: 0, open: "09:00", close: "19:00", closed: true },
  { day: 1, open: "09:00", close: "19:00", closed: false },
  { day: 2, open: "09:00", close: "19:00", closed: false },
  { day: 3, open: "09:00", close: "19:00", closed: false },
  { day: 4, open: "09:00", close: "19:00", closed: false },
  { day: 5, open: "09:00", close: "19:00", closed: false },
  { day: 6, open: "09:00", close: "14:00", closed: false },
];

describe("ultimoFechamento — desde quando a loja está fechada", () => {
  it("na abertura de quarta, foi terça às 19h", () => {
    expect(ultimoFechamento(HORARIOS, [], emBrasilia("2026-09-23", 9, 0, 30))).toEqual(emBrasilia("2026-09-22", 19));
  });

  it("na segunda, depois do domingo fechado, foi sábado às 14h", () => {
    expect(ultimoFechamento(HORARIOS, [], emBrasilia("2026-09-28", 9, 1))).toEqual(emBrasilia("2026-09-26", 14));
  });

  it("dia fechado pelo botão não abre nem fecha", () => {
    expect(ultimoFechamento(HORARIOS, ["2026-09-22"], emBrasilia("2026-09-23", 9, 1))).toEqual(
      emBrasilia("2026-09-21", 19),
    );
  });

  it("expediente que vira a madrugada fecha no dia seguinte", () => {
    const bar = [{ day: 2, open: "18:00", close: "02:00", closed: false }, { day: 3, open: "18:00", close: "02:00", closed: false }];
    expect(ultimoFechamento(bar, [], emBrasilia("2026-09-23", 18, 1))).toEqual(emBrasilia("2026-09-23", 2));
  });
});

// ——— A seleção: pura ———

const TERCA_10H06 = emBrasilia("2026-09-22", 10, 6);
const candidata = (p: Partial<Candidata> & { id: string }): Candidata => ({
  status: "AI",
  donoAssumiuEm: null,
  ultimaDoClienteEm: new Date(TERCA_10H06.getTime() - 6 * MIN),
  ultimaRole: "CUSTOMER",
  ...p,
});

describe("pendentesParaResgate — quem ficou sem resposta", () => {
  const aberta = { agora: TERCA_10H06, fechada: false };

  it(`loja aberta: com ${MINUTOS_SEM_RESPOSTA} minutos sim, com 4 ainda não`, () => {
    const ids = pendentesParaResgate(
      [
        candidata({ id: "cinco", ultimaDoClienteEm: new Date(TERCA_10H06.getTime() - 5 * MIN) }),
        candidata({ id: "quatro", ultimaDoClienteEm: new Date(TERCA_10H06.getTime() - 4 * MIN) }),
      ],
      aberta,
    );
    expect(ids).toEqual(["cinco"]);
  });

  it("já respondida pelo Atendente ou pela equipe, ou com o dono no celular: fica de fora", () => {
    const ids = pendentesParaResgate(
      [
        candidata({ id: "atendente", ultimaRole: "AI" }),
        candidata({ id: "equipe", ultimaRole: "HUMAN" }),
        candidata({ id: "dono", donoAssumiuEm: new Date(TERCA_10H06.getTime() - MIN) }),
        candidata({ id: "assumida", status: "HUMAN" }),
      ],
      aberta,
    );
    expect(ids).toEqual([]);
  });

  it("mensagem que já esfriou não é respondida", () => {
    const velha = new Date(TERCA_10H06.getTime() - IDADE_MAXIMA_DO_RESGATE_MS - MIN);
    expect(pendentesParaResgate([candidata({ id: "velha", ultimaDoClienteEm: velha })], aberta)).toEqual([]);
  });

  it("loja fechada: pega o que o webhook deixou para trás, passada a carência", () => {
    const agora = emBrasilia("2026-09-22", 22, 5);
    const ids = pendentesParaResgate(
      [
        candidata({ id: "esquecida", ultimaDoClienteEm: new Date(agora.getTime() - CARENCIA_DO_RESGATE_MS) }),
        candidata({ id: "recente", ultimaDoClienteEm: new Date(agora.getTime() - MIN) }),
      ],
      { agora, fechada: true },
    );
    expect(ids).toEqual(["esquecida"]);
  });
});

// ——— O resumo da manhã: puro ———

const atendimento = (p: Partial<AtendimentoDoResumo> = {}): AtendimentoDoResumo => ({
  clienteNome: "Rafael",
  clienteTelefone: "5511988887777",
  respostas: 2,
  marcados: 0,
  valorMarcadoCents: 0,
  precisaDoDono: false,
  motivo: "",
  urgente: false,
  resolvidoEm: null,
  ...p,
});

describe("resumoDaManha — o que aconteceu enquanto você estava fechado", () => {
  const agora = emBrasilia("2026-09-23", 9, 0, 30);

  it("sem nada para contar, não manda e-mail", () => {
    expect(resumoDaManha({ nome: "Bia", atendimentos: [], agora })).toBeNull();
  });

  it("conta conversas e horários marcados, com o valor dos atendimentos marcados", () => {
    const m = resumoDaManha({
      nome: "Bia",
      agora,
      atendimentos: [
        atendimento({ marcados: 1, valorMarcadoCents: 4500 }),
        atendimento({ clienteNome: null, clienteTelefone: "5511977776666" }),
        atendimento({ clienteNome: "Ana" }),
      ],
    })!;
    expect(m.assunto).toBe("Enquanto você estava fechado: 3 conversas, 1 horário marcado");
    expect(m.corpo).toContain("Bom dia! Enquanto você estava fechado, Bia atendeu 3 conversas e marcou 1 horário");
    expect(m.corpo).toContain("R$ 45,00 em atendimentos marcados");
    expect(m.corpo).toContain("Nada ficou esperando por você.");
    expect(m.acao.href).toBe("/painel/atendente");
    expect(`${m.assunto} ${m.corpo}`).not.toMatch(/garantid|receita/i);
  });

  it("lista o que precisa do dono, urgência primeiro, sem o que já foi resolvido", () => {
    const m = resumoDaManha({
      nome: "",
      agora,
      atendimentos: [
        atendimento({ precisaDoDono: true, motivo: "Perguntou o valor de Luzes" }),
        atendimento({ clienteNome: null, precisaDoDono: true, urgente: true, motivo: "Urgência: passou mal" }),
        atendimento({ clienteNome: "Ana", precisaDoDono: true, motivo: "Reclamação", resolvidoEm: agora }),
      ],
    })!;
    expect(m.corpo).toContain("o Atendente Virtual atendeu 3 conversas");
    const lista = m.corpo.slice(m.corpo.indexOf("Precisa de você:"));
    expect(lista.indexOf("Urgente — (11) 98888-7777: Urgência: passou mal")).toBeGreaterThan(-1);
    expect(lista.indexOf("Urgente")).toBeLessThan(lista.indexOf("Rafael: Perguntou o valor de Luzes"));
    expect(lista).not.toContain("Ana");
  });
});

// ——— A rodada, com o banco falso ———

type Fn = Mock;
const db = prisma as unknown as {
  companyProfile: { findMany: Fn; updateMany: Fn };
  company: { findUnique: Fn };
  conversation: { findMany: Fn };
  atendenteAtendimento: { findMany: Fn };
};

const perfil = (p: Record<string, unknown> = {}) => ({
  companyId: "c1",
  atendenteExpediente: true,
  atendenteNome: "Bia",
  businessHours: HORARIOS,
  diasFechados: [],
  atendenteResumoDia: "2026-09-22",
  ...p,
});

const conversa = (id: string, ultimaDoClienteEm: Date, role = "CUSTOMER") => ({
  id,
  status: "AI",
  donoAssumiuEm: null,
  lastCustomerMessageAt: ultimaDoClienteEm,
  messages: [{ role }],
});

const ENV = { url: process.env.EVOLUTION_API_URL, key: process.env.EVOLUTION_API_KEY };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EVOLUTION_API_URL = "https://evolution.exemplo.com";
  process.env.EVOLUTION_API_KEY = "chave-de-teste";
  db.companyProfile.findMany.mockResolvedValue([perfil()]);
  db.companyProfile.updateMany.mockResolvedValue({ count: 0 });
  db.conversation.findMany.mockResolvedValue([]);
  db.atendenteAtendimento.findMany.mockResolvedValue([]);
  db.company.findUnique.mockResolvedValue({ name: "Barbearia do Léo", email: "dono@exemplo.com", semEmail: false });
  (atender as Fn).mockResolvedValue({ acao: "RESPONDEU", mensagens: 1 });
});

afterEach(() => {
  if (ENV.url === undefined) delete process.env.EVOLUTION_API_URL;
  else process.env.EVOLUTION_API_URL = ENV.url;
  if (ENV.key === undefined) delete process.env.EVOLUTION_API_KEY;
  else process.env.EVOLUTION_API_KEY = ENV.key;
});

describe("rodadaDoResgate", () => {
  it("só olha empresas com o Atendente e o WhatsApp ligados", async () => {
    await rodadaDoResgate(TERCA_10H06);
    expect(db.companyProfile.findMany.mock.calls[0][0].where).toEqual({
      plantaoAtivo: true,
      whatsappInstance: { not: null },
      whatsappStatus: "CONNECTED",
    });
  });

  it("no expediente, responde quem esperou 5 minutos, pela mesma porta do webhook", async () => {
    db.conversation.findMany.mockResolvedValue([
      conversa("seis", new Date(TERCA_10H06.getTime() - 6 * MIN)),
      conversa("tres", new Date(TERCA_10H06.getTime() - 3 * MIN)),
    ]);
    const r = await rodadaDoResgate(TERCA_10H06);
    const onde = db.conversation.findMany.mock.calls[0][0].where;
    expect(onde.companyId).toBe("c1");
    expect(onde.status).toEqual({ not: "HUMAN" });
    expect(onde.lastCustomerMessageAt).toEqual({
      gte: new Date(TERCA_10H06.getTime() - IDADE_MAXIMA_DO_RESGATE_MS),
      lte: new Date(TERCA_10H06.getTime() - MINUTOS_SEM_RESPOSTA * MIN),
    });
    expect(atender).toHaveBeenCalledTimes(1);
    expect(atender).toHaveBeenCalledWith({ companyId: "c1", conversationId: "seis", origem: "RESGATE", agora: TERCA_10H06 });
    expect(r).toEqual({ respondidas: 1 });
  });

  it("sem a opção do expediente, a loja aberta é só do dono: nem procura", async () => {
    db.companyProfile.findMany.mockResolvedValue([perfil({ atendenteExpediente: false })]);
    await rodadaDoResgate(TERCA_10H06);
    expect(db.conversation.findMany).not.toHaveBeenCalled();
  });

  it("servidor do WhatsApp fora: encerra a rodada na primeira falha e registra uma vez", async () => {
    db.companyProfile.findMany.mockResolvedValue([perfil(), perfil({ companyId: "c2" })]);
    db.conversation.findMany.mockResolvedValue([
      conversa("a", new Date(TERCA_10H06.getTime() - 6 * MIN)),
      conversa("b", new Date(TERCA_10H06.getTime() - 7 * MIN)),
    ]);
    (atender as Fn).mockRejectedValue(new Error("Evolution API respondeu 502 em /message/sendText/x: bad gateway"));
    await rodadaDoResgate(TERCA_10H06);
    expect(atender).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("conexão que sumiu do servidor encerra só a rodada daquela empresa", async () => {
    db.companyProfile.findMany.mockResolvedValue([perfil(), perfil({ companyId: "c2" })]);
    db.conversation.findMany.mockResolvedValue([
      conversa("a", new Date(TERCA_10H06.getTime() - 6 * MIN)),
      conversa("b", new Date(TERCA_10H06.getTime() - 7 * MIN)),
    ]);
    (atender as Fn)
      .mockRejectedValueOnce(new Error('Evolution API respondeu 404 em /x: {"message":["The "x" instance does not exist"]}'))
      .mockResolvedValue({ acao: "RESPONDEU", mensagens: 1 });
    await rodadaDoResgate(TERCA_10H06);
    expect((atender as Fn).mock.calls.map((c) => [c[0].companyId, c[0].conversationId])).toEqual([
      ["c1", "a"],
      ["c2", "a"],
      ["c2", "b"],
    ]);
  });

  it("uma rodada por vez: a seguinte não começa enquanto a anterior não termina", async () => {
    db.conversation.findMany.mockResolvedValue([conversa("a", new Date(TERCA_10H06.getTime() - 6 * MIN))]);
    let liberar: () => void = () => {};
    (atender as Fn).mockImplementation(() => new Promise((r) => (liberar = () => r({ acao: "RESPONDEU", mensagens: 1 }))));
    const primeira = rodadaDoResgate(TERCA_10H06);
    await vi.waitFor(() => expect(atender).toHaveBeenCalledTimes(1));
    expect(await rodadaDoResgate(TERCA_10H06)).toEqual({ respondidas: 0 });
    liberar();
    expect(await primeira).toEqual({ respondidas: 1 });
    expect(db.companyProfile.findMany).toHaveBeenCalledTimes(1);
  });

  it("sem servidor do WhatsApp configurado, pula a rodada e avisa UMA vez", async () => {
    delete process.env.EVOLUTION_API_URL;
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await rodadaDoResgate(TERCA_10H06)).toEqual({ respondidas: 0 });
      expect(await rodadaDoResgate(TERCA_10H06)).toEqual({ respondidas: 0 });
      expect(aviso).toHaveBeenCalledTimes(1);
      expect(String(aviso.mock.calls[0][0])).toMatch(/EVOLUTION_API_URL/);
      expect(db.companyProfile.findMany).not.toHaveBeenCalled();
    } finally {
      aviso.mockRestore();
    }
  });
});

describe("o resumo da manhã na rodada", () => {
  const ABERTURA = emBrasilia("2026-09-23", 9, 0, 30);

  it("na abertura, reivindica o dia e manda o e-mail com o que houve desde o fechamento", async () => {
    db.companyProfile.updateMany.mockResolvedValue({ count: 1 });
    db.atendenteAtendimento.findMany.mockResolvedValue([atendimento({ marcados: 1, valorMarcadoCents: 4500 })]);
    await rodadaDoResgate(ABERTURA);
    expect(db.companyProfile.updateMany).toHaveBeenCalledWith({
      where: { companyId: "c1", atendenteResumoDia: { not: "2026-09-23" } },
      data: { atendenteResumoDia: "2026-09-23" },
    });
    expect(db.atendenteAtendimento.findMany.mock.calls[0][0].where).toEqual({
      companyId: "c1",
      foraDoHorario: true,
      atualizadoEm: { gte: emBrasilia("2026-09-22", 19) },
    });
    expect(enviarEmail).toHaveBeenCalledWith(
      "dono@exemplo.com",
      expect.objectContaining({ assunto: "Enquanto você estava fechado: 1 conversa, 1 horário marcado" }),
      // É e-mail de relacionamento: leva o descadastro assinado, como a régua.
      expect.stringMatching(/\/descadastro\?e=c1&t=[0-9a-f]{32}$/),
    );
  });

  it("outra rodada já reivindicou: não manda de novo", async () => {
    db.companyProfile.updateMany.mockResolvedValue({ count: 0 });
    await rodadaDoResgate(ABERTURA);
    expect(db.atendenteAtendimento.findMany).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("quem pediu para não receber e-mail da Nexora não recebe", async () => {
    db.companyProfile.updateMany.mockResolvedValue({ count: 1 });
    db.company.findUnique.mockResolvedValue({ name: "Barbearia do Léo", email: "dono@exemplo.com", semEmail: true });
    db.atendenteAtendimento.findMany.mockResolvedValue([atendimento()]);
    await rodadaDoResgate(ABERTURA);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("com a loja fechada, nem tenta", async () => {
    await rodadaDoResgate(emBrasilia("2026-09-22", 22));
    expect(db.companyProfile.updateMany).not.toHaveBeenCalled();
  });
});

describe("o lembrete antigo saiu do produto", () => {
  it("o servidor liga o resgate do Atendente, não o lembrete", () => {
    const instrumentacao = readFileSync(join(RAIZ, "instrumentation.ts"), "utf8");
    expect(instrumentacao).toContain('import("./lib/atendente/resgate")');
    expect(instrumentacao).toContain("iniciarResgate()");
    expect(instrumentacao).not.toMatch(/followup|FollowUp/);
  });

  it("nem o worker nem a rota do lembrete existem mais", () => {
    expect(existsSync(join(RAIZ, "lib/followup.ts"))).toBe(false);
    expect(existsSync(join(RAIZ, "app/api/cron/follow-ups/route.ts"))).toBe(false);
  });
});
