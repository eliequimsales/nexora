import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Banco falso e módulos de fora trocados por espiões: o executor é conferido
// ponta a ponta — do plano ao envio, à agenda e às anotações — sem Postgres,
// sem WhatsApp e sem IA.
vi.mock("@/lib/db", () => ({
  prisma: {
    companyProfile: { findUnique: vi.fn() },
    company: { findUnique: vi.fn() },
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    message: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    recoveryTouch: { updateMany: vi.fn() },
    lead: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/whatsapp/envio", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp/envio")>()),
  enviarWhatsApp: vi.fn(),
}));
vi.mock("@/lib/billing/guarda", () => ({ estadoDaEmpresa: vi.fn() }));
vi.mock("@/lib/atendente/uso", () => ({
  usoDoAtendente: vi.fn(),
  atendimentoDoDia: vi.fn(),
  registrarAtendimento: vi.fn(),
}));
vi.mock("@/lib/atendente/fatos", async (original) => ({
  ...(await original<typeof import("@/lib/atendente/fatos")>()),
  fatosDaEmpresa: vi.fn(),
}));
vi.mock("@/lib/agenda/livres", async (original) => ({
  ...(await original<typeof import("@/lib/agenda/livres")>()),
  horariosLivres: vi.fn(),
}));
vi.mock("@/lib/agenda/marcacao", () => ({ marcarNaAgenda: vi.fn() }));
vi.mock("@/lib/ai/provider", async (original) => ({
  ...(await original<typeof import("@/lib/ai/provider")>()),
  generateReceptionistReply: vi.fn(),
}));
vi.mock("@/lib/training", async (original) => ({
  ...(await original<typeof import("@/lib/training")>()),
  recordKnowledgeGap: vi.fn(),
}));
vi.mock("@/lib/reengajamento/email", () => ({ enviarEmail: vi.fn() }));

import { Prisma } from "@nexora/recepcionista-prisma";
import { prisma } from "@/lib/db";
import type { Livre } from "@/lib/agenda/livres";
import { horariosLivres } from "@/lib/agenda/livres";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";
import { generateReceptionistReply } from "@/lib/ai/provider";
import { ESPERA_DA_RAJADA_MS, MAX_RESPOSTAS_POR_DIA, TETO_CONVERSAS_MES } from "@/lib/atendente/constantes";
import {
  atender,
  avisoDeUrgencia,
  numeroDoDono,
  planejar,
  semResposta,
  type MensagemDaConversa,
} from "@/lib/atendente/executar";
import { fatosDaEmpresa, type Fatos } from "@/lib/atendente/fatos";
import { atendimentoDoDia, registrarAtendimento, usoDoAtendente } from "@/lib/atendente/uso";
import { estadoDaEmpresa } from "@/lib/billing/guarda";
import { enviarEmail } from "@/lib/reengajamento/email";
import { recordKnowledgeGap } from "@/lib/training";
import { enviarWhatsApp } from "@/lib/whatsapp/envio";

