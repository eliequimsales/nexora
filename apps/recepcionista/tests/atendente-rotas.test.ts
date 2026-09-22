import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    companyProfile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    atendenteAtendimento: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/limites", async (original) => ({
  ...(await original<typeof import("@/lib/limites")>()),
  limitar: vi.fn(() => true),
}));
vi.mock("@/lib/errors", () => ({ logError: vi.fn() }));
vi.mock("@/lib/billing/guarda", () => ({ exigirAcesso: vi.fn(async () => null) }));
vi.mock("@/lib/atendente/tela", () => ({ telaDoAtendente: vi.fn(async () => ({ tela: "atualizada" })) }));
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
  configuracaoDaIaFaltando: vi.fn(() => null),
}));
vi.mock("@/lib/whatsapp/envio", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp/envio")>()),
  enviarWhatsApp: vi.fn(),
}));

import { NextResponse } from "next/server";
import { GET, PUT } from "@/app/api/atendente/route";
import { POST as LIGAR } from "@/app/api/atendente/ligar/route";
import { POST as SIMULAR } from "@/app/api/atendente/simular/route";
import type { Livre } from "@/lib/agenda/livres";
import { horariosLivres } from "@/lib/agenda/livres";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";
import { configuracaoDaIaFaltando, generateReceptionistReply } from "@/lib/ai/provider";
import type { Fatos } from "@/lib/atendente/fatos";
import { fatosDaEmpresa } from "@/lib/atendente/fatos";
import { telaDoAtendente } from "@/lib/atendente/tela";
import { getSessionCompanyId } from "@/lib/auth";
import { exigirAcesso } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { limitar } from "@/lib/limites";
import { enviarWhatsApp } from "@/lib/whatsapp/envio";

/**
 * AS ROTAS DA TELA "ATENDENTE VIRTUAL".
 *
 * Sessão obrigatória, entrada validada, limite de uso. O simulador roda o motor
 * de verdade com os dados do dono, mas não envia nada e não marca nada: a
 * marcação só confere se o horário continua livre. Ligar exige o teste feito,
 * o WhatsApp ligado e o acesso da conta.
 */

type Fn = Mock;
const db = prisma as unknown as {
  companyProfile: { findUnique: Fn; update: Fn; updateMany: Fn };
  atendenteAtendimento: { updateMany: Fn };
};

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

const pedido = (corpo: unknown, metodo = "POST") =>
  new Request("http://localhost/api/atendente", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};

const FATOS: Fatos = {
  empresa: "Barbearia do Léo",
  nome: "Bia",
  jeito: "ACOLHEDOR",
  marcaDireto: true,
  expediente: true,
  servicos: [{ id: "s1", nome: "Corte", precoCents: 4500, duracaoMin: 40 }],
  profissionais: ["Léo"],
  // Fechado a semana inteira: o simulador responde como loja fechada, a qualquer hora.
  horarios: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "19:00", closed: true })),
  diasFechados: [],
  endereco: "Rua das Flores, 100",
  pagamento: "Pix e cartão",
  perguntas: [],
  linkAgenda: null,
};

/** Grade de horários livres nos dias pedidos, das 9h às 18h30, com o Léo. */
function grade(dias: string[]): Livre[] {
  return dias.flatMap((dia) =>
    Array.from({ length: 20 }, (_, i) => {
      const inicio = emBrasilia(dia, 9, i * 30);
      return { inicio, fim: new Date(inicio.getTime() + 40 * 60_000), profissional: "Léo" };
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (getSessionCompanyId as Fn).mockResolvedValue("c1");
  (limitar as Fn).mockReturnValue(true);
  (exigirAcesso as Fn).mockResolvedValue(null);
  (fatosDaEmpresa as Fn).mockResolvedValue(FATOS);
  (horariosLivres as Fn).mockImplementation(async ({ dias }: { dias: string[] }) => grade(dias));
  (configuracaoDaIaFaltando as Fn).mockReturnValue(null);
  db.companyProfile.findUnique.mockResolvedValue({
    diasFechados: [],
    handoffKeywords: [],
    atendenteTestadoEm: new Date(),
    whatsappStatus: "CONNECTED",
    whatsappInstance: "nexora-c1",
  });
  db.companyProfile.updateMany.mockResolvedValue({ count: 1 });
});

describe("sessão e limite de uso", () => {
  it("sem sessão, nenhuma rota responde", async () => {
    (getSessionCompanyId as Fn).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(pedido({ nome: "Bia" }, "PUT"))).status).toBe(401);
    expect((await LIGAR(pedido({ ligar: true }))).status).toBe(401);
    expect((await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "oi" }] }))).status).toBe(401);
  });

  it("estourado o limite, 429", async () => {
    (limitar as Fn).mockReturnValue(false);
    expect((await GET()).status).toBe(429);
    expect((await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "oi" }] }))).status).toBe(429);
  });
});

