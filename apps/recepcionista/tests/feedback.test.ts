import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  EMAIL_FEEDBACK,
  CATEGORIAS_LABEL,
  ratingParaTexto,
  montarHtmlFeedback,
  montarTextoPuroFeedback,
  enviarFeedback,
} from "@/lib/feedback/servico";
import type { FeedbackDados } from "@/lib/feedback/tipos";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/feedback/route";

vi.mock("@/lib/db", () => ({
  prisma: {
    errorLog: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    company: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionCompanyId: vi.fn().mockResolvedValue(null),
}));

describe("Canal de Feedback da Nexora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_REMETENTE;
  });

  it("o e-mail de destino oficial dos fundadores é nexora.iabusiness@gmail.com", () => {
    expect(EMAIL_FEEDBACK).toBe("nexora.iabusiness@gmail.com");
  });

  it("converte rating numérico de 1 a 5 para texto legível com estrelas", () => {
    expect(ratingParaTexto(5)).toContain("5/5 - Excelente");
    expect(ratingParaTexto(4)).toContain("4/5 - Muito bom");
    expect(ratingParaTexto(3)).toContain("3/5 - Regular");
    expect(ratingParaTexto(2)).toContain("2/5 - Abaixo do esperado");
    expect(ratingParaTexto(1)).toContain("1/5 - Precisa melhorar muito");
  });

  it("monta o HTML do feedback com sanitização e escape de caracteres maliciosos", () => {
    const dados: FeedbackDados = {
      rating: 5,
      categoria: "sugestao",
      mensagem: "Adorei a plataforma! <script>alert('xss')</script> & mais coisas.",
      email: "cliente@exemplo.com",
      whatsapp: "(11) 98888-7777",
      companyName: "Barbearia do João",
      companyId: "cia-123",
      pagina: "/painel/onda",
    };

    const html = montarHtmlFeedback(dados, "24/09/2026 19:50");

    expect(html).toContain("Barbearia do João");
    expect(html).toContain("cliente@exemplo.com");
    expect(html).toContain("(11) 98888-7777");
    expect(html).toContain("/painel/onda");
    expect(html).toContain(CATEGORIAS_LABEL.sugestao);
    expect(html).toContain("&lt;script&gt;alert('xss')&lt;/script&gt;");
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(html).toContain("mailto:cliente@exemplo.com");
  });

  it("monta a versão em texto puro para caixas de entrada legadas", () => {
    const dados: FeedbackDados = {
      rating: 4,
      categoria: "elogio",
      mensagem: "O recuperador trouxe 3 clientes no primeiro dia.",
      email: "dono@clinica.com",
    };

    const texto = montarTextoPuroFeedback(dados, "24/09/2026 19:50");

    expect(texto).toContain("[NOVO FEEDBACK - NEXORA]");
    expect(texto).toContain("dono@clinica.com");
    expect(texto).toContain("O recuperador trouxe 3 clientes no primeiro dia.");
    expect(texto).toContain("4/5 - Muito bom");
  });

  it("sem Resend no ambiente, persiste o feedback no banco de forma resiliente", async () => {
    const dados: FeedbackDados = {
      rating: 5,
      categoria: "sugestao",
      mensagem: "Gostaria de ver novos relatórios.",
      email: "teste@empresa.com",
      companyId: "emp-1",
    };

    const resultado = await enviarFeedback(dados);

    expect(resultado.enviado).toBe(true);
    expect(resultado.motivo).toBe("salvo-no-banco-sem-resend");
    expect(prisma.errorLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context: "feedback-cliente",
          companyId: "emp-1",
        }),
      }),
    );
  });

  it("com Resend configurado, dispara e-mail com destino nexora.iabusiness@gmail.com e reply_to para o cliente", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.EMAIL_REMETENTE = "suporte@meunexora.com.br";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const dados: FeedbackDados = {
      rating: 5,
      categoria: "duvida",
      mensagem: "Como configuro múltiplos profissionais na agenda?",
      email: "contato@salao.com",
      companyName: "Salão Beleza Pura",
    };

    const resultado = await enviarFeedback(dados);

    expect(resultado.enviado).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.any(Object));

    const chamada = fetchMock.mock.calls[0];
    const corpo = JSON.parse(chamada[1].body);

    expect(corpo.to).toEqual(["nexora.iabusiness@gmail.com"]);
    expect(corpo.reply_to).toBe("contato@salao.com");
    expect(corpo.subject).toContain("Dúvida");
    expect(corpo.subject).toContain("Salão Beleza Pura");

    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_REMETENTE;
  });
});

describe("Rota POST /api/feedback", () => {
  it("rejeita mensagem com menos de 3 caracteres", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "oi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.erro).toContain("pelo menos 3 caracteres");
  });

  it("rejeita mensagem excessivamente longa", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "a".repeat(4001) }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.erro).toContain("muito longa");
  });

  it("aceita feedback válido e retorna 200", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 5,
        categoria: "sugestao",
        mensagem: "Parabéns pelo sistema!",
        email: "usuario@teste.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.mensagem).toBe("Feedback recebido com sucesso!");
  });
});