/**
 * O EXECUTOR — O CAMINHO REAL DO WHATSAPP.
 *
 * O motor decide a resposta; o executor decide SE e QUANDO ela sai, manda com
 * "digitando…", salva, e deixa o rastro: estado da conversa, atendimento do
 * dia, anotação para o dono, lacuna no Treinamento, marcação da Onda e aviso de
 * urgência.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};
const MIN = 60_000;

// Terça, 22/09/2026, 22h em Brasília: loja fechada.
const AGORA = emBrasilia("2026-09-22", 22);
const TERCA_10H = emBrasilia("2026-09-22", 10);

const HORARIOS = [
  { day: 0, open: "09:00", close: "19:00", closed: true },
  { day: 1, open: "09:00", close: "19:00", closed: false },
  { day: 2, open: "09:00", close: "19:00", closed: false },
  { day: 3, open: "09:00", close: "19:00", closed: false },
  { day: 4, open: "09:00", close: "19:00", closed: false },
  { day: 5, open: "09:00", close: "19:00", closed: false },
  { day: 6, open: "09:00", close: "14:00", closed: false },
];

const FATOS: Fatos = {
  empresa: "Barbearia do Léo",
  nome: "Bia",
  jeito: "ACOLHEDOR",
  marcaDireto: true,
  expediente: true,
  servicos: [
    { id: "s1", nome: "Corte", precoCents: 4500, duracaoMin: 40 },
    { id: "s2", nome: "Barba", precoCents: 3500, duracaoMin: 30 },
  ],
  profissionais: ["Léo"],
  horarios: HORARIOS,
  diasFechados: [],
  endereco: "Rua das Flores, 100",
  pagamento: "Pix e cartão",
  perguntas: [],
  linkAgenda: null,
};

const msg = (id: string, role: MensagemDaConversa["role"], content: string, createdAt: Date): MensagemDaConversa => ({
  id,
  role,
  content,
  createdAt,
});

// ——— O PLANO: puro, sem banco ———

const planoBase = (p: Partial<Parameters<typeof planejar>[0]> = {}): Parameters<typeof planejar>[0] => ({
  ligado: true,
  statusDaConversa: "AI",
  donoAssumiuEm: null,
  mensagens: [msg("m1", "CUSTOMER", "tem horário amanhã?", new Date(AGORA.getTime() - MIN))],
  estadoDaConta: "ATIVO",
  uso: { conversasNoMes: 10, conversasNaSemana: 0, primeiraVezEm: null },
  respostasHoje: null,
  horarios: HORARIOS,
  diasFechados: [],
  expediente: true,
  temWhatsApp: true,
  agora: AGORA,
  origem: "WEBHOOK",
  ...p,
});

describe("semResposta — o que o cliente escreveu depois da última resposta", () => {
  it("junta as mensagens do cliente desde a última resposta", () => {
    const pendentes = semResposta([
      msg("m1", "CUSTOMER", "oi", AGORA),
      msg("a1", "AI", "Oi!", AGORA),
      msg("m2", "CUSTOMER", "tudo bem?", AGORA),
      msg("m3", "CUSTOMER", "tem horário amanhã?", AGORA),
    ]);
    expect(pendentes.map((m) => m.id)).toEqual(["m2", "m3"]);
  });

  it("anotação do sistema não conta como resposta; a da equipe pelo painel conta", () => {
    expect(semResposta([msg("m1", "CUSTOMER", "oi", AGORA), msg("s1", "SYSTEM", "nota", AGORA)])).toHaveLength(1);
    expect(semResposta([msg("m1", "CUSTOMER", "oi", AGORA), msg("h1", "HUMAN", "Oi!", AGORA)])).toHaveLength(0);
  });
});

describe("planejar — se e quando o Atendente responde", () => {
  it("loja fechada: responde na hora, se apresentando na primeira do dia", () => {
    const plano = planejar(
      planoBase({
        mensagens: [
          msg("m1", "CUSTOMER", "oi", new Date(AGORA.getTime() - 2 * MIN)),
          msg("m2", "CUSTOMER", "tem horário amanhã?", new Date(AGORA.getTime() - MIN)),
        ],
      }),
    );
    expect(plano).toEqual({ acao: "RESPONDER", texto: "oi\ntem horário amanhã?", primeiraDoDia: true, contexto: "FECHADO" });
  });

  it("desligado, equipe na conversa, já respondida ou dono no celular: silêncio", () => {
    expect(planejar(planoBase({ ligado: false }))).toEqual({ acao: "SILENCIO", motivo: "DESLIGADO" });
    expect(planejar(planoBase({ statusDaConversa: "HUMAN" }))).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(
      planejar(planoBase({ mensagens: [msg("m1", "CUSTOMER", "oi", AGORA), msg("a1", "AI", "Oi!", AGORA)] })),
    ).toEqual({ acao: "SILENCIO", motivo: "JA_RESPONDIDA" });
    expect(planejar(planoBase({ donoAssumiuEm: new Date(AGORA.getTime() - 60 * MIN) }))).toEqual({
      acao: "SILENCIO",
      motivo: "DONO_ASSUMIU",
    });
  });

  it("loja aberta: o webhook espera; o resgate responde depois de 5 minutos, como expediente", () => {
    const mensagens = [msg("m1", "CUSTOMER", "tem horário?", new Date(TERCA_10H.getTime() - 6 * MIN))];
    expect(planejar(planoBase({ agora: TERCA_10H, mensagens }))).toEqual({ acao: "ESPERAR" });
    expect(planejar(planoBase({ agora: TERCA_10H, mensagens, origem: "RESGATE" }))).toMatchObject({
      acao: "RESPONDER",
      contexto: "EXPEDIENTE",
    });
    expect(planejar(planoBase({ agora: TERCA_10H, mensagens, expediente: false }))).toEqual({
      acao: "SILENCIO",
      motivo: "ABERTO",
    });
  });

  it("sem WhatsApp ligado, não tem por onde responder", () => {
    expect(planejar(planoBase({ temWhatsApp: false }))).toEqual({ acao: "SILENCIO", motivo: "SEM_WHATSAPP" });
  });

  it("teto do mês: conversa nova recebe o aviso uma vez; a que já estava sendo atendida continua", () => {
    const noTeto = { conversasNoMes: TETO_CONVERSAS_MES, conversasNaSemana: 0, primeiraVezEm: null };
    expect(planejar(planoBase({ uso: noTeto }))).toEqual({ acao: "AVISO_DO_TETO" });
    expect(planejar(planoBase({ uso: noTeto, respostasHoje: 0 }))).toEqual({ acao: "SILENCIO", motivo: "TETO_AVISADO" });
    expect(planejar(planoBase({ uso: noTeto, respostasHoje: 3 }))).toMatchObject({ acao: "RESPONDER" });
  });

  it("sem plano, depois da semana grátis: silêncio", () => {
    const plano = planejar(
      planoBase({
        estadoDaConta: "GRATIS",
        uso: { conversasNoMes: 5, conversasNaSemana: 5, primeiraVezEm: new Date(AGORA.getTime() - 8 * 86_400_000) },
      }),
    );
    expect(plano).toEqual({ acao: "SILENCIO", motivo: "SEM_PLANO" });
  });

  it("limite do dia: a oitava resposta vira o aviso; depois, silêncio", () => {
    expect(planejar(planoBase({ respostasHoje: MAX_RESPOSTAS_POR_DIA - 1 }))).toMatchObject({
      acao: "RESPONDER",
      primeiraDoDia: false,
    });
    expect(planejar(planoBase({ respostasHoje: MAX_RESPOSTAS_POR_DIA }))).toEqual({ acao: "AVISO_DO_LIMITE" });
    expect(planejar(planoBase({ respostasHoje: MAX_RESPOSTAS_POR_DIA + 1 }))).toEqual({
      acao: "SILENCIO",
      motivo: "LIMITE_DO_DIA",
    });
  });
});

describe("o aviso de urgência para o dono", () => {
  it("o número do dono vira número de WhatsApp com o 55", () => {
    expect(numeroDoDono("(11) 97777-6666")).toBe("5511977776666");
    expect(numeroDoDono("5511977776666")).toBe("5511977776666");
    expect(numeroDoDono("123")).toBeNull();
  });

  it("diz quem escreveu, o que escreveu e o que o Atendente fez", () => {
    const texto = avisoDeUrgencia({ cliente: "Rafael", telefone: "5511988887777", trecho: "meu filho está sangrando" });
    expect(texto).toContain("Rafael");
    expect(texto).toContain("meu filho está sangrando");
    expect(texto).toMatch(/192/);
  });
});

// ——— O CAMINHO INTEIRO, com o banco falso ———

type Fn = Mock;
const db = prisma as unknown as {
  companyProfile: { findUnique: Fn };
  company: { findUnique: Fn };
  conversation: { findFirst: Fn; update: Fn };
  message: { findMany: Fn; findFirst: Fn; create: Fn };
  recoveryTouch: { updateMany: Fn };
  lead: { upsert: Fn };
};

const PERFIL = {
  plantaoAtivo: true,
  atendenteExpediente: true,
  businessHours: HORARIOS,
  diasFechados: [],
  handoffKeywords: [],
  whatsappInstance: "nexora-c1",
  whatsappStatus: "CONNECTED",
};

const CONVERSA = {
  id: "conv1",
  status: "AI",
  donoAssumiuEm: null,
  customerPhone: "5511988887777",
  customerName: "Rafael Souza",
  atendenteEstado: null as unknown,
};

/** Grade das 9h às 18h30, de meia em meia hora, com o Léo, nos dias pedidos. */
function grade(dias: string[]): Livre[] {
  return dias
    .filter((d) => d !== "2026-09-22")
    .flatMap((dia) =>
      Array.from({ length: 20 }, (_, i) => {
        const inicio = emBrasilia(dia, 9, i * 30);
        return { inicio, fim: new Date(inicio.getTime() + 40 * MIN), profissional: "Léo" };
      }),
    );
}

