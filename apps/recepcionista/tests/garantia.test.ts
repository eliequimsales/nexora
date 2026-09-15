import { describe, expect, it } from "vitest";
import {
  avaliarGarantia,
  ENVIOS_POR_ONDA,
  GARANTIA_DIAS,
  ONDAS_MINIMAS,
  pendentesSemResposta,
  PRAZO_PEDIDO_DIAS,
  recuperadoNaGarantia,
  semanasComOnda,
  type SinaisDaGarantia,
} from "@/lib/billing/garantia";
import { PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * GARANTIA DINHEIRO RECUPERADO.
 *
 * Aprovada pelo fundador em 14/09/2026: quem manda as mensagens de 3 ondas nos
 * primeiros 30 dias e não recupera nem R$ 97 recebe de volta tudo o que pagou —
 * a mensalidade, os 30 dias no Pix ou o anual. Vale uma vez por negócio, só para
 * lista acima do Corte Honesto, e o pedido fica aberto do dia 30 ao 37.
 *
 * A regra é pura porque cada condição aqui é dinheiro devolvido ou recusado a
 * alguém — e isso não pode depender de relógio nem de banco para ser testado.
 */

const DIA = 86_400_000;
const INICIO = new Date("2026-09-15T12:00:00.000Z");
const noDia = (n: number) => new Date(INICIO.getTime() + n * DIA);

function sinais(over: Partial<SinaisDaGarantia> = {}): SinaisDaGarantia {
  return {
    inicio: INICIO,
    acimaDoCorte: true,
    usadaEm: null,
    ondas: ONDAS_MINIMAS,
    pendentesSemResposta: 0,
    recuperadoCents: 0,
    ...over,
  };
}

describe("as regras aprovadas", () => {
  it("30 dias de conta, 7 para pedir, 3 ondas, e uma onda é pelo menos metade dos 12", () => {
    expect(GARANTIA_DIAS).toBe(30);
    expect(PRAZO_PEDIDO_DIAS).toBe(7);
    expect(ONDAS_MINIMAS).toBe(3);
    expect(ENVIOS_POR_ONDA).toBe(Math.ceil(TAMANHO_DA_ONDA / 2));
  });
});

describe("avaliarGarantia", () => {
  it("cumpriu tudo e não recuperou nem R$ 97: devolve, do dia 30 ao 37", () => {
    for (const dia of [30, 33, 37]) {
      const d = avaliarGarantia(sinais({ recuperadoCents: PRECO_MENSAL_CENTS - 1 }), noDia(dia));
      expect(d.devolve, `dia ${dia}`).toBe(true);
      expect(d.situacao, `dia ${dia}`).toBe("DISPONIVEL");
    }
  });

  it("o pedido vale até o fim do dia 37", () => {
    const d = avaliarGarantia(sinais(), noDia(31));
    expect(d.situacao).toBe("DISPONIVEL");
    if (d.situacao === "DISPONIVEL") expect(d.pedirAte).toEqual(noDia(GARANTIA_DIAS + PRAZO_PEDIDO_DIAS + 1));
  });

  it("recuperou R$ 97 ou mais: a Nexora se pagou e não há devolução", () => {
    const d = avaliarGarantia(sinais({ recuperadoCents: PRECO_MENSAL_CENTS }), noDia(31));
    expect(d.devolve).toBe(false);
    expect(d.situacao).toBe("SE_PAGOU");
  });

  it("sem compra com garantia, não há o que avaliar", () => {
    expect(avaliarGarantia(sinais({ inicio: null }), noDia(31)).situacao).toBe("SEM_GARANTIA");
  });

  it("vale uma vez por negócio", () => {
    expect(avaliarGarantia(sinais({ usadaEm: noDia(-400) }), noDia(31)).situacao).toBe("USADA");
  });

  it("antes do dia 30 a conta ainda não fechou, e a ação é mandar a onda", () => {
    const d = avaliarGarantia(sinais({ ondas: 1 }), noDia(12));
    expect(d.devolve).toBe(false);
    expect(d.situacao).toBe("EM_ANDAMENTO");
    expect(d.acao.href).toBe("/painel/onda");
    if (d.situacao === "EM_ANDAMENTO") expect(d.abreEm).toEqual(noDia(GARANTIA_DIAS));
  });

  it("depois do dia 37 o prazo de pedir acabou", () => {
    expect(avaliarGarantia(sinais(), noDia(38)).situacao).toBe("PRAZO_VENCIDO");
  });

  it("lista abaixo do Corte Honesto na compra não tem garantia, como a tela avisou", () => {
    expect(avaliarGarantia(sinais({ acimaDoCorte: false }), noDia(31)).situacao).toBe(
      "ABAIXO_DO_CORTE",
    );
  });

  it("menos de 3 ondas: diz quantas foram e manda para a onda", () => {
    const d = avaliarGarantia(sinais({ ondas: 2 }), noDia(31));
    expect(d.situacao).toBe("POUCAS_ONDAS");
    expect(d.motivo).toContain("2");
    expect(d.acao.href).toBe("/painel/onda");
  });

  it("contato sem resposta de 'voltou?': diz quantos faltam e manda marcar", () => {
    const d = avaliarGarantia(sinais({ pendentesSemResposta: 4 }), noDia(31));
    expect(d.situacao).toBe("SEM_RESPOSTA");
    expect(d.motivo).toContain("4");
    expect(d.acao.href).toBe("/painel/onda");
  });

  // Marcar mais respostas só pode aumentar o que voltou. Mandar quem já passou de
  // R$ 97 fazer mais ondas "para ter direito" seria empurrar para um beco.
  it("quem já se pagou ouve isso primeiro, e não que faltam ondas", () => {
    const d = avaliarGarantia(
      sinais({ recuperadoCents: 30_000, ondas: 1, pendentesSemResposta: 3 }),
      noDia(31),
    );
    expect(d.situacao).toBe("SE_PAGOU");
  });

  it("toda decisão termina numa ação (Regra Zero)", () => {
    const casos = [
      sinais({ inicio: null }),
      sinais({ usadaEm: noDia(-1) }),
      sinais({ ondas: 0 }),
      sinais({ acimaDoCorte: false }),
      sinais({ pendentesSemResposta: 1 }),
      sinais({ recuperadoCents: 50_000 }),
      sinais(),
    ];
    for (const dia of [5, 30, 40]) {
      for (const caso of casos) {
        const d = avaliarGarantia(caso, noDia(dia));
        expect(d.motivo.length, `${d.situacao} no dia ${dia}`).toBeGreaterThan(0);
        expect(d.acao.texto.length, `${d.situacao} no dia ${dia}`).toBeGreaterThan(0);
        expect(d.acao.href.startsWith("/"), `${d.situacao} no dia ${dia}`).toBe(true);
      }
    }
  });
});

describe("semanasComOnda", () => {
  const envios = (dia: number, quantos: number) =>
    Array.from({ length: quantos }, (_, i) => new Date(noDia(dia).getTime() + i * 60_000));

  it("conta a semana em que saiu pelo menos metade da onda", () => {
    expect(
      semanasComOnda(
        [...envios(1, ENVIOS_POR_ONDA), ...envios(8, 12), ...envios(15, ENVIOS_POR_ONDA)],
        INICIO,
      ),
    ).toBe(3);
  });

  it("semana com poucas mensagens não conta como onda", () => {
    expect(semanasComOnda([...envios(1, ENVIOS_POR_ONDA - 1), ...envios(8, 12)], INICIO)).toBe(1);
  });

  it("envio fora dos 30 dias não conta", () => {
    expect(semanasComOnda([...envios(-10, 12), ...envios(31, 12)], INICIO)).toBe(0);
  });

  it("mandar tudo no mesmo dia é uma onda só", () => {
    expect(semanasComOnda(envios(2, 36), INICIO)).toBe(1);
  });
});

describe("pendentesSemResposta", () => {
  const agora = noDia(31);

  it("conta o contato dos 30 dias que segue sem resposta há 3 dias ou mais", () => {
    expect(
      pendentesSemResposta(
        [
          { sentAt: noDia(5), outcome: "AGUARDANDO" },
          { sentAt: noDia(20), outcome: "VOLTOU" },
          { sentAt: noDia(27), outcome: "SEM_RESPOSTA" },
        ],
        INICIO,
        agora,
      ),
    ).toBe(1);
  });

  it("contato dos últimos 3 dias ainda não pode ser cobrado", () => {
    expect(pendentesSemResposta([{ sentAt: noDia(29), outcome: "AGUARDANDO" }], INICIO, agora)).toBe(0);
  });

  it("contato de antes da compra não entra", () => {
    expect(pendentesSemResposta([{ sentAt: noDia(-3), outcome: "AGUARDANDO" }], INICIO, agora)).toBe(0);
  });
});

describe("recuperadoNaGarantia", () => {
  // Até o pedido, e não só até o dia 30: quem voltou no dia 29 costuma ser
  // marcado dias depois, e deixar para marcar não pode virar direito a devolução.
  it("soma só o que foi atribuído à Nexora, desde o início até o pedido", () => {
    expect(
      recuperadoNaGarantia(
        [
          { returnedAt: noDia(3), valueCents: 4_000, attributed: true },
          { returnedAt: noDia(10), valueCents: 9_000, attributed: false },
          { returnedAt: noDia(-2), valueCents: 5_000, attributed: true },
          { returnedAt: noDia(32), valueCents: 3_000, attributed: true },
        ],
        INICIO,
        noDia(33),
      ),
    ).toBe(7_000);
  });
});