describe("GET e PUT /api/atendente", () => {
  it("o GET devolve a tela montada no servidor", async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ tela: "atualizada" });
    expect(telaDoAtendente).toHaveBeenCalledWith("c1");
  });

  it("o PUT grava nome, jeito e escolhas nos campos do Atendente, e devolve a tela nova", async () => {
    const r = await PUT(
      pedido(
        {
          nome: "  Bia   Souza ",
          jeito: "DIRETO",
          marcaDireto: false,
          expediente: false,
          endereco: " Rua A, 1 ",
          pagamento: "Pix",
        },
        "PUT",
      ),
    );
    expect(r.status).toBe(200);
    expect(db.companyProfile.update).toHaveBeenCalledWith({
      where: { companyId: "c1" },
      data: {
        atendenteNome: "Bia Souza",
        atendenteJeito: "DIRETO",
        atendenteMarca: false,
        atendenteExpediente: false,
        address: "Rua A, 1",
        paymentMethods: "Pix",
      },
    });
    expect(await r.json()).toEqual({ tela: "atualizada" });
  });

  it("entrada fora do formato é recusada", async () => {
    for (const corpo of [{ jeito: "GRITANDO" }, { nome: "B1a" }, { nome: "x".repeat(40) }, { outraCoisa: 1 }]) {
      expect((await PUT(pedido(corpo, "PUT"))).status, JSON.stringify(corpo)).toBe(400);
    }
    expect(db.companyProfile.update).not.toHaveBeenCalled();
  });

  it("\"Fechar hoje\" entra na lista de dias fechados, e \"Reabrir\" tira", async () => {
    await PUT(pedido({ fecharHoje: true }, "PUT"));
    const fechou = db.companyProfile.update.mock.calls[0][0].data.diasFechados as string[];
    expect(fechou).toHaveLength(1);
    expect(fechou[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    db.companyProfile.findUnique.mockResolvedValue({ diasFechados: fechou });
    await PUT(pedido({ fecharHoje: false }, "PUT"));
    expect(db.companyProfile.update.mock.calls[1][0].data.diasFechados).toEqual([]);
  });

  it("resolver uma anotação só vale para a própria empresa", async () => {
    await PUT(pedido({ resolver: "ckz1a2b3c4d5e6f7g8h9i0j1" }, "PUT"));
    expect(db.atendenteAtendimento.updateMany).toHaveBeenCalledWith({
      where: { id: "ckz1a2b3c4d5e6f7g8h9i0j1", companyId: "c1" },
      data: { resolvidoEm: expect.any(Date) },
    });
  });
});