/** A conversa como o banco devolve: da mais nova para a mais velha. */
function conversaCom(...mensagens: MensagemDaConversa[]) {
  db.message.findMany.mockResolvedValue([...mensagens].reverse());
  const ultima = mensagens.at(-1)!;
  db.message.findFirst.mockResolvedValue({ id: ultima.id, role: ultima.role });
}

const esperar = vi.fn(async () => {});
const rodar = (p: Partial<Parameters<typeof atender>[0]> = {}) =>
  atender({ companyId: "c1", conversationId: "conv1", origem: "WEBHOOK", agora: AGORA, ...p }, { esperar });

beforeEach(() => {
  vi.clearAllMocks();
  db.companyProfile.findUnique.mockResolvedValue(PERFIL);
  db.conversation.findFirst.mockResolvedValue(CONVERSA);
  db.company.findUnique.mockResolvedValue({ name: "Barbearia do Léo", phone: "(11) 97777-6666", email: "dono@exemplo.com" });
  (estadoDaEmpresa as Fn).mockResolvedValue("ATIVO");
  (usoDoAtendente as Fn).mockResolvedValue({ conversasNoMes: 10, conversasNaSemana: 0, primeiraVezEm: null });
  (atendimentoDoDia as Fn).mockResolvedValue(null);
  (fatosDaEmpresa as Fn).mockResolvedValue(FATOS);
  (horariosLivres as Fn).mockImplementation(async ({ dias }: { dias: string[] }) => grade(dias));
  (enviarWhatsApp as Fn).mockResolvedValue({ messageId: "wa1" });
  (enviarEmail as Fn).mockResolvedValue({ enviado: true });
});

