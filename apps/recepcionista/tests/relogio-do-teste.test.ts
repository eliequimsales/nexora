import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DIAS } from "@/lib/billing/acesso";
import {
  AVISO_DO_RELOGIO_DIAS,
  fimDoTesteSemRelogio,
  fimDoTrialNoCheckout,
  prometeuTesteGratis,
  relogioDoCadastro,
  relogioParaGravar,
  TERMOS_SEM_TESTE_A_PARTIR_DE,
} from "@/lib/billing/relogio";

/**
 * O RELÓGIO DO TESTE GRÁTIS.
 *
 * Até 14/09/2026 o prazo só existia para quem abria o checkout: `trialEndsAt`
 * era gravado apenas pela convergência da Stripe, e conta sem assinatura e sem
 * prazo ficava em TRIAL para sempre — gerando a onda sem nunca pagar.
 *
 * E quem abria o checkout depois de usar o mês ganhava OUTRO mês: a sessão
 * pedia `trial_period_days: 30` contados do clique, não do cadastro.
 *
 * A partir da Entrega 2 o teste grátis deixa de existir para contas novas. O
 * que decide se a conta tem direito a ele é o que ela ACEITOU: a versão dos
 * Termos gravada no cadastro. Promessa feita é cumprida; promessa que não foi
 * feita não vira presente.
 */

