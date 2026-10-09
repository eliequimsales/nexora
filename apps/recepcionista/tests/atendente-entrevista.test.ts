import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extrairHeuristica,
  formatarBusinessHours,
  processarEntrevistaDono,
  obterMensagemInicialEntrevista,
} from "@/lib/atendente/entrevista";

vi.mock("@/lib/auth", () => ({ getSessionCompanyId: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    service: { findMany: vi.fn(), create: vi.fn() },
    companyProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    knowledgeItem: { create: vi.fn() },
  },
}));
vi.mock("@/lib/agenda/painel", () => ({
  listarServicos: vi.fn(async () => []),
  criarServico: vi.fn(async (_cid, dados) => ({ id: "srv_1", ...dados })),
}));
vi.mock("@/lib/atendente/fatos", () => ({
  fatosDaEmpresa: vi.fn(async () => ({
    empresa: "Barbearia Modelo",
    nome: "Sofia",
    servicos: [{ id: "srv_1", nome: "Corte", precoCents: 4500, duracaoMin: 30 }],
    horarios: [{ day: 1, open: "09:00", close: "18:00", closed: false }],
    endereco: "Rua Augusta, 500",
    pagamento: "Pix e cartão",
  })),
}));

describe("Entrevista da Onda do Mar — Extração Heurística", () => {
  it("extrai serviço único com preço em reais", () => {
    const res = extrairHeuristica("Faço corte de cabelo por 45 reais");
    expect(res.servicos).toBeDefined();
    expect(res.servicos?.length).toBe(1);
    expect(res.servicos?.[0].name).toContain("Corte");
    expect(res.servicos?.[0].priceCents).toBe(4500);
  });

  it("extrai múltiplos serviços em uma frase só", () => {
    const res = extrairHeuristica("Corte por 45 e barba por 35 reais");
    expect(res.servicos).toBeDefined();
    expect(res.servicos?.length).toBe(2);
    expect(res.servicos?.[0].priceCents).toBe(4500);
    expect(res.servicos?.[1].priceCents).toBe(3500);
  });

  it("extrai dias e horários de funcionamento", () => {
    const res = extrairHeuristica("Atendo de seg a sex das 9h às 18h");
    expect(res.horarios).toBeDefined();
    expect(res.horarios?.abre).toBe("09:00");
    expect(res.horarios?.fecha).toBe("18:00");
    expect(res.horarios?.diasSemana).toEqual([1, 2, 3, 4, 5]);
  });

  it("extrai horário incluindo sábado", () => {
    const res = extrairHeuristica("Segunda a sábado das 08:00 às 19:00");
    expect(res.horarios).toBeDefined();
    expect(res.horarios?.abre).toBe("08:00");
    expect(res.horarios?.fecha).toBe("19:00");
    expect(res.horarios?.diasSemana).toContain(6);
  });

  it("extrai endereço físico", () => {
    const res = extrairHeuristica("Fica na Av. Paulista, 1000 - Bela Vista");
    expect(res.endereco).toBeDefined();
    expect(res.endereco).toContain("Av. Paulista");
  });

  it("extrai modalidade 100% online", () => {
    const res = extrairHeuristica("Meu atendimento é 100% online por videochamada");
    expect(res.endereco).toBe("Atendimento online / sem endereço fixo");
  });

  it("extrai formas de pagamento", () => {
    const res = extrairHeuristica("Aceitamos pix, cartão e dinheiro");
    expect(res.pagamento).toContain("Pix");
    expect(res.pagamento).toContain("cartão");
    expect(res.pagamento).toContain("dinheiro");
  });

  it("extrai perguntas e respostas ensinadas pelo dono", () => {
    const res = extrairHeuristica("Quando perguntarem sobre estacionamento, responda que temos convênio com o shopping ao lado");
    expect(res.perguntaResposta).toBeDefined();
    expect(res.perguntaResposta?.pergunta).toContain("estacionamento");
    expect(res.perguntaResposta?.resposta).toContain("convênio");
  });

  it("extrai regras diretas como desconto em horário específico", () => {
    const res = extrairHeuristica("7 e meia tem desconto");
    expect(res.regras).toContain("7 e meia tem desconto");
    expect(res.perguntaResposta).toBeDefined();
    expect(res.perguntaResposta?.pergunta).toContain("7 e meia tem desconto");
  });

  it("não salva dúvidas do dono como regra ('oq eu posso te ensinar?') e responde com orientação amigável", () => {
    const res = extrairHeuristica("oq eu posso te ensinar?");
    expect(res.regras).toBeUndefined();
    expect(res.perguntaResposta).toBeUndefined();
    expect(res.servicos).toBeUndefined();
    expect(res.endereco).toBeUndefined();
    expect(res.horarios).toBeUndefined();
    expect(res.respostaParaDono).toBeDefined();
    expect(res.respostaParaDono?.toLowerCase()).toMatch(/posso aprender|ensinar|serviço|preço/);
  });

  it("não salva perguntas genéricas como regra ('como funciona?')", () => {
    const res = extrairHeuristica("como funciona?");
    expect(res.regras).toBeUndefined();
    expect(res.perguntaResposta).toBeUndefined();
    expect(res.respostaParaDono).toBeDefined();
  });
});

