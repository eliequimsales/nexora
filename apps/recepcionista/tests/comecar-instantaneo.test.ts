import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as Record<string, unknown>).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    company: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: db };
});

vi.mock("@/lib/auth", () => ({
  createSessionToken: vi.fn().mockResolvedValue("mock_jwt_token"),
  hashPassword: vi.fn().mockImplementation((p: string) => Promise.resolve(`hash_${p}`)),
  setSessionCookie: vi.fn(),
  getSessionCompanyId: vi.fn(),
  SESSION_COOKIE: "rd_session",
}));

vi.mock("@/lib/errors", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimit: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/google", () => ({
  appRedirect: vi.fn().mockImplementation((path: string) => new URL(path, "https://www.meunexora.com.br")),
}));

vi.mock("@/lib/auth/verificacao", () => ({
  abrirVerificacao: vi.fn().mockResolvedValue("token_verificacao"),
  VALIDADE_HORAS: 24,
}));

vi.mock("@/lib/reengajamento/email", () => ({
  enviarEmail: vi.fn().mockResolvedValue(true),
}));

import { prisma } from "@/lib/db";
import { getSessionCompanyId, createSessionToken, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import ComecarPage from "@/app/comecar/page";
import { GET as comecarRouteGET } from "@/app/api/auth/comecar/route";
import { POST as salvarContaPOST } from "@/app/api/auth/salvar-conta/route";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  company: {
    create: Fn;
    findUnique: Fn;
    update: Fn;
  };
};

describe("Página /comecar", () => {
  it("redireciona para o Route Handler /api/auth/comecar", () => {
    expect(() => ComecarPage()).toThrow("NEXT_REDIRECT:/api/auth/comecar");
    expect(redirect).toHaveBeenCalledWith("/api/auth/comecar");
  });
});

describe("Entrada Instantânea (/api/auth/comecar) — Sem atrito e com isolamento estrito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionCompanyId as Fn).mockResolvedValue(null);
    (rateLimit as Fn).mockReturnValue(true);
    db.company.create.mockResolvedValue({
      id: "comp_convidado_123",
      sessaoEpoca: 0,
      email: "convidado_abcdef1234567890@temporario.meunexora.com.br",
    });
  });

  it("visitante sem sessão ativa recebe nova empresa isolada e cookie de sessão", async () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/comecar");
    const res = await comecarRouteGET(req);

    expect(db.company.create).toHaveBeenCalledTimes(1);
    const dadosCriacao = db.company.create.mock.calls[0][0].data;

    // Garante que o e-mail é temporário e único
    expect(dadosCriacao.email).toMatch(/^convidado_[a-f0-9]+@temporario\.meunexora\.com\.br$/);
    // Garante que a senha gerada tem alta entropia e foi hasheada
    expect(dadosCriacao.passwordHash).toMatch(/^hash_/);
    // Garante perfil vazio criado para o tenant
    expect(dadosCriacao.profile).toEqual({ create: {} });
    // Garante gravação auditável dos termos
    expect(dadosCriacao.ipAceite).toBe("127.0.0.1");
    expect(dadosCriacao.termosAceitosEm).toBeInstanceOf(Date);

    // Garante geração de token JWT assinado
    expect(createSessionToken).toHaveBeenCalledWith("comp_convidado_123", 0);
    expect(setSessionCookie).toHaveBeenCalledWith("mock_jwt_token");

    // Redireciona para o painel com indicação de origem
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://www.meunexora.com.br/painel/atendente?origem=instantaneo");
  });

  it("visitante com sessão ativa NÃO recria empresa e vai direto ao painel", async () => {
    (getSessionCompanyId as Fn).mockResolvedValue("empresa_ja_logada_999");

    const req = new Request("https://www.meunexora.com.br/api/auth/comecar");
    const res = await comecarRouteGET(req);

    // Nenhuma empresa criada no banco
    expect(db.company.create).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://www.meunexora.com.br/painel/atendente");
  });

  it("aplica rate limit contra flood de criação de contas anônimas", async () => {
    (rateLimit as Fn).mockReturnValue(false);

    const req = new Request("https://www.meunexora.com.br/api/auth/comecar");
    const res = await comecarRouteGET(req);

    expect(db.company.create).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://www.meunexora.com.br/cadastro?erro=limite");
  });
});

describe("Salvar Conta (/api/auth/salvar-conta) — Tornar a conta definitiva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionCompanyId as Fn).mockResolvedValue("comp_convidado_123");
    (rateLimit as Fn).mockReturnValue(true);
    db.company.findUnique.mockResolvedValue(null);
    db.company.update.mockResolvedValue({ id: "comp_convidado_123" });
  });

  it("exige sessão autenticada para salvar conta", async () => {
    (getSessionCompanyId as Fn).mockResolvedValue(null);

    const req = new Request("https://www.meunexora.com.br/api/auth/salvar-conta", {
      method: "POST",
      body: JSON.stringify({ email: "dona@clinica.com", password: "senha-segura-123" }),
    });
    const res = await salvarContaPOST(req);

    expect(res.status).toBe(401);
    expect(db.company.update).not.toHaveBeenCalled();
  });

  it("rejeita e-mail já em uso por outro usuário", async () => {
    db.company.findUnique.mockResolvedValue({ id: "outra_empresa_456" });

    const req = new Request("https://www.meunexora.com.br/api/auth/salvar-conta", {
      method: "POST",
      body: JSON.stringify({ email: "existente@clinica.com", password: "senha-segura-123" }),
    });
    const res = await salvarContaPOST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("Já existe uma conta");
    expect(db.company.update).not.toHaveBeenCalled();
  });

  it("rejeita senhas com menos de 8 caracteres", async () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/salvar-conta", {
      method: "POST",
      body: JSON.stringify({ email: "dona@clinica.com", password: "123" }),
    });
    const res = await salvarContaPOST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("8 caracteres");
    expect(db.company.update).not.toHaveBeenCalled();
  });

  it("atualiza dados da conta no banco com hash seguro e preserva o tenant", async () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/salvar-conta", {
      method: "POST",
      body: JSON.stringify({
        email: "dona@clinica.com",
        password: "senha-segura-123",
        name: "Clínica Harmonização Prime",
      }),
    });
    const res = await salvarContaPOST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.email).toBe("dona@clinica.com");

    expect(db.company.update).toHaveBeenCalledWith({
      where: { id: "comp_convidado_123" },
      data: {
        email: "dona@clinica.com",
        passwordHash: "hash_senha-segura-123",
        name: "Clínica Harmonização Prime",
      },
    });
  });
});
