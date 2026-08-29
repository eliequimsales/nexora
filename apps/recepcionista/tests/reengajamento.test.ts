import { describe, expect, it } from "vitest";
import {
  decidirToque,
  INTERVALO_MINIMO_DIAS,
  MOMENTOS,
  type Momento,
  type Sinais,
} from "@/lib/reengajamento/motor";

const HOJE = new Date("2026-09-01T09:00:00.000Z");
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000);
const emDias = (n: number) => new Date(HOJE.getTime() + n * 86_400_000);

function sinais(over: Partial<Sinais> = {}): Sinais {
  return {
    nome: "Barbearia do Zé",
    criadoEm: diasAtras(1),
    checkoutAbertoEm: null,
    canceladoEm: null,
    clientesNaBase: 0,
    toquesRegistrados: 0,
    sumidos: 0,
    recuperavelCents: 0,
    recuperadoCents: 0,
    trialEndsAt: null,
    subscriptionStatus: null,
    dunningIniciadoEm: null,
    semEmail: false,
    jaEnviados: [],
    ultimoEnvioEm: null,
    ...over,
  };
}

describe("decidirToque — quem não terminou a compra", () => {
  it("abriu o checkout e não voltou vira COMPRA_NAO_FINALIZADA no dia seguinte", () => {
    const t = decidirToque(
      sinais({ checkoutAbertoEm: diasAtras(1), clientesNaBase: 40 }),
      HOJE,
    );
    expect(t?.momento).toBe("COMPRA_NAO_FINALIZADA");
  });

  it("abriu o checkout há 20 minutos não recebe nada — ele ainda pode estar pagando", () => {
    const t = decidirToque(
      sinais({ checkoutAbertoEm: new Date(HOJE.getTime() - 20 * 60_000), clientesNaBase: 40 }),
      HOJE,
    );
    expect(t?.momento).not.toBe("COMPRA_NAO_FINALIZADA");
  });

  it("quem completou a compra nunca recebe o de carrinho abandonado", () => {
    const t = decidirToque(
      sinais({
        checkoutAbertoEm: diasAtras(3),
        subscriptionStatus: "active",
        clientesNaBase: 40,
      }),
      HOJE,
    );
    expect(t?.momento).not.toBe("COMPRA_NAO_FINALIZADA");
  });
});

describe("decidirToque — quem cancelou", () => {
  it("cancelou ontem recebe o pedido de motivo", () => {
    const t = decidirToque(
      sinais({ subscriptionStatus: "canceled", canceladoEm: diasAtras(1), clientesNaBase: 80 }),
      HOJE,
    );
    expect(t?.momento).toBe("CANCELOU");
  });

  it("catorze dias depois recebe a segunda, e só depois da primeira", () => {
    const base = {
      subscriptionStatus: "canceled",
      canceladoEm: diasAtras(14),
      clientesNaBase: 80,
      ultimoEnvioEm: diasAtras(13),
    };
    expect(decidirToque(sinais({ ...base, jaEnviados: ["CANCELOU"] }), HOJE)?.momento).toBe(
      "CANCELOU_14D",
    );
    // Sem a primeira, a segunda não pula na frente.
    expect(decidirToque(sinais(base), HOJE)?.momento).toBe("CANCELOU");
  });
});

describe("decidirToque — fim do teste grátis", () => {
  it("três dias antes do fim, avisa", () => {
    const t = decidirToque(
      sinais({ subscriptionStatus: "trialing", trialEndsAt: emDias(2), clientesNaBase: 60 }),
      HOJE,
    );
    expect(t?.momento).toBe("TRIAL_ACABANDO");
  });

  it("acabou e não pagou entra na sequência de três", () => {
    const base = {
      subscriptionStatus: "paused",
      trialEndsAt: diasAtras(11),
      clientesNaBase: 60,
      ultimoEnvioEm: diasAtras(9),
    };
    expect(decidirToque(sinais({ ...base, jaEnviados: [] }), HOJE)?.momento).toBe("TRIAL_ACABOU");
    expect(
      decidirToque(sinais({ ...base, jaEnviados: ["TRIAL_ACABOU"] }), HOJE)?.momento,
    ).toBe("TRIAL_ACABOU_3D");
    expect(
      decidirToque(
        sinais({ ...base, jaEnviados: ["TRIAL_ACABOU", "TRIAL_ACABOU_3D"] }),
        HOJE,
      )?.momento,
    ).toBe("TRIAL_ACABOU_10D");
  });

  it("esgotada a sequência, para de mandar", () => {
    const t = decidirToque(
      sinais({
        subscriptionStatus: "paused",
        trialEndsAt: diasAtras(40),
        clientesNaBase: 60,
        ultimoEnvioEm: diasAtras(20),
        jaEnviados: ["TRIAL_ACABOU", "TRIAL_ACABOU_3D", "TRIAL_ACABOU_10D"],
      }),
      HOJE,
    );
    expect(t).toBeNull();
  });
});

