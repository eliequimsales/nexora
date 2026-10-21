import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Banco falso e módulos de fora trocados por espiões: o executor é conferido
// ponta a ponta — do plano ao envio, à agenda e às anotações — sem Postgres,
// sem WhatsApp e sem IA.
vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    companyProfile: { findUnique: vi.fn() },
    company: { findUnique: vi.fn() },
    conversation: { findFirst: vi.fn(), updateMany: vi.fn() },
    message: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    recoveryTouch: { updateMany: vi.fn() },
    lead: { upsert: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };
  return { prisma: db };
});
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
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
 * salva as decisões, envia, e deixa o rastro: estado da conversa, atendimento do
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
  descricao: "",
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

  it("pedido humano permanece pausado depois de 12 horas e só Reativar devolve", () => {
    expect(planejar(planoBase({ statusDaConversa: "WAITING_HUMAN", donoAssumiuEm: new Date(AGORA.getTime() - 24 * 60 * MIN) })))
      .toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(planejar(planoBase({ statusDaConversa: "WAITING_HUMAN", donoAssumiuEm: null })))
      .toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(planejar(planoBase({ statusDaConversa: "AI", donoAssumiuEm: null }))).toMatchObject({ acao: "RESPONDER" });
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

  it("no plano ativo, as conversas são ilimitadas mesmo com volume alto", () => {
    const usoAlto = { conversasNoMes: 50_000, conversasNaSemana: 0, primeiraVezEm: null };
    expect(planejar(planoBase({ uso: usoAlto }))).toMatchObject({ acao: "RESPONDER" });
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
    expect(texto).toMatch(/precisa da atenção da equipe/);
    expect(texto).not.toMatch(/orientou|notificou|já respondeu/);
  });
});

// ——— O CAMINHO INTEIRO, com o banco falso ———

type Fn = Mock;
const db = prisma as unknown as {
  companyProfile: { findUnique: Fn };
  company: { findUnique: Fn };
  conversation: { findFirst: Fn; updateMany: Fn };
  message: { findMany: Fn; findFirst: Fn; create: Fn };
  recoveryTouch: { updateMany: Fn };
  lead: { upsert: Fn };
  $transaction: Fn;
};

const PERFIL = {
  plantaoAtivo: true,
  atendenteLigadoPrimeiraVezEm: new Date("2026-09-20T12:00:00.000Z"),
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
  updatedAt: new Date(AGORA.getTime() - MIN),
};

let conversaAtual: Omit<typeof CONVERSA, "status" | "donoAssumiuEm"> & { status: string; donoAssumiuEm: Date | null };
function bancoComConversa(estado: unknown = null) {
  conversaAtual = { ...CONVERSA, atendenteEstado: estado };
  db.conversation.findFirst.mockImplementation(async () => ({ ...conversaAtual }));
  db.conversation.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.updatedAt && where.updatedAt.getTime() !== conversaAtual.updatedAt.getTime()) return { count: 0 };
    if (where.status && where.status !== conversaAtual.status) return { count: 0 };
    if ("donoAssumiuEm" in where && where.donoAssumiuEm?.getTime() !== conversaAtual.donoAssumiuEm?.getTime()) return { count: 0 };
    const execucao = (conversaAtual.atendenteEstado as { _execucaoAtendente?: { token: string } } | null)?._execucaoAtendente;
    if (where.atendenteEstado?.equals && where.atendenteEstado.equals !== execucao?.token) return { count: 0 };
    conversaAtual = { ...conversaAtual, ...data,
      ...(data.atendenteEstado === Prisma.DbNull ? { atendenteEstado: null } : {}),
      updatedAt: data.updatedAt ?? new Date(conversaAtual.updatedAt.getTime() + 1),
    };
    return { count: 1 };
  });
}

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
  bancoComConversa();
  db.message.create.mockResolvedValue({ id: "salva" });
  db.recoveryTouch.updateMany.mockResolvedValue({ count: 1 });
  db.lead.upsert.mockResolvedValue({ id: "lead1" });
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const anterior = { ...conversaAtual };
    try { return await cb(db); }
    catch (erro) { conversaAtual = anterior; throw erro; }
  });
  db.company.findUnique.mockResolvedValue({ name: "Barbearia do Léo", phone: "(11) 97777-6666", email: "dono@exemplo.com" });
  (estadoDaEmpresa as Fn).mockResolvedValue("ATIVO");
  (usoDoAtendente as Fn).mockResolvedValue({ conversasNoMes: 10, conversasNaSemana: 0, primeiraVezEm: null });
  (atendimentoDoDia as Fn).mockResolvedValue(null);
  (fatosDaEmpresa as Fn).mockResolvedValue(FATOS);
  (horariosLivres as Fn).mockImplementation(async ({ dias }: { dias: string[] }) => grade(dias));
  (enviarWhatsApp as Fn).mockResolvedValue({ messageId: "wa1" });
  (enviarEmail as Fn).mockResolvedValue({ enviado: true });
  (recordKnowledgeGap as Fn).mockResolvedValue(undefined);
  (registrarAtendimento as Fn).mockResolvedValue(undefined);
});

