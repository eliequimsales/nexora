import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * O QUE VOLTOU CONTRA O QUE CUSTA.
 *
 * É o número que decide a renovação, e por isso ele é conservador nos três
 * pontos em que seria fácil inflar:
 *
 *   1. MESMO PERÍODO DOS DOIS LADOS. O Dinheiro recuperado é acumulado desde
 *      sempre; a mensalidade é de um mês. Dividir um pelo outro faz o
 *      multiplicador crescer sozinho: no décimo mês ele anunciaria "10x" sem
 *      nada ter melhorado. Quem chama passa o valor do MÊS, e o acumulado
 *      aparece em reais, sem virar múltiplo.
 *   2. TRUNCA, NUNCA ARREDONDA. 8,49x vira 8,4x.
 *   3. SÓ O COMPROVADO. Quem chama passa o valor atribuído — o retorno que não
 *      dá para ligar à mensagem enviada continua fora, como no Livro-Caixa.
 *
 * Puro e sem banco: quem busca os valores são as telas.
 */

export type Retorno = {
  recuperadoCents: number;
  custoCents: number;
  /** O recuperado no período já paga o que a Nexora custou nele. */
  cobre: boolean;
  /** null quando ainda não houve retorno comprovado — não existe "0,0x". */
  multiplicador: number | null;
  texto: string | null;
  /** O que fazer para o número existir. null quando ele já existe. */
  educativo: string | null;
};

export function retornoDaAssinatura(entrada: {
  recuperadoCents: number;
  custoCents?: number;
  /** O que cada cliente costuma gastar por visita. null = não dá para dizer. */
  ticketMedioCents?: number | null;
}): Retorno {
  const recuperadoCents = Math.max(0, Math.round(entrada.recuperadoCents));
  const custoCents = entrada.custoCents ?? PRECO_MENSAL_CENTS;
  const gastoPorVisita = entrada.ticketMedioCents ?? null;

  const temRetorno = recuperadoCents > 0 && custoCents > 0;
  // Trunca na primeira casa: 8,49x não pode virar 8,5x.
  const multiplicador = temRetorno
    ? Math.floor((recuperadoCents / custoCents) * 10) / 10
    : null;

  return {
    recuperadoCents,
    custoCents,
    cobre: recuperadoCents >= custoCents && custoCents > 0,
    multiplicador,
    texto:
      multiplicador === null
        ? null
        : `Retorno de ${multiplicador.toFixed(1).replace(".", ",")}x sobre a mensalidade de ${emReais(custoCents)}`,
    educativo: temRetorno ? null : educativo(custoCents, gastoPorVisita),
  };
}

/**
 * O estado de R$ 0 termina em ação, nunca em "sem dados" (Regra Zero).
 *
 * Quantos clientes cobrem a mensalidade sai da lista do próprio dono e
 * arredonda para CIMA — a mesma regra de lib/billing/oferta.ts. Sem saber
 * quanto cada visita vale, a frase não inventa número nenhum.
 */
function educativo(custoCents: number, gastoPorVisita: number | null): string {
  const chamada = `Mande as ${TAMANHO_DA_ONDA} mensagens desta semana em Reativar clientes.`;

  if (!gastoPorVisita || gastoPorVisita <= 0) {
    return `${chamada} Quando alguém voltar e pagar, o valor aparece aqui.`;
  }

  const quantos = Math.ceil(custoCents / gastoPorVisita);
  return `${chamada} ${
    quantos === 1
      ? "Basta 1 cliente voltar"
      : `Bastam ${quantos} clientes voltarem`
  } para cobrir o custo da Nexora.`;
}

/**
 * O PRIMEIRO INSTANTE DO MÊS EM BRASÍLIA.
 *
 * O Brasil não tem mais horário de verão, então o fuso é fixo em UTC-3. Num
 * servidor em UTC (Railway), sem isto, quem voltou às 22h do dia 31 cairia no
 * mês seguinte — e o dono confere este número contra o caixa dele.
 */
export function inicioDoMes(agora: Date = new Date()): Date {
  const emSaoPaulo = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  return new Date(Date.UTC(emSaoPaulo.getFullYear(), emSaoPaulo.getMonth(), 1, 3, 0, 0));
}
