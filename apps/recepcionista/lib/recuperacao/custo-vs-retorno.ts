import { PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { JANELA_DIAS } from "@/lib/recuperacao/estimativa";

/**
 * O QUE A NEXORA CUSTA VS. O QUE ELA TRAZ — na mesma janela.
 *
 * A faixa do diagnóstico é o que volta em 90 dias. Comparar isso com "R$ 97 por
 * mês" misturaria janelas; o custo certo é o que o dono pagaria nesses mesmos
 * dias.
 *
 * São todas as mensalidades da janela. Desde os Termos de 2026-09-15 a conta nova
 * não tem mês grátis, e descontar um mês que não existe mostraria o custo menor do
 * que ele é — justamente no bloco que decide a compra.
 *
 * A comparação usa o cenário mais baixo da faixa e arredonda para baixo. Usar o
 * topo, ou arredondar para cima, seria escolher o número a favor da venda.
 */

const DIAS_POR_MES = 30;

export type ComparacaoCustoRetorno = {
  mesesNaJanela: number;
  mesesPagos: number;
  custoCents: number;
  /** Quantas vezes o retorno MÍNIMO cobre o custo, com uma casa, arredondado para baixo. */
  vezesNoMinimo: number;
  cobreNoMinimo: boolean;
};

export function custoVsRetorno(retorno: { min: number; max: number }): ComparacaoCustoRetorno {
  const mesesNaJanela = Math.round(JANELA_DIAS / DIAS_POR_MES);
  const mesesPagos = mesesNaJanela;
  const custoCents = mesesPagos * PRECO_MENSAL_CENTS;
  const vezesNoMinimo = custoCents > 0 ? Math.floor((retorno.min / custoCents) * 10) / 10 : 0;
  return {
    mesesNaJanela,
    mesesPagos,
    custoCents,
    vezesNoMinimo,
    cobreNoMinimo: retorno.min >= custoCents,
  };
}