const DIA = 86_400_000;
const HORA = 3_600_000;
const AGORA = new Date("2026-09-15T12:00:00.000Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * DIA);
const emDias = (n: number) => new Date(AGORA.getTime() + n * DIA);
const emHoras = (n: number) => new Date(AGORA.getTime() + n * HORA);
const segundos = (d: Date) => Math.floor(d.getTime() / 1000);

describe("prometeuTesteGratis — o que a conta aceitou", () => {
  it("conta sem versão registrada é anterior ao registro do aceite: aceitou o mês grátis", () => {
    expect(prometeuTesteGratis(null)).toBe(true);
  });

  it("Termos anteriores à mudança prometiam o mês grátis", () => {
    expect(prometeuTesteGratis("2026-09-10")).toBe(true);
  });

  it("a partir da versão sem teste, não há mês grátis prometido", () => {
    expect(prometeuTesteGratis(TERMOS_SEM_TESTE_A_PARTIR_DE)).toBe(false);
    expect(prometeuTesteGratis("2027-01-01")).toBe(false);
  });
});

describe("fimDoTesteSemRelogio", () => {
  it(`conta criada agora ganha os ${TRIAL_DIAS} dias inteiros`, () => {
    expect(fimDoTesteSemRelogio(AGORA, AGORA)).toEqual(emDias(TRIAL_DIAS));
  });

  it("conta criada no passado ganha o aviso de 7 dias antes de travar", () => {
    expect(fimDoTesteSemRelogio(diasAtras(10), AGORA)).toEqual(emDias(AVISO_DO_RELOGIO_DIAS));
  });

  // Quem se cadastrou há dois meses nunca foi avisado de prazo nenhum. Travar
  // na hora seria trocar a regra no meio do jogo sem dizer nada.
  it("conta antiga, que nunca teve prazo, ganha o aviso antes de travar", () => {
    expect(fimDoTesteSemRelogio(diasAtras(60), AGORA)).toEqual(emDias(AVISO_DO_RELOGIO_DIAS));
  });

  it("conta perto do fim dos 7 dias nunca recebe menos que o aviso", () => {
    expect(fimDoTesteSemRelogio(diasAtras(TRIAL_DIAS - 2), AGORA)).toEqual(
      emDias(AVISO_DO_RELOGIO_DIAS),
    );
  });
});

describe("relogioDoCadastro", () => {
  it("com Termos que prometem o mês grátis, o prazo nasce com a conta", () => {
    expect(relogioDoCadastro("2026-09-10", AGORA)).toEqual(emDias(TRIAL_DIAS));
  });

  it("com Termos sem teste grátis (versão 2026-09-15), a conta nasce sem prazo", () => {
    expect(relogioDoCadastro(TERMOS_SEM_TESTE_A_PARTIR_DE, AGORA)).toBeNull();
  });

  it("com Termos com teste de 7 dias (versão 2026-09-18), a conta ganha os 7 dias", () => {
    expect(relogioDoCadastro("2026-09-18", AGORA)).toEqual(emDias(TRIAL_DIAS));
  });
});

describe("relogioParaGravar", () => {
  it("conta antiga sem assinatura e sem prazo recebe o relógio", () => {
    expect(
      relogioParaGravar(
        { subscriptionStatus: null, trialEndsAt: null, createdAt: diasAtras(60), termosVersao: null },
        AGORA,
      ),
    ).toEqual(emDias(AVISO_DO_RELOGIO_DIAS));
  });

  it("conta que já tem prazo não é tocada", () => {
    expect(
      relogioParaGravar(
        { subscriptionStatus: null, trialEndsAt: emDias(3), createdAt: diasAtras(27), termosVersao: null },
        AGORA,
      ),
    ).toBeNull();
  });

  // Quem tem assinatura na Stripe é governado por ela (converger.ts é o
  // escritor único). Relógio local ali seria um segundo escritor no mesmo campo.
  it("conta com assinatura na Stripe não ganha relógio local", () => {
    expect(
      relogioParaGravar(
        { subscriptionStatus: "active", trialEndsAt: null, createdAt: diasAtras(90), termosVersao: null },
        AGORA,
      ),
    ).toBeNull();
  });

  it("conta que aceitou Termos sem teste grátis não ganha relógio: fica em GRATIS", () => {
    expect(
      relogioParaGravar(
        {
          subscriptionStatus: null,
          trialEndsAt: null,
          createdAt: diasAtras(1),
          termosVersao: TERMOS_SEM_TESTE_A_PARTIR_DE,
        },
        AGORA,
      ),
    ).toBeNull();
  });
});

describe("fimDoTrialNoCheckout — o checkout não dá um segundo mês grátis", () => {
  it("sem relógio, o checkout não oferece teste", () => {
    expect(fimDoTrialNoCheckout(null, AGORA)).toBeNull();
  });

  it("teste já vencido: cobra ao assinar, sem novo período grátis", () => {
    expect(fimDoTrialNoCheckout(diasAtras(1), AGORA)).toBeNull();
  });

  it("teste em andamento: o trial da Stripe termina no mesmo dia do relógio", () => {
    expect(fimDoTrialNoCheckout(emDias(12), AGORA)).toBe(segundos(emDias(12)));
  });

  // A Stripe exige trial_end pelo menos 48 horas no futuro. Faltando menos que
  // isso, o fim vai para o mínimo aceito com uma hora de folga: o dono ganha no
  // máximo essas horas, e nunca perde as que ainda tinha.
  it("faltando menos de 48 horas, o fim vai para o mínimo que a Stripe aceita", () => {
    expect(fimDoTrialNoCheckout(emHoras(20), AGORA)).toBe(segundos(emHoras(49)));
  });
});

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("o relógio nasce e é garantido nos lugares certos", () => {
  it("o cadastro por senha decide o prazo pela versão dos Termos aceita", () => {
    expect(leia("app/api/auth/signup/route.ts")).toMatch(/trialEndsAt:\s*relogioDoCadastro\(/);
  });

  it("o cadastro pelo Google decide o prazo pela versão dos Termos aceita", () => {
    expect(leia("app/api/auth/google/callback/route.ts")).toMatch(
      /trialEndsAt:\s*relogioDoCadastro\(/,
    );
  });

  // Conta antiga não passa pelo cadastro de novo. Quem decide o estado precisa
  // garantir o relógio antes: senão a trava diz "teste terminou" para quem ainda
  // tem os dias de aviso.
  it("quem calcula o estado garante o relógio antes de decidir", () => {
    const guarda = leia("lib/billing/guarda.ts");
    expect(guarda).toContain("garantirRelogio(");
    expect(guarda).toMatch(/createdAt:\s*true/);
    expect(guarda).toMatch(/termosVersao:\s*true/);
    expect(leia("app/painel/assinatura/page.tsx")).toContain("garantirRelogio(");
    expect(leia("lib/reengajamento/servico.ts")).toContain("garantirRelogio(");
  });

  it("o checkout alinha o trial da Stripe ao relógio da conta", () => {
    const rota = leia("app/api/billing/checkout/route.ts");
    expect(rota).not.toContain("trial_period_days");
    expect(rota).toContain("fimDoTrialNoCheckout(");
  });
});