describe("POST /api/atendente/ligar", () => {
  it("sem o teste no simulador, não liga", async () => {
    db.companyProfile.findUnique.mockResolvedValue({ atendenteTestadoEm: null, whatsappStatus: "CONNECTED", whatsappInstance: "x" });
    const r = await LIGAR(pedido({ ligar: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).faltando).toBe("TESTE");
    expect(db.companyProfile.update).not.toHaveBeenCalled();
  });

  it("sem o WhatsApp ligado, não liga — e diz o que falta", async () => {
    db.companyProfile.findUnique.mockResolvedValue({ atendenteTestadoEm: new Date(), whatsappStatus: "DISCONNECTED", whatsappInstance: null });
    const r = await LIGAR(pedido({ ligar: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).faltando).toBe("WHATSAPP");
  });

  it("sem acesso, a recusa da cobrança sai como veio: com o botão", async () => {
    (exigirAcesso as Fn).mockResolvedValue(
      NextResponse.json({ error: "semana acabou", acao: { texto: "Continuar", href: "/painel/assinatura" } }, { status: 402 }),
    );
    const r = await LIGAR(pedido({ ligar: true }));
    expect(r.status).toBe(402);
    expect(exigirAcesso).toHaveBeenCalledWith("c1", "LIGAR_ATENDENTE");
    expect(db.companyProfile.update).not.toHaveBeenCalled();
  });

  it("liga, e a primeira vez fica gravada uma vez só", async () => {
    const r = await LIGAR(pedido({ ligar: true }));
    expect(r.status).toBe(200);
    expect(db.companyProfile.update).toHaveBeenCalledWith({ where: { companyId: "c1" }, data: { plantaoAtivo: true } });
    expect(db.companyProfile.updateMany).toHaveBeenCalledWith({
      where: { companyId: "c1", atendenteLigadoPrimeiraVezEm: null },
      data: { atendenteLigadoPrimeiraVezEm: expect.any(Date) },
    });
  });

  it("desligar é sempre possível, sem conferir nada", async () => {
    const r = await LIGAR(pedido({ ligar: false }));
    expect(r.status).toBe(200);
    expect(db.companyProfile.update).toHaveBeenCalledWith({ where: { companyId: "c1" }, data: { plantaoAtivo: false } });
    expect(exigirAcesso).not.toHaveBeenCalled();
  });
});

describe("POST /api/atendente/simular — o motor de verdade, sem enviar e sem marcar", () => {
  it("responde com os horários livres de verdade, e o teste fica registrado", async () => {
    const r = await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "tem horário amanhã pra corte?" }] }));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.mensagens.join("\n")).toContain("Eu sou Bia, atendente virtual da Barbearia do Léo");
    expect(corpo.mensagens.join("\n")).toMatch(/1 · \S{3} \d{2}\/\d{2}, 9h com Léo/);
    expect(corpo.estado.tipo).toBe("HORARIO");
    expect(corpo.fontes.length).toBeGreaterThan(0);
    expect(corpo.contexto).toBe("FECHADO");
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(db.companyProfile.update).toHaveBeenCalledWith({
      where: { companyId: "c1" },
      data: { atendenteTestadoEm: expect.any(Date) },
    });
  });

  it("o \"2\" confere o horário na agenda sem marcar nada", async () => {
    const primeira = await (
      await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "tem horário amanhã pra corte?" }] }))
    ).json();
    (marcarNaAgenda as Fn).mockResolvedValue({
      ok: true,
      profissional: "Léo",
      inicio: new Date(primeira.estado.opcoes[1].inicio),
      fim: new Date(primeira.estado.opcoes[1].fim),
      appointmentId: null,
      clienteId: null,
    });
    const r = await SIMULAR(
      pedido({
        mensagens: [
          { de: "cliente", texto: "tem horário amanhã pra corte?" },
          ...primeira.mensagens.map((texto: string) => ({ de: "atendente", texto })),
          { de: "cliente", texto: "2" },
        ],
        estado: primeira.estado,
      }),
    );
    const corpo = await r.json();
    expect(marcarNaAgenda).toHaveBeenCalledWith(expect.objectContaining({ simulacao: true, origem: "ATENDENTE", companyId: "c1" }));
    expect(corpo.marcou).toMatchObject({ servico: "Corte", profissional: "Léo" });
    expect(corpo.mensagens[0]).toContain("Já está na agenda");
  });

  it("testa o nome e o jeito antes de salvar", async () => {
    await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "oi" }], nome: "Duda", jeito: "DESCONTRAIDO", marcaDireto: false }));
    expect(fatosDaEmpresa).toHaveBeenCalledWith("c1", { nome: "Duda", jeito: "DESCONTRAIDO", marcaDireto: false });
  });

  it("sem a configuração das respostas livres, avisa sem jargão e sem nome de variável", async () => {
    (configuracaoDaIaFaltando as Fn).mockReturnValue("GROQ_API_KEY");
    const r = await SIMULAR(pedido({ mensagens: [{ de: "cliente", texto: "vocês fazem progressiva?" }] }));
    const texto = await r.text();
    expect(JSON.parse(texto).respostasLivres).toBe(false);
    expect(texto).not.toContain("GROQ_API_KEY");
    expect(generateReceptionistReply).not.toHaveBeenCalled();
  });

  it("entrada fora do formato é recusada", async () => {
    for (const corpo of [
      { mensagens: [] },
      { mensagens: [{ de: "cliente", texto: "x".repeat(501) }] },
      { mensagens: [{ de: "robo", texto: "oi" }] },
      { mensagens: [{ de: "atendente", texto: "oi" }] },
    ]) {
      expect((await SIMULAR(pedido(corpo))).status, JSON.stringify(corpo).slice(0, 60)).toBe(400);
    }
  });

  it("o simulador nunca chama o envio do WhatsApp", () => {
    expect(leia("app/api/atendente/simular/route.ts")).not.toMatch(/enviarWhatsApp|sendWhatsAppText/);
  });
});