describe("Formatação de Horários", () => {
  it("converte HorarioExtraido em lista de 7 dias com dias inativos fechados", () => {
    const bh = formatarBusinessHours({
      diasSemana: [1, 2, 3, 4, 5],
      abre: "09:00",
      fecha: "18:00",
    });
    expect(bh).toHaveLength(7);
    expect(bh.find((d) => d.day === 0)?.closed).toBe(true); // Domingo fechado
    expect(bh.find((d) => d.day === 1)?.closed).toBe(false); // Segunda aberto
    expect(bh.find((d) => d.day === 1)?.open).toBe("09:00");
    expect(bh.find((d) => d.day === 6)?.closed).toBe(true); // Sábado fechado
  });
});

describe("Processamento da Entrevista", () => {
  it("processa e salva novos serviços com resposta acolhedora", async () => {
    const res = await processarEntrevistaDono({
      companyId: "comp_123",
      mensagem: "Faço corte por 50 e barba por 30",
    });

    expect(res.salvou.servicos).toBe(2);
    expect(res.resposta).toBeDefined();
    expect(res.resposta.length).toBeGreaterThan(10);
  });

  it("processa regra como '7 e meia tem desconto' e confirma que aprendeu", async () => {
    const res = await processarEntrevistaDono({
      companyId: "comp_123",
      mensagem: "7 e meia tem desconto",
    });

    expect(res.salvou.regras).toBe(true);
    expect(res.salvou.pergunta).toBe(true);
    expect(res.resposta).toContain("7 e meia tem desconto");
  });

  it("quando o dono pergunta 'oq eu posso te ensinar?', responde como IA sem salvar regras no banco", async () => {
    const res = await processarEntrevistaDono({
      companyId: "comp_123",
      mensagem: "oq eu posso te ensinar?",
    });

    expect(res.salvou.regras).toBe(false);
    expect(res.salvou.pergunta).toBe(false);
    expect(res.salvou.servicos).toBe(0);
    expect(res.salvou.endereco).toBe(false);
    expect(res.salvou.horarios).toBe(false);
    expect(res.salvou.pagamento).toBe(false);
    expect(res.resposta).toBeDefined();
    expect(res.resposta.toLowerCase()).toMatch(/posso aprender|ensinar|serviço|preço/);
  });

  it("gera mensagem inicial com base nos dados faltantes da empresa", async () => {
    const ini = await obterMensagemInicialEntrevista("comp_123");
    expect(ini.mensagem).toBeDefined();
    expect(ini.sugestoes.length).toBeGreaterThan(0);
  });
});

describe("Rotas /api/atendente/entrevista", () => {
  it("GET retorna 401 quando não autenticado", async () => {
    const { getSessionCompanyId } = await import("@/lib/auth");
    vi.mocked(getSessionCompanyId).mockResolvedValueOnce(null as any);

    const { GET } = await import("@/app/api/atendente/entrevista/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET retorna mensagem inicial e sugestões quando autenticado", async () => {
    const { getSessionCompanyId } = await import("@/lib/auth");
    vi.mocked(getSessionCompanyId).mockResolvedValueOnce("comp_123");

    const { GET } = await import("@/app/api/atendente/entrevista/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mensagem).toBeDefined();
    expect(body.sugestoes).toBeDefined();
  });

  it("POST processa mensagem e retorna resposta estruturada", async () => {
    const { getSessionCompanyId } = await import("@/lib/auth");
    vi.mocked(getSessionCompanyId).mockResolvedValueOnce("comp_123");

    const { POST } = await import("@/app/api/atendente/entrevista/route");
    const req = new Request("http://localhost/api/atendente/entrevista", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "Corte R$ 45 e Barba R$ 35" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resposta).toBeDefined();
    expect(body.salvou).toBeDefined();
  });
});