describe("atender — loja fechada, pedido de horário", () => {
  it("se apresenta, oferece três horários com \"digitando…\", salva e grava o estado", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();

    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 2 });
    const envios = (enviarWhatsApp as Fn).mock.calls;
    expect(envios).toHaveLength(2);
    expect(envios[0][0]).toBe("nexora-c1");
    expect(envios[0][1]).toBe("5511988887777");
    expect(envios[0][2]).toContain("Eu sou Bia, atendente virtual da Barbearia do Léo");
    expect(envios[1][2]).toContain("1 · qua 23/09, 9h com Léo");
    for (const e of envios) {
      expect(e[3].atrasoMs).toBeGreaterThanOrEqual(1000);
      expect(e[3].atrasoMs).toBeLessThanOrEqual(3000);
    }

    expect(db.message.create).toHaveBeenCalledTimes(2);
    expect(db.message.create.mock.calls[1][0]).toEqual({
      data: { conversationId: "conv1", role: "AI", content: envios[1][2] },
    });
    const atualizacao = db.conversation.update.mock.calls[0][0];
    expect(atualizacao.where).toEqual({ id: "conv1" });
    expect(atualizacao.data.atendenteEstado.tipo).toBe("HORARIO");
    expect(registrarAtendimento).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        conversationId: "conv1",
        dia: "2026-09-22",
        foraDoHorario: true,
        respostas: 1,
        clienteNome: "Rafael",
        clienteTelefone: "5511988887777",
      }),
    );
  });

  it("rajada: se chegou mensagem mais nova durante a espera, a mais nova responde", async () => {
    conversaCom(msg("m1", "CUSTOMER", "oi", new Date(AGORA.getTime() - MIN)));
    db.message.findFirst.mockResolvedValueOnce({ id: "m2", role: "CUSTOMER" });
    const r = await rodar();
    expect(esperar).toHaveBeenCalledWith(ESPERA_DA_RAJADA_MS);
    expect(r).toEqual({ acao: "SILENCIO", motivo: "RAJADA" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("se a equipe respondeu pelo painel enquanto a resposta era preparada, nada sai", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", new Date(AGORA.getTime() - MIN)));
    db.message.findFirst
      .mockResolvedValueOnce({ id: "m1", role: "CUSTOMER" })
      .mockResolvedValueOnce({ id: "h1", role: "HUMAN" });
    const r = await rodar();
    expect(r).toEqual({ acao: "SILENCIO", motivo: "JA_RESPONDIDA" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("loja aberta pelo webhook: espera, sem carregar agenda nem mandar nada", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário?", new Date(TERCA_10H.getTime() - MIN)));
    const r = await rodar({ agora: TERCA_10H });
    expect(r).toEqual({ acao: "ESPERAR" });
    expect(esperar).not.toHaveBeenCalled();
    expect(fatosDaEmpresa).not.toHaveBeenCalled();
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});

describe("atender — a escolha vira marcação", () => {
  const opcao = (n: number, h: number, m = 0) => {
    const inicio = emBrasilia("2026-09-23", h, m);
    return { n, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 40 * MIN).toISOString(), profissional: "Léo" };
  };
  const ESTADO = {
    tipo: "HORARIO",
    servicoId: "s1",
    servicoNome: "Corte",
    duracaoMin: 40,
    opcoes: [opcao(1, 9), opcao(2, 10, 30), opcao(3, 12)],
    criadoEm: new Date(AGORA.getTime() - 5 * MIN).toISOString(),
  };

  beforeEach(() => {
    db.conversation.findFirst.mockResolvedValue({ ...CONVERSA, atendenteEstado: ESTADO });
    (atendimentoDoDia as Fn).mockResolvedValue({ respostas: 1 });
    (marcarNaAgenda as Fn).mockResolvedValue({
      ok: true,
      profissional: "Léo",
      inicio: emBrasilia("2026-09-23", 10, 30),
      fim: emBrasilia("2026-09-23", 11, 10),
      appointmentId: "ag1",
      clienteId: "cli1",
    });
    conversaCom(
      msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", new Date(AGORA.getTime() - 6 * MIN)),
      msg("a1", "AI", "Tenho estes horários…", new Date(AGORA.getTime() - 5 * MIN)),
      msg("m2", "CUSTOMER", "2", new Date(AGORA.getTime() - MIN)),
    );
  });

  it("marca com origem ATENDENTE e o nome do WhatsApp; confirma e limpa o estado", async () => {
    const r = await rodar();
    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect(marcarNaAgenda).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        origem: "ATENDENTE",
        profissional: "Léo",
        inicio: emBrasilia("2026-09-23", 10, 30),
        servico: { id: "s1", nome: "Corte", duracaoMin: 40 },
        cliente: { nome: "Rafael Souza", telefone: "5511988887777" },
      }),
    );
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toContain("quarta, 23/09, às 10h30");
    expect(db.conversation.update.mock.calls[0][0].data.atendenteEstado).toBe(Prisma.DbNull);
    expect(registrarAtendimento).toHaveBeenCalledWith(
      expect.objectContaining({ respostas: 1, marcados: 1, valorMarcadoCents: 4500 }),
    );
  });

  it("quem recebeu a Onda nos últimos 21 dias e marcou vira \"marcou\"", async () => {
    await rodar();
    expect(db.recoveryTouch.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: "c1",
        customerId: "cli1",
        outcome: "AGUARDANDO",
        sentAt: { gte: new Date(AGORA.getTime() - 21 * 86_400_000) },
      },
      data: { outcome: "MARCOU", outcomeAt: AGORA },
    });
    expect(db.lead.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: "conv1" } }));
  });
});