describe("decidirToque — ativação", () => {
  it("cadastrou e não importou ninguém recebe o empurrão da base", () => {
    const t = decidirToque(sinais({ criadoEm: diasAtras(2), clientesNaBase: 0 }), HOJE);
    expect(t?.momento).toBe("SEM_BASE");
  });

  it("no primeiro dia ainda não incomoda", () => {
    const t = decidirToque(
      sinais({ criadoEm: new Date(HOJE.getTime() - 3 * 3_600_000), clientesNaBase: 0 }),
      HOJE,
    );
    expect(t).toBeNull();
  });

  it("importou a base mas nunca usou recebe o empurrão de uso", () => {
    const t = decidirToque(
      sinais({ criadoEm: diasAtras(5), clientesNaBase: 120, toquesRegistrados: 0 }),
      HOJE,
    );
    expect(t?.momento).toBe("SEM_USO");
  });
});

describe("decidirToque — regras que valem para todos", () => {
  it("nunca repete um momento já enviado", () => {
    const t = decidirToque(
      sinais({ criadoEm: diasAtras(9), clientesNaBase: 0, jaEnviados: ["SEM_BASE"] }),
      HOJE,
    );
    expect(t?.momento).not.toBe("SEM_BASE");
  });

  it(`respeita o intervalo mínimo de ${INTERVALO_MINIMO_DIAS} dias entre envios`, () => {
    const t = decidirToque(
      sinais({ criadoEm: diasAtras(9), clientesNaBase: 0, ultimoEnvioEm: HOJE }),
      HOJE,
    );
    expect(t).toBeNull();
  });

  // Quem pediu para sair, saiu. Vale para o dono da conta igual vale para o
  // cliente final dele — é a mesma regra do CDC, e seria incoerente cobrar
  // isso do dono e não cumprir com ele.
  it("quem pediu para não receber e-mail não recebe NADA, em nenhum momento", () => {
    for (const momento of MOMENTOS) {
      const t = decidirToque(
        sinais({
          semEmail: true,
          criadoEm: diasAtras(30),
          clientesNaBase: 0,
          canceladoEm: diasAtras(1),
          subscriptionStatus: "canceled",
          checkoutAbertoEm: diasAtras(2),
          jaEnviados: MOMENTOS.filter((m) => m !== momento),
        }),
        HOJE,
      );
      expect(t, `vazou em ${momento}`).toBeNull();
    }
  });

  it("todo toque tem assunto, corpo e um link de ação", () => {
    const casos: Partial<Sinais>[] = [
      { checkoutAbertoEm: diasAtras(2), clientesNaBase: 40 },
      { subscriptionStatus: "canceled", canceladoEm: diasAtras(1), clientesNaBase: 80 },
      { subscriptionStatus: "trialing", trialEndsAt: emDias(2), clientesNaBase: 60 },
      { subscriptionStatus: "paused", trialEndsAt: diasAtras(1), clientesNaBase: 60 },
      { criadoEm: diasAtras(3), clientesNaBase: 0 },
      { criadoEm: diasAtras(5), clientesNaBase: 120 },
      { recuperadoCents: 45_000, clientesNaBase: 90, toquesRegistrados: 12 },
    ];
    for (const caso of casos) {
      const t = decidirToque(sinais(caso), HOJE);
      expect(t, JSON.stringify(caso)).not.toBeNull();
      expect(t!.assunto.length).toBeGreaterThan(0);
      expect(t!.corpo.length).toBeGreaterThan(40);
      expect(t!.acao.href.startsWith("/")).toBe(true);
      expect(t!.acao.texto.length).toBeGreaterThan(0);
    }
  });

  // O diferencial da Nexora é falar do dinheiro DELE, não do produto. Um e-mail
  // que diz "volte para a Nexora" é igual a todos os outros; um que diz
  // "você tem R$ 4.200 parados" é sobre ele.
  it("quando existe número da base dele, o corpo do e-mail carrega o número", () => {
    const t = decidirToque(
      sinais({
        subscriptionStatus: "paused",
        trialEndsAt: diasAtras(1),
        clientesNaBase: 300,
        sumidos: 118,
        recuperavelCents: 420_000,
      }),
      HOJE,
    );
    expect(t?.corpo).toContain("118");
    expect(t?.corpo).toMatch(/4\.200|4200/);
  });

  it("sem número confiável, não inventa valor nenhum", () => {
    const t = decidirToque(
      sinais({
        subscriptionStatus: "paused",
        trialEndsAt: diasAtras(1),
        clientesNaBase: 0,
        sumidos: 0,
        recuperavelCents: 0,
      }),
      HOJE,
    );
    expect(t?.corpo).not.toMatch(/R\$\s*0/);
  });
});

describe("decidirToque — pedido de depoimento", () => {
  it("quem já recuperou dinheiro é convidado a contar, e só depois de recuperar", () => {
    const comResultado = decidirToque(
      sinais({ recuperadoCents: 45_000, clientesNaBase: 90, toquesRegistrados: 12 }),
      HOJE,
    );
    expect(comResultado?.momento).toBe("PEDIR_DEPOIMENTO");

    const semResultado = decidirToque(
      sinais({ recuperadoCents: 0, clientesNaBase: 90, toquesRegistrados: 12 }),
      HOJE,
    );
    expect(semResultado?.momento).not.toBe("PEDIR_DEPOIMENTO");
  });
});
