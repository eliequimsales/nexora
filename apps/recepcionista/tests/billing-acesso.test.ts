import { describe, expect, it } from "vitest";
import {
  ACOES,
  ACOES_SEMPRE_LIVRES,
  estadoDaConta,
  podeExecutar,
  TOLERANCIA_DIAS,
  type Acao,
  type EstadoConta,
  type Assinatura,
} from "@/lib/billing/acesso";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";

const em = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function conta(over: Partial<Assinatura> = {}): Assinatura {
  return {
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    dunningIniciadoEm: null,
    ...over,
  };
}

const TODOS_ESTADOS: EstadoConta[] = [
  "GRATIS",
  "TRIAL",
  "TRIAL_EXPIRADO",
  "ATIVO",
  "TOLERANCIA",
  "BLOQUEADO",
  "CANCELADO_COM_ACESSO",
  "CANCELADO",
];

// ---------------------------------------------------------------------------
// ESTADO DA CONTA — derivado por função pura, com `agora` injetado. Nada de
// `new Date()` escondido: o dia em que o acesso de um cliente pagante vira
// bloqueio não pode depender do relógio de quem roda o teste.
// ---------------------------------------------------------------------------
describe("estadoDaConta", () => {
  // Sem assinatura e sem prazo nenhum é a conta que nunca teve teste grátis: a
  // que aceitou os Termos em que a Nexora é grátis para descobrir e paga para
  // recuperar. Conta antiga, que aceitou o mês grátis, ganha relógio antes de
  // chegar aqui (garantirRelogio) e nunca cai neste caso.
  it("sem assinatura e sem relógio é GRATIS: descobre de graça, não age", () => {
    expect(estadoDaConta(conta(), em("2026-03-01"))).toBe("GRATIS");
  });

  it("trial local ainda dentro do prazo é TRIAL", () => {
    expect(
      estadoDaConta(conta({ trialEndsAt: em("2026-03-20") }), em("2026-03-01")),
    ).toBe("TRIAL");
  });

  it("trial local vencido é TRIAL_EXPIRADO", () => {
    expect(
      estadoDaConta(conta({ trialEndsAt: em("2026-03-01") }), em("2026-03-20")),
    ).toBe("TRIAL_EXPIRADO");
  });

  it("assinatura ativa é ATIVO", () => {
    expect(
      estadoDaConta(conta({ subscriptionStatus: "active" }), em("2026-03-01")),
    ).toBe("ATIVO");
  });

  // A Stripe põe a assinatura em `paused` quando o trial acaba sem meio de
  // pagamento. É trial expirado, não inadimplência — e a assinatura sobrevive
  // para ser retomada quando o dono adicionar o cartão.
  it("paused (trial acabou sem cartão) é TRIAL_EXPIRADO, não BLOQUEADO", () => {
    expect(
      estadoDaConta(conta({ subscriptionStatus: "paused" }), em("2026-03-01")),
    ).toBe("TRIAL_EXPIRADO");
  });

  it(`past_due dentro dos ${TOLERANCIA_DIAS} dias de tolerância é TOLERANCIA`, () => {
    expect(
      estadoDaConta(
        conta({ subscriptionStatus: "past_due", dunningIniciadoEm: em("2026-03-01") }),
        em("2026-03-05"),
      ),
    ).toBe("TOLERANCIA");
  });

  it(`past_due além dos ${TOLERANCIA_DIAS} dias é BLOQUEADO`, () => {
    expect(
      estadoDaConta(
        conta({ subscriptionStatus: "past_due", dunningIniciadoEm: em("2026-03-01") }),
        em("2026-03-20"),
      ),
    ).toBe("BLOQUEADO");
  });

  // Ele pagou o mês. Cancelar não pode tomar de volta o que já foi pago —
  // é o comportamento que o cliente espera e o único compatível com "risco zero".
  it("cancelado com período pago em aberto mantém acesso", () => {
    expect(
      estadoDaConta(
        conta({ subscriptionStatus: "canceled", currentPeriodEnd: em("2026-04-10") }),
        em("2026-03-20"),
      ),
    ).toBe("CANCELADO_COM_ACESSO");
  });

  it("cancelado com o período já vencido é CANCELADO", () => {
    expect(
      estadoDaConta(
        conta({ subscriptionStatus: "canceled", currentPeriodEnd: em("2026-03-10") }),
        em("2026-03-20"),
      ),
    ).toBe("CANCELADO");
  });
});

