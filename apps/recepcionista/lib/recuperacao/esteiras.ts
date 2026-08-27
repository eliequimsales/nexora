/**
 * AS TRÊS ESTEIRAS
 *
 * A resposta ao problema estrutural da recuperação: o valor é episódico se o
 * produto só olha para o estoque histórico. O mês 1 entrega os clientes
 * acumulados de anos; o mês 2 não teria nada.
 *
 * A solução é manter o TAMANHO da onda fixo e trocar a COMPOSIÇÃO:
 *
 *   RESGATE     estoque histórico, finito — esgota em 3 a 5 meses, de propósito
 *   ATRASO      passou de 1,5x o próprio ciclo — regenera toda semana
 *   PRE_ATRASO  vence esta semana e não marcou — regenera todo dia e converte
 *               mais que as outras duas, porque sumiço recente volta mais fácil
 *
 * Numa barbearia com 400 clientes e ciclo de 25 dias, ~112 pessoas por semana
 * atingem a data de voltar. Se 15 a 20% escorregam, são 17 a 22 novos atrasados
 * TODA SEMANA. O estoque acaba; o fluxo não acaba nunca, porque é função do
 * próprio funcionamento do negócio.
 */

import type { Ciclo } from "./ciclo";

export type Esteira = "PRE_ATRASO" | "ATRASO" | "RESGATE" | "EM_DIA";

/** A partir de quantos ciclos o cliente é considerado atrasado. */
const FATOR_ATRASO = 1.5;
/** A partir de quantos ciclos ele deixa de ser atraso e vira estoque histórico. */
const FATOR_RESGATE = 3;
/** Janela do pré-atraso: a data de voltar cai dentro dos próximos N dias. */
const JANELA_PRE_ATRASO_DIAS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

function diasEntre(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / DIA_MS);
}

export type EntradaClassificacao = {
  ultimaVisita: Date | null;
  ciclo: Ciclo;
  /** Quem já marcou NUNCA é contatado — mandar saudade para quem tem horário
   *  marcado destrói a confiança no produto na primeira mensagem. */
  temAgendamentoFuturo: boolean;
  hoje: Date;
};

export type Classificacao = {
  esteira: Esteira;
  diasDesdeUltima: number;
  /** Quantos dias além do ciclo dele — é o texto do porquê auditável. */
  diasAlemDoCiclo: number;
};

export function classificar(entrada: EntradaClassificacao): Classificacao {
  const { ultimaVisita, ciclo, temAgendamentoFuturo, hoje } = entrada;

  if (temAgendamentoFuturo) {
    const dias = ultimaVisita ? diasEntre(ultimaVisita, hoje) : 0;
    return {
      esteira: "EM_DIA",
      diasDesdeUltima: dias,
      diasAlemDoCiclo: Math.max(0, dias - ciclo.dias),
    };
  }

  // Cliente importado sem histórico nenhum: não dá para calcular atraso, então
  // é estoque a resgatar — é exatamente o caso do Resgate do Caderno.
  if (!ultimaVisita) {
    return { esteira: "RESGATE", diasDesdeUltima: 0, diasAlemDoCiclo: 0 };
  }

  const diasDesdeUltima = diasEntre(ultimaVisita, hoje);
  const diasAlemDoCiclo = Math.max(0, diasDesdeUltima - ciclo.dias);

  const limiarAtraso = ciclo.dias * FATOR_ATRASO;
  const limiarResgate = ciclo.dias * FATOR_RESGATE;

  if (diasDesdeUltima > limiarResgate) {
    return { esteira: "RESGATE", diasDesdeUltima, diasAlemDoCiclo };
  }

  if (diasDesdeUltima > limiarAtraso) {
    return { esteira: "ATRASO", diasDesdeUltima, diasAlemDoCiclo };
  }

  // Pré-atraso: a data prevista de retorno cai dentro da janela desta semana.
  // Negativo também conta — ele já passou da data mas ainda não virou atraso.
  const diasAteVencer = ciclo.dias - diasDesdeUltima;
  if (diasAteVencer <= JANELA_PRE_ATRASO_DIAS) {
    return { esteira: "PRE_ATRASO", diasDesdeUltima, diasAlemDoCiclo };
  }

  return { esteira: "EM_DIA", diasDesdeUltima, diasAlemDoCiclo };
}
