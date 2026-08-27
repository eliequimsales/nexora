/**
 * DIAGNÓSTICO DE RECEITA PARADA
 *
 * A peça de venda inteira da Nexora. Roda na base do próprio prospect, de
 * graça, antes de qualquer pagamento — porque prova sobre ELE mesmo não se
 * desconta nem se falsifica, e substitui o depoimento que ainda não existe.
 *
 * Duas regras herdadas da Constituição, ambas inegociáveis:
 *
 *   VERDADE ACIMA DE MARKETING — nenhum número sai daqui sozinho. Sempre com
 *   faixa mínima e máxima, o método em uma linha e o selo de confiança. Número
 *   solto vira publicidade enganosa pelo CDC mesmo sem intenção.
 *
 *   CORTE HONESTO — se a base não tem o que recuperar, o diagnóstico RECUSA a
 *   venda. Recusar na frente do comprador prova a Constituição em ato, e filtra
 *   o cancelamento do mês 2: base pequena cancela achando que o produto falhou.
 */

import { calcularCiclo } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";

/** Faixa de reativação observada em campanhas de recuperação, em 90 dias. */
const TAXA_MIN = 0.15;
const TAXA_MAX = 0.25;
const JANELA_DIAS = 90;
/** Teto de visitas projetadas. Ciclo semanal daria 13 na janela — projetar
 *  isso é fantasia, ninguém recupera alguém e mantém 13 idas seguidas. */
const MAX_VISITAS_PROJETADAS = 4;

/** Abaixo disto não há o que recuperar: o Corte Honesto entra. */
const MIN_SUMIDOS = 25;
const MIN_RECUPERAVEL_CENTS = 50_000;

export type ClienteBase = {
  nome: string;
  telefone: string;
  visitas: { data: Date; valorCents: number }[];
};

export type NomeDoTop = {
  nome: string;
  telefone: string;
  diasSumido: number;
  ticketCents: number;
  visitas: number;
  confianca: "alta" | "baixa";
  porque: string;
};

export type Diagnostico = {
  totalClientes: number;
  sumidos: number;
  percentualSumido: number;
  visitasEsperadasNoPeriodo: number;
  recuperavelCents: { min: number; central: number; max: number };
  metodo: string;
  confianca: "alta" | "baixa";
  motivoConfianca: string;
  nomes: NomeDoTop[];
  corteHonesto: boolean;
  recomendacao: string;
};

const DIA = 86_400_000;