// ---------------------------------------------------------------------------
// INVARIANTES DA CONSTITUIÇÃO. Estes dois testes não checam uma regra de
// negócio — eles impedem que qualquer mudança futura viole a Constituição sem
// alguém perceber.
// ---------------------------------------------------------------------------
describe("podeExecutar — invariantes", () => {
  it("INVARIANTE: os dados do dono NUNCA são sequestrados, em NENHUM estado", () => {
    for (const estado of TODOS_ESTADOS) {
      for (const acao of ACOES_SEMPRE_LIVRES) {
        const p = podeExecutar(estado, acao);
        expect(
          p.pode,
          `${acao} foi bloqueada em ${estado} — trava a ação, nunca sequestra o dado`,
        ).toBe(true);
      }
    }
  });

  it("INVARIANTE: toda recusa termina numa ação executável e responde 402", () => {
    for (const estado of TODOS_ESTADOS) {
      for (const acao of ACOES) {
        const p = podeExecutar(estado, acao);
        if (p.pode) continue;
        // Regra Zero: tela que só informa é proibida, inclusive a de bloqueio.
        expect(p.acao.texto.length, `${acao}/${estado} sem texto de ação`).toBeGreaterThan(0);
        expect(p.acao.href.startsWith("/"), `${acao}/${estado} sem href`).toBe(true);
        expect(p.motivo.length).toBeGreaterThan(0);
        // 402 diz "falta pagar". 401 mandaria o dono logar de novo e 403 diria
        // que ele não tem direito — as duas mentem sobre a causa.
        expect(p.http, `${acao}/${estado} deveria responder 402`).toBe(402);
      }
    }
  });
});

describe("podeExecutar — regras", () => {
  const livres: EstadoConta[] = ["TRIAL", "ATIVO", "TOLERANCIA", "CANCELADO_COM_ACESSO"];
  const travados: EstadoConta[] = ["GRATIS", "TRIAL_EXPIRADO", "BLOQUEADO", "CANCELADO"];

  it("nos estados com acesso, tudo funciona", () => {
    for (const estado of livres) {
      for (const acao of ACOES) {
        expect(podeExecutar(estado, acao).pode, `${acao} em ${estado}`).toBe(true);
      }
    }
  });

  it("nos estados sem acesso, as ações de saída travam", () => {
    const saida: Acao[] = ["GERAR_ONDA", "ENVIAR_TOQUE", "CONECTAR_WHATSAPP"];
    for (const estado of travados) {
      for (const acao of saida) {
        expect(podeExecutar(estado, acao).pode, `${acao} em ${estado}`).toBe(false);
      }
    }
  });

  // Quem nunca teve teste grátis não pode ler "seu teste terminou": seria mentir
  // sobre um período que não existiu. A recusa dele é a oferta.
  it("a recusa de GRATIS oferece o plano, e não fala de teste que acabou", () => {
    const p = podeExecutar("GRATIS", "GERAR_ONDA");
    expect(p.pode).toBe(false);
    if (p.pode) return;
    expect(p.motivo.toLowerCase()).not.toContain("teste");
    expect(p.acao.texto).toContain(emReais(PRECO_MENSAL_CENTS));
    expect(p.acao.href).toBe("/painel/assinatura");
  });

  // A lista é a entrada do diagnóstico, e o diagnóstico é o que mostra ao dono
  // quanto dinheiro está parado. Travar a importação escondia justamente a dor
  // que faz alguém decidir assinar.
  it("importar a lista NUNCA trava: é ela que mostra o dinheiro parado", () => {
    for (const estado of TODOS_ESTADOS) {
      expect(podeExecutar(estado, "IMPORTAR").pode, estado).toBe(true);
    }
  });

  // Marcar que um cliente voltou é como a Receita Recuperada entra no sistema.
  // Bloquear isso destruiria a prova da própria garantia que a gente vende —
  // o dono inadimplente ficaria sem como demonstrar que o produto funcionou.
  it("marcar resultado NUNCA trava: é a prova da garantia", () => {
    for (const estado of TODOS_ESTADOS) {
      expect(podeExecutar(estado, "MARCAR_RESULTADO").pode, estado).toBe(true);
    }
  });

  it("a agenda pública nunca trava — quem sofreria é o cliente final, que não deve nada", () => {
    for (const estado of TODOS_ESTADOS) {
      expect(podeExecutar(estado, "AGENDA_PUBLICA").pode, estado).toBe(true);
    }
  });
});
