import { describe, expect, it } from "vitest";
import {
  PRECO_FUNDADOR_CENTS,
  PRECO_LISTA_CENTS,
  precoDaVez,
  VAGAS_FUNDADOR,
} from "@/lib/billing/preco";

// ---------------------------------------------------------------------------
// PREÇO DE FUNDADOR — escassez que o sistema CONTA, não que o marketing
// inventa. "Restam 6 vagas" só pode aparecer na tela se 6 for o número real de
// vagas; senão é a mesma publicidade enganosa que a Constituição proíbe.
// ---------------------------------------------------------------------------
describe("precoDaVez", () => {
  it("sem nenhum assinante, todas as vagas de fundador estão abertas", () => {
    const p = precoDaVez(0);
    expect(p.fundador).toBe(true);
    expect(p.cents).toBe(PRECO_FUNDADOR_CENTS);
    expect(p.vagasRestantes).toBe(VAGAS_FUNDADOR);
  });

  it("conta a vaga certa no meio da cohort", () => {
    const p = precoDaVez(14);
    expect(p.fundador).toBe(true);
    expect(p.vagasRestantes).toBe(VAGAS_FUNDADOR - 14);
  });

  it("na última vaga ainda é fundador", () => {
    const p = precoDaVez(VAGAS_FUNDADOR - 1);
    expect(p.fundador).toBe(true);
    expect(p.vagasRestantes).toBe(1);
  });

  it("preenchidas as vagas, passa a valer o preço de lista", () => {
    const p = precoDaVez(VAGAS_FUNDADOR);
    expect(p.fundador).toBe(false);
    expect(p.cents).toBe(PRECO_LISTA_CENTS);
    expect(p.vagasRestantes).toBe(0);
  });

  it("nunca devolve vaga negativa, mesmo com mais assinantes que vagas", () => {
    expect(precoDaVez(500).vagasRestantes).toBe(0);
    expect(precoDaVez(500).fundador).toBe(false);
  });

  it("o preço de fundador é menor que o de lista, e nenhum dos dois é zero", () => {
    expect(PRECO_FUNDADOR_CENTS).toBeGreaterThan(0);
    expect(PRECO_FUNDADOR_CENTS).toBeLessThan(PRECO_LISTA_CENTS);
  });

  it("aponta para a variável de ambiente correspondente ao preço escolhido", () => {
    expect(precoDaVez(0).variavel).toBe("STRIPE_PRICE_FUNDADOR");
    expect(precoDaVez(VAGAS_FUNDADOR).variavel).toBe("STRIPE_PRICE_PRO");
  });
});