export function gerarDiagnostico(
  base: ClienteBase[],
  opcoes: { hoje?: Date; medianaSegmentoDias?: number } = {},
): Diagnostico {
  const hoje = opcoes.hoje ?? new Date();
  const mediana = opcoes.medianaSegmentoDias ?? 30;

  const avaliados = base.map((c) => {
    const datas = c.visitas.map((v) => v.data);
    const ciclo = calcularCiclo(datas, mediana);
    const ultima = datas.length
      ? datas.reduce((a, b) => (a > b ? a : b))
      : null;
    const classificacao = classificar({
      ultimaVisita: ultima,
      ciclo,
      temAgendamentoFuturo: false,
      hoje,
    });
    const gasto = c.visitas.reduce((s, v) => s + v.valorCents, 0);
    const ticket = c.visitas.length ? Math.round(gasto / c.visitas.length) : 0;
    return { cliente: c, ciclo, classificacao, ticket, ultima };
  });

  const sumidos = avaliados.filter(
    (a) => a.classificacao.esteira === "ATRASO" || a.classificacao.esteira === "RESGATE",
  );

  // Quantas vezes o cliente recuperado voltaria na janela, retomando o ciclo
  // dele. Contar só uma subestima em 3x — subestimar também é impreciso.
  const cicloMedio = sumidos.length
    ? Math.round(sumidos.reduce((s, a) => s + a.ciclo.dias, 0) / sumidos.length)
    : mediana;
  const visitasEsperadas = Math.max(
    1,
    Math.min(MAX_VISITAS_PROJETADAS, Math.round(JANELA_DIAS / Math.max(1, cicloMedio))),
  );

  const somaTickets = sumidos.reduce((s, a) => s + a.ticket, 0);
  const potencial = somaTickets * visitasEsperadas;

  const min = Math.round(potencial * TAXA_MIN);
  const max = Math.round(potencial * TAXA_MAX);
  const central = Math.round((min + max) / 2);

  const comHistorico = avaliados.filter((a) => a.ciclo.confianca === "alta").length;
  const proporcao = avaliados.length ? comHistorico / avaliados.length : 0;
  const confianca: "alta" | "baixa" = proporcao >= 0.5 ? "alta" : "baixa";

  const motivoConfianca =
    confianca === "alta"
      ? `${comHistorico} de ${avaliados.length} clientes têm 3 ou mais visitas registradas — dá para calcular o ritmo de cada um.`
      : `Poucos clientes têm histórico suficiente (só ${comHistorico} de ${avaliados.length} têm 3 ou mais visitas). ` +
        `Sem isso usamos a média do segmento, e o valor pode errar bastante para mais ou para menos.`;

  const nomes = [...sumidos]
    .sort((a, b) => pontuar(b) - pontuar(a))
    .slice(0, 3)
    .map<NomeDoTop>((a) => ({
      nome: a.cliente.nome,
      telefone: a.cliente.telefone,
      diasSumido: a.classificacao.diasDesdeUltima,
      ticketCents: a.ticket,
      visitas: a.ciclo.visitas,
      confianca: a.ciclo.confianca,
      porque: porque(a),
    }));

  const corteHonesto = sumidos.length < MIN_SUMIDOS || min < MIN_RECUPERAVEL_CENTS;

  return {
    totalClientes: base.length,
    sumidos: sumidos.length,
    percentualSumido: base.length ? Math.round((sumidos.length / base.length) * 100) : 0,
    visitasEsperadasNoPeriodo: visitasEsperadas,
    recuperavelCents: { min, central, max },
    metodo:
      `Usamos o ticket e a frequência dos SEUS registros, e a faixa de 15% a 25% de retorno que ` +
      `campanhas de recuperação costumam dar em 90 dias. Projetamos ${visitasEsperadas} ` +
      `visita${visitasEsperadas > 1 ? "s" : ""} por cliente recuperado na janela, porque quem volta retoma o ritmo dele.`,
    confianca,
    motivoConfianca,
    nomes,
    corteHonesto,
    recomendacao: corteHonesto
      ? sumidos.length === 0
        ? "Não encontrei clientes sumidos nessa base. É uma boa notícia — e significa que a Nexora não tem o que fazer por você agora. Não compre."
        : `Encontrei só ${sumidos.length} cliente${sumidos.length > 1 ? "s" : ""} sumido${sumidos.length > 1 ? "s" : ""}, ` +
          `com cerca de ${reais(min)} recuperáveis. É pouco para justificar a mensalidade — minha recomendação honesta é NÃO comprar agora. ` +
          `Volte quando a base estiver maior.`
      : `Vale a pena: são ${sumidos.length} clientes sumidos e uma faixa de ${reais(min)} a ${reais(max)} ` +
        `recuperáveis nos próximos 90 dias.`,
  };
}

/**
 * Chance de voltar, não só dinheiro. Regularidade prevê retorno melhor que
 * valor gasto — quem vinha toda semana e sumiu tem rotina quebrada, e rotina
 * quebrada volta fácil.
 */
function pontuar(a: {
  ciclo: { dias: number; confianca: "alta" | "baixa"; visitas: number };
  classificacao: { diasAlemDoCiclo: number };
  ticket: number;
}): number {
  return (
    a.ciclo.visitas * 100 +
    (a.ciclo.confianca === "alta" ? 500 : 0) +
    a.ticket / 1000 -
    a.classificacao.diasAlemDoCiclo / 10
  );
}

function porque(a: {
  cliente: ClienteBase;
  ciclo: { dias: number; confianca: "alta" | "baixa"; visitas: number };
  classificacao: { diasDesdeUltima: number; diasAlemDoCiclo: number };
  ticket: number;
}): string {
  if (a.ciclo.confianca === "baixa") {
    return (
      `Sumido há ${a.classificacao.diasDesdeUltima} dias, mas só ${a.ciclo.visitas} ` +
      `visita${a.ciclo.visitas === 1 ? "" : "s"} registrada${a.ciclo.visitas === 1 ? "" : "s"} — ` +
      `não dá para saber o ritmo dele. Trate como palpite: você conhece ele melhor que a gente.`
    );
  }
  return (
    `Vinha a cada ${a.ciclo.dias} dias e sumiu há ${a.classificacao.diasDesdeUltima} dias — ` +
    `${a.classificacao.diasAlemDoCiclo} além do normal dele. ` +
    `${a.ciclo.visitas} visitas registradas, ticket médio ${reais(a.ticket)}.`
  );
}

function reais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
