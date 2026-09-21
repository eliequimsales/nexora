import { describe, expect, it } from "vitest";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import {
  ACOES_DA_PRIMEIRA_ONDA,
  avisoDaPrimeiraOnda,
  DIAS_DA_PRIMEIRA_ONDA,
  fimDaPrimeiraOnda,
  podeNaPrimeiraOnda,
  resultadoDaPrimeiraOnda,
  situacaoDaPrimeiraOnda,
  TRAVA_NA_PRIMEIRA_ONDA,
} from "@/lib/billing/primeira-onda";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * A PRIMEIRA ONDA POR NOSSA CONTA.
 *
 * No lugar do teste de dias corridos, a conta sem plano ganha a primeira Onda:
 * gera, liga o WhatsApp e manda as mensagens dela antes de pagar. O que decide
 * a compra passa a ser o que a Onda fez com a lista do próprio dono.
 */

const DIA = 86_400_000;
const AGORA = new Date("2026-09-21T15:00:00.000Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * DIA);

describe("situacaoDaPrimeiraOnda", () => {
  it("conta que nunca gerou uma Onda tem a primeira disponível", () => {
    expect(situacaoDaPrimeiraOnda({ primeiraOndaEm: null, enviadas: 0, agora: AGORA })).toBe(
      "DISPONIVEL",
    );
  });

  it("gerada há pouco e com menos de doze mensagens, está em andamento", () => {
    expect(
      situacaoDaPrimeiraOnda({ primeiraOndaEm: diasAtras(2), enviadas: 5, agora: AGORA }),
    ).toBe("EM_ANDAMENTO");
  });

  it(`a ${TAMANHO_DA_ONDA}ª mensagem encerra a primeira Onda`, () => {
    expect(
      situacaoDaPrimeiraOnda({
        primeiraOndaEm: diasAtras(1),
        enviadas: TAMANHO_DA_ONDA,
        agora: AGORA,
      }),
    ).toBe("USADA");
  });

  // Quem manda pelo link do WhatsApp e nunca marca "já mandei" não chega a doze.
  // Sem prazo, a primeira Onda nunca terminaria.
  it(`passados ${DIAS_DA_PRIMEIRA_ONDA} dias, ela termina mesmo com menos mensagens`, () => {
    expect(
      situacaoDaPrimeiraOnda({
        primeiraOndaEm: diasAtras(DIAS_DA_PRIMEIRA_ONDA),
        enviadas: 3,
        agora: AGORA,
      }),
    ).toBe("USADA");
  });

  it("o prazo termina exatamente sete dias depois de gerada", () => {
    expect(fimDaPrimeiraOnda(diasAtras(2))).toEqual(
      new Date(diasAtras(2).getTime() + DIAS_DA_PRIMEIRA_ONDA * DIA),
    );
  });
});

describe("podeNaPrimeiraOnda", () => {
  // Mandar antes de a Onda existir deixaria quem chama a rota direto mandar sem
  // nunca começar a contagem.
  it("disponível: gera a Onda e liga o WhatsApp, mas ainda não manda", () => {
    expect(podeNaPrimeiraOnda("GRATIS", "GERAR_ONDA", "DISPONIVEL")).toBe(true);
    expect(podeNaPrimeiraOnda("GRATIS", "CONECTAR_WHATSAPP", "DISPONIVEL")).toBe(true);
    expect(podeNaPrimeiraOnda("GRATIS", "ENVIAR_TOQUE", "DISPONIVEL")).toBe(false);
  });

  it("em andamento: as três ações da Onda", () => {
    for (const acao of ACOES_DA_PRIMEIRA_ONDA) {
      expect(podeNaPrimeiraOnda("GRATIS", acao, "EM_ANDAMENTO"), acao).toBe(true);
    }
  });

  it("usada: nenhuma", () => {
    for (const acao of ACOES_DA_PRIMEIRA_ONDA) {
      expect(podeNaPrimeiraOnda("GRATIS", acao, "USADA"), acao).toBe(false);
    }
  });

  it("não libera nada fora das ações da Onda", () => {
    expect([...ACOES_DA_PRIMEIRA_ONDA].sort()).toEqual(
      ["CONECTAR_WHATSAPP", "ENVIAR_TOQUE", "GERAR_ONDA"].sort(),
    );
  });

  // A primeira Onda é de quem nunca pagou nem testou: quem teve teste já teve a prova.
  it("só vale para a conta GRATIS", () => {
    for (const estado of ["TRIAL_EXPIRADO", "BLOQUEADO", "CANCELADO"] as const) {
      expect(podeNaPrimeiraOnda(estado, "GERAR_ONDA", "DISPONIVEL"), estado).toBe(false);
    }
  });
});

describe("resultadoDaPrimeiraOnda", () => {
  it("conta pelas marcações do dono e deixa os pulados de fora", () => {
    expect(
      resultadoDaPrimeiraOnda(
        ["AGUARDANDO", "RESPONDEU", "MARCOU", "VOLTOU", "SEM_RESPOSTA", "PULADO"],
        12_000,
      ),
    ).toEqual({ enviadas: 5, responderam: 3, voltaram: 1, recuperadoCents: 12_000 });
  });
});

describe("avisoDaPrimeiraOnda — o que o painel diz", () => {
  it("disponível: diz o tamanho, que é sem cartão, e leva para a Onda", () => {
    const a = avisoDaPrimeiraOnda({ situacao: "DISPONIVEL", enviadas: 0, ate: null });
    expect(a.texto).toContain(`${TAMANHO_DA_ONDA} mensagens`);
    expect(a.texto.toLowerCase()).toContain("sem cartão");
    expect(a.acao.href).toBe("/painel/onda");
  });

  it("em andamento: quantas foram e até quando vale", () => {
    const a = avisoDaPrimeiraOnda({
      situacao: "EM_ANDAMENTO",
      enviadas: 4,
      ate: new Date("2026-09-28T15:00:00.000Z"),
    });
    expect(a.texto).toContain(`4 de ${TAMANHO_DA_ONDA}`);
    expect(a.texto).toContain("28/09");
    expect(a.acao.href).toBe("/painel/onda");
  });

  it("usada: o preço sai da constante e leva para os planos", () => {
    const a = avisoDaPrimeiraOnda({ situacao: "USADA", enviadas: 12, ate: null });
    expect(a.acao.texto).toContain(emReais(PRECO_MENSAL_CENTS));
    expect(a.acao.href).toBe("/painel/assinatura");
  });

  it("a trava de Meus clientes aponta para a primeira Onda, sem pedir plano", () => {
    expect(TRAVA_NA_PRIMEIRA_ONDA.acao.href).toBe("/painel/onda");
    expect(TRAVA_NA_PRIMEIRA_ONDA.motivo).not.toMatch(/R\$/);
  });
});