describe("atender — anotações para o dono", () => {
  beforeEach(() => {
    (atendimentoDoDia as Fn).mockResolvedValue({ respostas: 2 });
  });

  it("pedido de pessoa: a conversa passa para a equipe e o Atendente sai por 12 horas", async () => {
    conversaCom(msg("m1", "CUSTOMER", "quero falar com um atendente", new Date(AGORA.getTime() - MIN)));
    await rodar();
    expect(db.conversation.update.mock.calls[0][0].data).toMatchObject({ status: "WAITING_HUMAN", donoAssumiuEm: AGORA });
    expect(db.message.create).toHaveBeenCalledWith({
      data: { conversationId: "conv1", role: "SYSTEM", content: expect.stringContaining("Anotado para você") },
    });
    expect(registrarAtendimento).toHaveBeenCalledWith(
      expect.objectContaining({ precisaDoDono: true, motivo: expect.stringMatching(/falar com alguém/) }),
    );
  });

  it("urgência: orienta o cliente e avisa o dono no WhatsApp dele e por e-mail", async () => {
    conversaCom(msg("m1", "CUSTOMER", "meu filho está sangrando", new Date(AGORA.getTime() - MIN)));
    await rodar();
    const envios = (enviarWhatsApp as Fn).mock.calls;
    expect(envios[0][1]).toBe("5511988887777");
    expect(envios[0][2]).toContain("192");
    expect(envios[1][0]).toBe("nexora-c1");
    expect(envios[1][1]).toBe("5511977776666");
    expect(envios[1][2]).toContain("meu filho está sangrando");
    expect(enviarEmail).toHaveBeenCalledWith(
      "dono@exemplo.com",
      expect.objectContaining({ assunto: expect.stringMatching(/Urgência/), acao: expect.objectContaining({ href: "/painel/conversas/conv1" }) }),
    );
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ urgente: true }));
  });

  it("pergunta que ele não soube responder vira lacuna no Treinamento", async () => {
    (generateReceptionistReply as Fn).mockRejectedValue(new Error("fora do ar"));
    conversaCom(msg("m1", "CUSTOMER", "vocês fazem progressiva?", new Date(AGORA.getTime() - MIN)));
    await rodar();
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toContain("não tenho confirmada");
    expect(recordKnowledgeGap).toHaveBeenCalledWith("c1", "vocês fazem progressiva?", expect.any(String));
  });
});