describe("atender — loja fechada, pedido de horário", () => {
  it("cadastro divergente pausa a conversa antes de consultar ou confirmar dados antigos", async () => {
    (fatosDaEmpresa as Fn).mockResolvedValue({ ...FATOS, configuracaoDivergente: true });
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", new Date(AGORA.getTime() - MIN)));
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "SYSTEM", content: expect.stringContaining("cadastro foi alterado") }) }));
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(horariosLivres).not.toHaveBeenCalled();
    expect(marcarNaAgenda).not.toHaveBeenCalled();
  });

  it("se apresenta, oferece três horários sem espera artificial, salva e grava o estado", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();

    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    const envios = (enviarWhatsApp as Fn).mock.calls;
    expect(envios).toHaveLength(1);
    expect(envios[0][0]).toBe("nexora-c1");
    expect(envios[0][1]).toBe("5511988887777");
    expect(envios[0][2]).toContain("1 · qua 23/09, 9h com Léo");
    for (const e of envios) {
      expect(e[3]).toBeUndefined();
    }

    expect(db.message.create).toHaveBeenCalledTimes(1);
    expect(db.message.create.mock.calls[0][0]).toEqual({
      data: { conversationId: "conv1", role: "AI", content: envios[0][2] },
    });
    const atualizacao = db.conversation.updateMany.mock.calls[0][0];
    expect(atualizacao.where).toMatchObject({ id: "conv1", companyId: "c1", status: "AI", donoAssumiuEm: null });
    expect(atualizacao.data.atendenteEstado._execucaoAtendente.mensagemId).toBe("m1");
    expect(conversaAtual.atendenteEstado).toMatchObject({ tipo: "HORARIO" });
    expect(db.conversation.updateMany.mock.invocationCallOrder.at(-1)).toBeGreaterThan(db.message.create.mock.invocationCallOrder.at(-1)!);
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

  it("o dono assumir após preparar a resposta impede envio e escrita do estado", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    db.conversation.findFirst.mockResolvedValueOnce(CONVERSA).mockResolvedValueOnce(CONVERSA)
      .mockResolvedValue({ ...CONVERSA, status: "HUMAN" });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(db.conversation.updateMany.mock.calls.every(([q]) => q.data.status === undefined)).toBe(true);
  });

  it("conferência imediatamente antes do envio respeita quem assumiu após persistir", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const gravar = db.conversation.updateMany.getMockImplementation()!;
    db.conversation.updateMany.mockImplementation(async (q) => {
      const r = await gravar(q);
      if (q.data.atendenteEstado?._execucaoAtendente?.proposta) conversaAtual.status = "HUMAN";
      return r;
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("nova mensagem após persistir interrompe a resposta antiga", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const gravar = db.conversation.updateMany.getMockImplementation()!;
    db.conversation.updateMany.mockImplementation(async (q) => {
      const r = await gravar(q);
      if (q.data.atendenteEstado?._execucaoAtendente?.proposta) db.message.findFirst.mockResolvedValue({ id: "m2", role: "CUSTOMER" });
      return r;
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "RAJADA" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("atualização condicional impede sobrescrever quem assumiu entre leitura e gravação", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    db.conversation.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EM_PROCESSAMENTO" });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("webhook e resgate sobre a mesma versão só publicam uma resposta", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const resultados = await Promise.all([rodar(), rodar({ origem: "RESGATE" })]);

    expect(resultados.filter((r) => r.acao === "RESPONDEU")).toHaveLength(1);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(conversaAtual.updatedAt.getTime()).toBeGreaterThan(CONVERSA.updatedAt.getTime());
  });

  it("execução iniciada depois da persistência reconhece a mensagem já em processamento", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    let chegouNoEnvio!: () => void;
    let terminarEnvio!: () => void;
    const entrou = new Promise<void>((resolve) => { chegouNoEnvio = resolve; });
    const bloqueio = new Promise<void>((resolve) => { terminarEnvio = resolve; });
    (enviarWhatsApp as Fn).mockImplementationOnce(async () => {
      chegouNoEnvio();
      await bloqueio;
      return { messageId: "wa1" };
    });
    const primeira = rodar();
    await entrou;
    // A oferta preparada ainda não foi entregue; só o claim está ativo.
    expect(conversaAtual.atendenteEstado).not.toHaveProperty("tipo");
    expect(conversaAtual.atendenteEstado).toHaveProperty("_execucaoAtendente.proposta.estado.tipo", "HORARIO");
    expect(await rodar({ origem: "RESGATE" })).toEqual({ acao: "SILENCIO", motivo: "EM_PROCESSAMENTO" });
    terminarEnvio();
    expect(await primeira).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(conversaAtual.atendenteEstado).toHaveProperty("tipo", "HORARIO");
    expect(conversaAtual.atendenteEstado).not.toHaveProperty("_execucaoAtendente");
  });

  it("claim vencido vira revisão visível sem repetir reserva ou envio", async () => {
    bancoComConversa({ _execucaoAtendente: {
      token: "anterior", mensagemId: "m1", iniciadaEm: new Date(AGORA.getTime() - 6 * MIN).toISOString(),
      proposta: { estado: null, mensagens: ["Reserva confirmada"], reserva: {
        appointmentId: "ag-interrompida", servico: "Corte", inicio: "2026-09-23T13:30:00.000Z",
      } },
    } });
    conversaCom(msg("m1", "CUSTOMER", "2", AGORA));
    expect(await rodar({ origem: "RESGATE" })).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(conversaAtual.atendenteEstado).toBeNull();
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringMatching(/cinco minutos[\s\S]*registro ag-interrompida/),
    }) }));
    expect(marcarNaAgenda).not.toHaveBeenCalled();
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
  });

  it("claim vencido antes de preparar resultado também exige revisão manual", async () => {
    bancoComConversa({ _execucaoAtendente: {
      token: "anterior", mensagemId: "m1", iniciadaEm: new Date(AGORA.getTime() - 6 * MIN).toISOString(),
    } });
    conversaCom(msg("m1", "CUSTOMER", "2", AGORA));
    await rodar();
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      content: expect.stringContaining("Verifique a agenda e o histórico antes de reativar"),
    }) }));
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(marcarNaAgenda).not.toHaveBeenCalled();
  });

  it("claim vencido depois de salvar AI também é revisado sem publicar novamente a oferta", async () => {
    const anterior = { tipo: "CONVITE", criadoEm: new Date(AGORA.getTime() - 7 * MIN).toISOString() };
    bancoComConversa({ ...anterior, _execucaoAtendente: {
      token: "anterior", mensagemId: "m1", iniciadaEm: new Date(AGORA.getTime() - 6 * MIN).toISOString(),
      proposta: { estado: { tipo: "HORARIO" }, mensagens: ["Tenho estes horários"] },
    } });
    conversaCom(msg("m1", "CUSTOMER", "tem horário?", new Date(AGORA.getTime() - 7 * MIN)),
      msg("a1", "AI", "Tenho estes horários", new Date(AGORA.getTime() - 6 * MIN)));
    expect(await rodar({ origem: "RESGATE" })).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(conversaAtual.atendenteEstado).toEqual(anterior);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringContaining("não foi repetido automaticamente"),
    }) }));
  });

  it("perder a confirmação da aquisição não inicia efeitos externos", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const gravar = db.conversation.updateMany.getMockImplementation()!;
    db.conversation.updateMany.mockImplementationOnce(async (q) => {
      await gravar(q);
      throw new Error("commit confirmado só no banco");
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EM_PROCESSAMENTO" });
    expect(conversaAtual.atendenteEstado).toHaveProperty("_execucaoAtendente.mensagemId", "m1");
    expect(horariosLivres).not.toHaveBeenCalled();
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EM_PROCESSAMENTO" });
  });

  it("uma execução antiga não libera nem sobrescreve o claim de outra mensagem", async () => {
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const gravar = db.conversation.updateMany.getMockImplementation()!;
    const outra = { _execucaoAtendente: { token: "outra", mensagemId: "m2", iniciadaEm: AGORA.toISOString() } };
    db.conversation.updateMany.mockImplementation(async (q) => {
      const r = await gravar(q);
      if (q.data.atendenteEstado?._execucaoAtendente?.proposta) conversaAtual.atendenteEstado = outra;
      return r;
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EM_PROCESSAMENTO" });
    expect(conversaAtual.atendenteEstado).toEqual(outra);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("mensagem nova interrompe oferta ainda não enviada e preserva apenas estado anterior", async () => {
    const anterior = { tipo: "CONVITE", criadoEm: AGORA.toISOString() };
    bancoComConversa(anterior);
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã pra corte?", AGORA));
    const gravar = db.conversation.updateMany.getMockImplementation()!;
    db.conversation.updateMany.mockImplementation(async (q) => {
      const r = await gravar(q);
      if (q.data.atendenteEstado?._execucaoAtendente?.proposta) db.message.findFirst.mockResolvedValue({ id: "m2", role: "CUSTOMER" });
      return r;
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "RAJADA" });
    expect(conversaAtual.atendenteEstado).toEqual(anterior);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  // A chave ligada por fora do fluxo (sem teste e sem o começo da semana
  // registrado) responderia de graça para sempre: a semana nunca começaria.
  it("chave ligada sem passar pelo \"Ligar\": silêncio", async () => {
    db.companyProfile.findUnique.mockResolvedValue({ ...PERFIL, atendenteLigadoPrimeiraVezEm: null });
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã?", new Date(AGORA.getTime() - MIN)));
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "DESLIGADO" });
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
    bancoComConversa(ESTADO);
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
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/quarta, 23\/09, às 10h30/i);
    expect(conversaAtual.atendenteEstado).toBeNull();
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

  it("reserva usa identidade estável da mensagem para recuperação e retry", async () => {
    await rodar();
    expect(marcarNaAgenda).toHaveBeenCalledWith(expect.objectContaining({ chaveOperacao: "c1:conv1:m2" }));
  });

  it("reserva reutilizada pode ser confirmada sem contar novamente o valor e a marcação", async () => {
    (marcarNaAgenda as Fn).mockResolvedValueOnce({
      ok: true, profissional: "Léo", inicio: emBrasilia("2026-09-23", 10, 30),
      fim: emBrasilia("2026-09-23", 11, 10), appointmentId: "ag1", clienteId: "cli1", reutilizada: true,
    });
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/quarta, 23\/09, às 10h30/i);
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ respostas: 1, marcados: 0, valorMarcadoCents: 0 }));
  });

  it("reserva confirmada com falha de envio conserva resultado em revisão e não repete a operação", async () => {
    (enviarWhatsApp as Fn).mockRejectedValueOnce(new Error("conexão interrompida"));
    await expect(rodar()).rejects.toThrow("conexão interrompida");
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(conversaAtual.atendenteEstado).toBeNull();
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringMatching(/não reenviar automaticamente[\s\S]*registro ag1[\s\S]*quarta, 23\/09/i),
    }) }));
    expect(await rodar({ origem: "RESGATE" })).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("envio aceito sem mensagem AI salva também pausa sem reenviar a confirmação", async () => {
    db.message.create.mockRejectedValueOnce(new Error("histórico indisponível"));
    await expect(rodar()).rejects.toThrow("histórico indisponível");
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringContaining("registro ag1"),
    }) }));
    await rodar({ origem: "RESGATE" });
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("canal sem identificador do envio não confirma entrega nem publica oferta para novo turno", async () => {
    (enviarWhatsApp as Fn).mockResolvedValueOnce({ messageId: null });
    await expect(rodar()).rejects.toThrow("resultado desconhecido");
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(conversaAtual.atendenteEstado).toBeNull();
    expect(db.message.create.mock.calls.some(([q]) => q.data.role === "AI")).toBe(false);
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringMatching(/não reenviar automaticamente[\s\S]*registro ag1/),
    }) }));
    expect(await rodar({ origem: "RESGATE" })).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("mensagem nova durante reserva guarda o appointmentId e exige revisão antes de continuar", async () => {
    (marcarNaAgenda as Fn).mockImplementationOnce(async () => {
      db.message.findFirst.mockResolvedValue({ id: "m3", role: "CUSTOMER" });
      return { ok: true, profissional: "Léo", inicio: emBrasilia("2026-09-23", 10, 30),
        fim: emBrasilia("2026-09-23", 11, 10), appointmentId: "ag1", clienteId: "cli1" };
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "RAJADA" });
    expect(conversaAtual.status).toBe("WAITING_HUMAN");
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringContaining("registro ag1"),
    }) }));
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("se o dono assume durante a reserva, conserva o registro e não envia por cima dele", async () => {
    (marcarNaAgenda as Fn).mockImplementationOnce(async () => {
      conversaAtual.status = "HUMAN";
      return { ok: true, profissional: "Léo", inicio: emBrasilia("2026-09-23", 10, 30),
        fim: emBrasilia("2026-09-23", 11, 10), appointmentId: "ag1", clienteId: "cli1" };
    });
    expect(await rodar()).toEqual({ acao: "SILENCIO", motivo: "EQUIPE_NA_CONVERSA" });
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(db.conversation.updateMany.mock.calls.every(([q]) => q.data.status === undefined)).toBe(true);
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: "SYSTEM", content: expect.stringContaining("registro ag1"),
    }) }));
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ respostas: 0, marcados: 1, precisaDoDono: true }));
  });

  it("falha no acompanhamento da conversa não transforma reserva confirmada em falha", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("falha ao salvar conversa"));
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/quarta, 23\/09, às 10h30/i);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/não consegui|não foi registrada/i);
  });

  it("reserva com resultado desconhecido mantém oferta e encaminha verificação sem tentar de novo", async () => {
    (marcarNaAgenda as Fn).mockResolvedValueOnce({ ok: false, motivo: "RESULTADO_DESCONHECIDO" });
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/não consegui confirmar o resultado/i);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/horário não está mais disponível|está na agenda/i);
    expect(db.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "WAITING_HUMAN", atendenteEstado: expect.objectContaining({ tipo: "HORARIO" }) }),
    }));
    expect(registrarAtendimento).toHaveBeenCalledWith(expect.objectContaining({ marcados: 0, precisaDoDono: true }));
  });

  it("resultado da reserva permanece desconhecido mesmo se registrar revisão falhar", async () => {
    (marcarNaAgenda as Fn).mockResolvedValueOnce({ ok: false, motivo: "RESULTADO_DESCONHECIDO" });
    db.$transaction.mockRejectedValueOnce(new Error("timeout ao registrar revisão"));
    await rodar();
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/resultado dessa reserva/i);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/não consegui confirmar o encaminhamento/i);
    expect(marcarNaAgenda).toHaveBeenCalledTimes(1);
  });
});

