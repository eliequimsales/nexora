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
  /**
   * Dado que a lista não trouxe.
   *
   * Existe para separar "não há oportunidade" de "não sei dizer" — duas coisas
   * que o motor colapsava no mesmo `corteHonesto: true`. Recusar a venda por
   * falta de DADO é bug; recusar por falta de OPORTUNIDADE é a Constituição.
   */
  faltando: { data: boolean; valor: boolean };
};

const DIA = 86_400_000;

/** Diagnóstico que não pode ser feito: falta o dado, não a oportunidade. */
function semDado(
  base: ClienteBase[],
  faltando: { data: boolean; valor: boolean },
  recomendacao: string,
): Diagnostico {
  return {
    totalClientes: base.length,
    sumidos: 0,
    percentualSumido: 0,
    visitasEsperadasNoPeriodo: 0,
    recuperavelCents: { min: 0, central: 0, max: 0 },
    metodo: "",
    confianca: "baixa",
    motivoConfianca: recomendacao,
    nomes: [],
    // NÃO é Corte Honesto. O Corte Honesto é uma recusa de venda com base em
    // evidência; isto é ausência de evidência, e tratar os dois como a mesma
    // coisa fazia a porta de entrada da empresa recusar todo mundo que colou a
    // conversa do WhatsApp — o caminho de menor fricção, e o mais comum.
    corteHonesto: false,
    recomendacao,
    faltando,
  };
}

export function gerarDiagnostico(
  base: ClienteBase[],
  opcoes: {
    hoje?: Date;
    medianaSegmentoDias?: number;
    /** Ticket informado pelo DONO quando a lista não traz valor nenhum. */
    ticketPadraoCents?: number;
  } = {},
): Diagnostico {
  const hoje = opcoes.hoje ?? new Date();
  const mediana = opcoes.medianaSegmentoDias ?? 30;

  // Lista vazia é Corte Honesto de verdade: não falta um dado, falta a base.
  // Sem esta porta, a ausência total cairia no caminho de "falta a data" e o
  // diagnóstico pediria uma coluna para uma lista que não tem nenhuma linha.
  const temData = base.length > 0 && base.some((c) => c.visitas.length > 0);
  const temValor = base.some((c) => c.visitas.some((v) => v.valorCents > 0));
  const ticketPadrao = opcoes.ticketPadraoCents ?? 0;

  // Sem data não existe "sumido" — existe "não sei quando ele veio". Sem essa
  // porta, `classificar()` recebe ultimaVisita null, devolve RESGATE para todo
  // mundo, e a tela afirma que 100% da base sumiu. Número inflado mente tanto
  // quanto número escondido.
  if (base.length > 0 && !temData) {
    return semDado(
      base,
      { data: true, valor: !temValor && ticketPadrao <= 0 },
      "Sua lista não tem a data do último atendimento. Sem ela eu consigo ver quem são os " +
        "seus clientes, mas não consigo saber quem sumiu — e eu não vou chutar. " +
        "Inclua a data e refaça: leva dois minutos.",
    );
  }

  // Sem a coluna de valor o cálculo do DINHEIRO não sai — mas a contagem de
  // quem sumiu sai, porque ela só depende das datas. Esconder as duas coisas
  // jogaria fora a metade do diagnóstico que ainda é verdadeira.
  // `base.length > 0` de novo pelo mesmo motivo: numa lista vazia não falta o
  // valor, falta a lista — e isso é Corte Honesto, não dado ausente.
  const semValorUtil = base.length > 0 && !temValor && ticketPadrao <= 0;

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
    const doHistorico = c.visitas.length ? Math.round(gasto / c.visitas.length) : 0;
    // Quando a lista não traz valor, usamos o que o DONO informou. A tela diz
    // de onde veio o número; inventar em silêncio seria pior que não calcular.
    const ticket = doHistorico > 0 ? doHistorico : ticketPadrao;
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
  // Ticket informado pelo dono derruba a confiança para baixa, sempre: o valor
  // não saiu dos registros dele, saiu da memória dele.
  const usouTicketInformado = !temValor && ticketPadrao > 0;
  const confianca: "alta" | "baixa" =
    !usouTicketInformado && proporcao >= 0.5 ? "alta" : "baixa";

  const motivoConfianca = usouTicketInformado
    ? `O valor de cada atendimento foi VOCÊ que me informou (${reais(ticketPadrao)}), porque ` +
      `sua lista não trazia esse dado. A frequência é a dos seus registros, mas o dinheiro ` +
      `depende desse número que você deu — se ele variar muito entre clientes, o total varia junto.`
    : confianca === "alta"
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

  // O Corte Honesto pressupõe que dá para medir. Sem valor, `min` é 0 por falta
  // de dado e não por falta de oportunidade — recusar aí seria recusar todo
  // mundo que colou a exportação do WhatsApp, que é o caminho mais fácil e o
  // mais comum. Falta de evidência não é evidência de ausência.
  const corteHonesto = semValorUtil
    ? false
    : sumidos.length < MIN_SUMIDOS || min < MIN_RECUPERAVEL_CENTS;

  if (semValorUtil) {
    return {
      totalClientes: base.length,
      sumidos: sumidos.length,
      percentualSumido: base.length
        ? Math.round((sumidos.length / base.length) * 100)
        : 0,
      visitasEsperadasNoPeriodo: visitasEsperadas,
      recuperavelCents: { min: 0, central: 0, max: 0 },
      metodo:
        "Contei quem sumiu pela frequência de cada um na sua lista. O valor eu ainda não " +
        "consigo calcular, porque a lista não traz quanto cada atendimento custou.",
      confianca: "baixa",
      motivoConfianca:
        "Sua lista não tem o valor de cada atendimento, então eu sei QUEM sumiu mas não " +
        "sei QUANTO isso vale. Me diga quanto você cobra em média que eu refaço a conta.",
      nomes,
      corteHonesto: false,
      // Verbo irregular: o plural de "sumiu" é "sumiram", não "sumiu"+"ram".
      // Concatenar sufixo funciona para substantivo e quebra em verbo.
      recomendacao:
        `Achei ${sumidos.length} ${sumidos.length === 1 ? "cliente que sumiu" : "clientes que sumiram"} ` +
        `da sua lista. Para eu dizer quanto isso é em dinheiro, me informe quanto você cobra ` +
        `em média por atendimento.`,
      faltando: { data: false, valor: true },
    };
  }

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
    faltando: { data: false, valor: false },
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