describe("atender — teto do mês e limite do dia, sem passar pelo motor", () => {
  it("teto: texto fixo com a apresentação, uma vez, anotado para o dono e sem contar como conversa", async () => {
    (usoDoAtendente as Fn).mockResolvedValue({ conversasNoMes: TETO_CONVERSAS_MES, conversasNaSemana: 0, primeiraVezEm: null });
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();
    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toContain("Eu sou Bia");
    expect(horariosLivres).not.toHaveBeenCalled();
    expect(generateReceptionistReply).not.toHaveBeenCalled();
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ respostas: 0, precisaDoDono: true }));
  });

  it("limite do dia: \"deixei anotado\" uma vez, e a conta de respostas passa do limite", async () => {
    (atendimentoDoDia as Fn).mockResolvedValue({ respostas: MAX_RESPOSTAS_POR_DIA });
    conversaCom(msg("m1", "CUSTOMER", "e aí?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();
    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toContain("Deixei tudo anotado");
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ respostas: 1, precisaDoDono: true }));
  });
});

describe("a conversa do WhatsApp passa pelo Atendente, e só por ele", () => {
  const servico = leia("lib/conversation-service.ts");

  it("depois do pedido de parar, quem decide é o Atendente", () => {
    const parar = servico.indexOf("pediuParaParar(");
    const atendente = servico.indexOf("atender(");
    expect(parar).toBeGreaterThan(-1);
    expect(atendente).toBeGreaterThan(parar);
  });

  it("nenhum caminho automático antigo sobrou: IA direta, respostas rápidas, portão do Plantão", () => {
    expect(servico).not.toMatch(/generateReceptionistReply|matchQuickReply|buildSystemPrompt|portaoDoPlantao/);
  });

  it("a chave nasce desligada", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/plantaoAtivo\s+Boolean\s+@default\(false\)/);
  });

  it("o plano usa o horário único e a hora em que o dono assumiu", () => {
    const executor = leia("lib/atendente/executar.ts");
    expect(executor).toMatch(/planejar\(\{[\s\S]{0,600}horarioDaEmpresa\(/);
    expect(executor).toMatch(/planejar\(\{[\s\S]{0,300}donoAssumiuEm: conversa\.donoAssumiuEm/);
  });

  it("\"Reativar\" no painel devolve a conversa ao Atendente na hora", () => {
    const rota = leia("app/api/conversations/[id]/route.ts");
    expect(rota).toMatch(/status === "AI" \? \{ donoAssumiuEm: null \}/);
  });

  it("o executor manda pelo registro de envios, com \"digitando…\"", () => {
    const executor = leia("lib/atendente/executar.ts");
    expect(executor).toMatch(/enviarWhatsApp\([^)]*atrasoMs: atrasoDeDigitacao\(/);
    expect(executor).not.toMatch(/sendWhatsAppText/);
  });
});