describe("atender — anotações para o dono", () => {
  beforeEach(() => {
    (atendimentoDoDia as Fn).mockResolvedValue({ respostas: 2 });
  });

  it("pedido de pessoa: persiste encaminhamento e pausa até devolução explícita", async () => {
    conversaCom(msg("m1", "CUSTOMER", "quero falar com um atendente", new Date(AGORA.getTime() - MIN)));
    await rodar();
    expect(conversaAtual).toMatchObject({ status: "WAITING_HUMAN", donoAssumiuEm: AGORA });
    expect(db.message.create).toHaveBeenCalledWith({
      data: { conversationId: "conv1", role: "SYSTEM", content: expect.stringContaining("Anotado para você") },
    });
    expect(registrarAtendimento).toHaveBeenCalledWith(
      expect.objectContaining({ precisaDoDono: true, motivo: expect.stringMatching(/falar com alguém/) }),
    );
    expect(db.message.create.mock.invocationCallOrder[0]).toBeLessThan((enviarWhatsApp as Fn).mock.invocationCallOrder[0]);
    expect(db.conversation.updateMany.mock.invocationCallOrder[0]).toBeLessThan((enviarWhatsApp as Fn).mock.invocationCallOrder[0]);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/já avisei|notifiqu|equipe foi avisada/i);
  });

  it("a resposta que confirma pausa pode sair após o próprio encaminhamento persistido", async () => {
    conversaCom(msg("m1", "CUSTOMER", "quero falar com uma pessoa", AGORA));
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/pausar/i);
  });

  it("falha ao salvar anotação não afirma registro nem notifica como se tivesse funcionado", async () => {
    conversaCom(msg("m1", "CUSTOMER", "quero falar com uma pessoa", AGORA));
    db.message.create.mockRejectedValueOnce(new Error("falha de persistência"));
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/não consegui confirmar o encaminhamento/i);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/já avisei|deixei anotado|vou pausar/i);
    expect(db.company.findUnique).not.toHaveBeenCalled();
    expect(recordKnowledgeGap).not.toHaveBeenCalled();
  });

  it("falha de notificação não desfaz a resposta nem vira uma afirmação de aviso enviado", async () => {
    (generateReceptionistReply as Fn).mockRejectedValue(new Error("fora do ar"));
    conversaCom(msg("m1", "CUSTOMER", "vocês fazem progressiva?", AGORA));
    (enviarWhatsApp as Fn).mockResolvedValueOnce({ messageId: "cliente" }).mockRejectedValueOnce(new Error("aviso falhou"));
    (enviarEmail as Fn).mockRejectedValueOnce(new Error("email falhou"));
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/já avisei|notifiqu|já encaminhei/i);
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "SYSTEM" }) }));
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

  it("falha de persistência não suprime a orientação de emergência", async () => {
    conversaCom(msg("m1", "CUSTOMER", "meu filho está sangrando", AGORA));
    db.$transaction.mockRejectedValueOnce(new Error("registro indisponível"));
    expect(await rodar()).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toContain("192");
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/não consegui confirmar o encaminhamento/i);
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).not.toMatch(/já avisei|deixei anotado/i);
  });

  it("pergunta que ele não soube responder vira lacuna no Treinamento e consulta o dono", async () => {
    (generateReceptionistReply as Fn).mockRejectedValue(new Error("fora do ar"));
    conversaCom(msg("m1", "CUSTOMER", "vocês fazem progressiva?", new Date(AGORA.getTime() - MIN)));
    await rodar();
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/não tenho essa informação confirmada/i);
    expect(recordKnowledgeGap).toHaveBeenCalledWith("c1", expect.stringMatching(/^vocês fazem progressiva\??$/), expect.any(String));
    expect((enviarWhatsApp as Fn).mock.calls[1][1]).toBe("5511977776666");
    expect((enviarWhatsApp as Fn).mock.calls[1][2]).toContain("Você poderia me ensinar como responder");
  });
});

