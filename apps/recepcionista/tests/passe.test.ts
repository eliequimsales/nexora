import { describe, expect, it } from "vitest";
import {
  ACOES,
  estadoDaConta,
  podeExecutar,
  type Assinatura,
} from "@/lib/billing/acesso";
import { diasDoPasse, fimDoAcessoAtual, periodoDoPasse } from "@/lib/billing/passe";

/**
 * O PASSE PAGO — Pix de 30 dias ou anual à vista.
 *
 * Não é assinatura: é acesso pago até uma data, sem cobrança automática. O
 * estado dele é PASSE, separado de ATIVO, porque a tela não pode dizer "próxima
 * cobrança em…" para quem não vai ser cobrado de novo.
 */

const DIA = 86_400_000;
const AGORA = new Date("2026-09-15T12:00:00.000Z");
const emDias = (n: number) => new Date(AGORA.getTime() + n * DIA);

function conta(over: Partial<Assinatura> = {}): Assinatura {
  return {
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    dunningIniciadoEm: null,
    acessoPagoAte: null,
    ...over,
  };
}

describe("periodoDoPasse", () => {
  it("sem acesso em andamento, começa agora", () => {
    expect(periodoDoPasse({ acessoAte: null, agora: AGORA, dias: 30 })).toEqual({
      inicio: AGORA,
      fim: emDias(30),
    });
  });

  // Quem paga o mês seguinte antes de o atual acabar não pode perder os dias
  // que ainda tinha: o novo período começa no fim do atual.
  it("pagou antes de o acesso acabar: soma ao fim do acesso atual", () => {
    expect(periodoDoPasse({ acessoAte: emDias(5), agora: AGORA, dias: 30 })).toEqual({
      inicio: emDias(5),
      fim: emDias(35),
    });
  });

  it("acesso vencido: o novo começa agora, sem devolver dias que já passaram", () => {
    expect(periodoDoPasse({ acessoAte: emDias(-10), agora: AGORA, dias: 30 })).toEqual({
      inicio: AGORA,
      fim: emDias(30),
    });
  });

  it("o anual vale 365 dias", () => {
    expect(periodoDoPasse({ acessoAte: null, agora: AGORA, dias: 365 }).fim).toEqual(emDias(365));
  });
});

/**
 * DE ONDE O PASSE COMEÇA A CONTAR.
 *
 * Pagar cedo não pode custar dias. Quem ainda está no mês grátis que os Termos
 * prometeram, quem cancelou com dias pagos pela frente e quem estende um passe
 * que ainda vale — os três começam o período novo quando o acesso atual acaba.
 */
describe("fimDoAcessoAtual", () => {
  it("sem acesso nenhum, o passe começa agora", () => {
    expect(fimDoAcessoAtual(conta(), AGORA)).toBeNull();
  });

  it("no teste grátis, começa quando o teste acaba", () => {
    expect(fimDoAcessoAtual(conta({ trialEndsAt: emDias(12) }), AGORA)).toEqual(emDias(12));
    expect(
      fimDoAcessoAtual(conta({ subscriptionStatus: "trialing", trialEndsAt: emDias(12) }), AGORA),
    ).toEqual(emDias(12));
  });

  it("com passe valendo, começa no fim do passe", () => {
    expect(fimDoAcessoAtual(conta({ acessoPagoAte: emDias(5) }), AGORA)).toEqual(emDias(5));
  });

  it("cancelada com dias pagos, começa no fim desses dias", () => {
    expect(
      fimDoAcessoAtual(conta({ subscriptionStatus: "canceled", currentPeriodEnd: emDias(9) }), AGORA),
    ).toEqual(emDias(9));
  });

  it("teste vencido ou período pago já encerrado: começa agora", () => {
    expect(fimDoAcessoAtual(conta({ trialEndsAt: emDias(-1) }), AGORA)).toBeNull();
    expect(
      fimDoAcessoAtual(conta({ subscriptionStatus: "canceled", currentPeriodEnd: emDias(-1) }), AGORA),
    ).toBeNull();
  });
});

/**
 * Tudo que volta da Stripe no metadata é texto. O prazo sai do que a rota do
 * checkout gravou — e texto torto não pode virar prazo, nem de mais nem de menos.
 */
describe("diasDoPasse", () => {
  it("lê os dias que a rota do checkout gravou", () => {
    expect(diasDoPasse({ passeDias: "30" })).toBe(30);
    expect(diasDoPasse({ passeDias: "365" })).toBe(365);
  });

  it("sem metadata ou sem o campo, não inventa prazo", () => {
    expect(diasDoPasse(null)).toBeNull();
    expect(diasDoPasse(undefined)).toBeNull();
    expect(diasDoPasse({})).toBeNull();
  });

  it("texto torto não vira prazo", () => {
    for (const bruto of ["0", "-5", "30.5", "9999", " 30", "abc", ""]) {
      expect(diasDoPasse({ passeDias: bruto }), JSON.stringify(bruto)).toBeNull();
    }
  });
});

describe("estadoDaConta com passe pago", () => {
  it("passe válido é PASSE", () => {
    expect(estadoDaConta(conta({ acessoPagoAte: emDias(10) }), AGORA)).toBe("PASSE");
  });

  it("passe vencido não é PASSE: volta para o estado de quem não pagou", () => {
    expect(estadoDaConta(conta({ acessoPagoAte: emDias(-1) }), AGORA)).toBe("GRATIS");
  });

  // Pagou o Pix: tem acesso, mesmo com uma assinatura antiga cancelada ou com o
  // cartão recusado. Travar quem acabou de pagar seria cobrar e não entregar.
  it("quem pagou o passe tem acesso mesmo com assinatura cancelada ou atrasada", () => {
    expect(
      estadoDaConta(
        conta({ acessoPagoAte: emDias(10), subscriptionStatus: "canceled", currentPeriodEnd: emDias(-5) }),
        AGORA,
      ),
    ).toBe("PASSE");
    expect(
      estadoDaConta(
        conta({
          acessoPagoAte: emDias(10),
          subscriptionStatus: "past_due",
          dunningIniciadoEm: emDias(-30),
        }),
        AGORA,
      ),
    ).toBe("PASSE");
  });

  it("assinatura ativa continua sendo ATIVO", () => {
    expect(
      estadoDaConta(conta({ acessoPagoAte: emDias(10), subscriptionStatus: "active" }), AGORA),
    ).toBe("ATIVO");
  });

  it("PASSE libera todas as ações", () => {
    for (const acao of ACOES) {
      expect(podeExecutar("PASSE", acao).pode, acao).toBe(true);
    }
  });
});