describe("atender — limite do dia e conversas contínuas", () => {
  it("no plano ativo, responde normalmente mesmo com volume alto no mês", async () => {
    (usoDoAtendente as Fn).mockResolvedValue({ conversasNoMes: 50_000, conversasNaSemana: 0, primeiraVezEm: null });
    conversaCom(msg("m1", "CUSTOMER", "tem horário amanhã?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();
    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect(enviarWhatsApp).toHaveBeenCalled();
  });

  it("limite do dia: encaminha e informa que a equipe precisa continuar", async () => {
    (atendimentoDoDia as Fn).mockResolvedValue({ respostas: MAX_RESPOSTAS_POR_DIA });
    conversaCom(msg("m1", "CUSTOMER", "e aí?", new Date(AGORA.getTime() - MIN)));
    const r = await rodar();
    expect(r).toEqual({ acao: "RESPONDEU", mensagens: 1 });
    expect((enviarWhatsApp as Fn).mock.calls[0][2]).toMatch(/equipe/i);
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

  it("o executor usa o registro de envios sem simular digitação humana", () => {
    const executor = leia("lib/atendente/executar.ts");
    expect(executor).not.toMatch(/atrasoDeDigitacao|atrasoMs/);
    expect(executor).not.toMatch(/sendWhatsAppText/);
  });
});
