import type { Diagnostico } from "@/lib/importacao/diagnostico";
import { JANELA_DIAS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "./garantia";
import { emReais, PRECO_MENSAL_CENTS } from "./preco";
import type { ResultadoDaPrimeiraOnda } from "./primeira-onda";

/**
 * A OFERTA QUE APARECE ONDE A AÇÃO TRAVA.
 *
 * Quem está sem plano e tenta gerar a onda ou pegar a mensagem pronta recebe,
 * junto da recusa, a conta da própria lista. Sai do mesmo diagnóstico que a
 * página pública usa, com as mesmas regras:
 *
 *   - nenhum número sem faixa, e a faixa sempre dita como estimativa;
 *   - lista sem valor não vira reais, lista sem data não vira "sumidos";
 *   - abaixo do Corte Honesto, a oferta recomenda NÃO assinar.
 *
 * Pura e sem banco: quem busca a lista é oferta-da-conta.ts.
 */

export type PreviaDaOnda = { iniciais: string; diasSemVir: number };

export type Oferta = {
  sumidos: number;
  faixaMinCents: number;
  faixaMaxCents: number;
  corteHonesto: boolean;
  /** A lista não traz o valor dos atendimentos: nada de reais. */
  semValor: boolean;
  /** A lista não traz a data do último atendimento: não dá para saber quem sumiu. */
  semData: boolean;
  ticketMedioCents: number | null;
  /** Quantos clientes voltando uma vez pagam a mensalidade. null = sem base para dizer. */
  clientesQuePagamOPlano: number | null;
  clientesNaOnda: number;
  /** Iniciais e dias sem vir. Nome inteiro e telefone nunca saem daqui. */
  previa: PreviaDaOnda[];
  /** A compra levaria a Garantia Dinheiro Recuperado: acima do Corte Honesto e sem garantia antes. */
  comGarantia: boolean;
  /** O que a primeira Onda fez, quando a conta já a gerou. */
  primeiraOnda: ResultadoDaPrimeiraOnda | null;
};

export type TextosDaOferta = {
  /** A etiqueta do cartão: de onde vem o número que ele mostra. */
  rotulo: string;
  titulo: string;
  prova: string;
  ancora: string | null;
  recomendaNaoAssinar: boolean;
  /** A garantia que a compra levaria, dita antes do pagamento; null quando não leva. */
  garantia: string | null;
};

type TextosSemMoldura = Omit<TextosDaOferta, "rotulo" | "garantia">;

/** "Marcos da Silva" → "M. S.". Primeira e última palavra, em maiúscula. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const letras = partes.length === 1 ? [partes[0]] : [partes[0], partes[partes.length - 1]];
  return letras.map((p) => `${p[0].toLocaleUpperCase("pt-BR")}.`).join(" ");
}

export function montarOferta(d: Diagnostico, ticketMedioCents: number | null): Oferta {
  const semValor = d.faltando.valor;
  const ticket = ticketMedioCents && ticketMedioCents > 0 ? ticketMedioCents : null;
  // A assinatura se paga assim que a receita mínima recuperável cobre a mensalidade (R$ 97/mês)
  const cobreMensalidade = !semValor && d.sumidos > 0 && d.recuperavelCents.min >= PRECO_MENSAL_CENTS;
  const corteHonesto = cobreMensalidade ? false : d.corteHonesto;

  return {
    sumidos: d.sumidos,
    faixaMinCents: d.recuperavelCents.min,
    faixaMaxCents: d.recuperavelCents.max,
    corteHonesto,
    semValor,
    semData: d.faltando.data,
    ticketMedioCents: ticket,
    // Arredonda para CIMA: com R$ 48 de ticket, dois retornos dão R$ 96 e ainda
    // falta R$ 1. Arredondar para baixo prometeria que a mensalidade se paga
    // antes de ela se pagar.
    clientesQuePagamOPlano: !semValor && ticket ? Math.ceil(PRECO_MENSAL_CENTS / ticket) : null,
    clientesNaOnda: Math.min(TAMANHO_DA_ONDA, d.sumidos),
    previa: d.nomes.map((n) => ({ iniciais: iniciaisDe(n.nome), diasSemVir: n.diasSumido })),
    // Mesma regra do checkout: acima do Corte Honesto, a compra leva a garantia.
    // Quem já teve a dela é tirado em oferta-da-conta.ts, que enxerga o banco.
    comGarantia: !corteHonesto,
    primeiraOnda: null,
  };
}

const clientesSeus = (n: number) =>
  n === 1 ? "1 cliente seu está fora do ritmo" : `${n} clientes seus estão fora do ritmo`;

/** "A mensalidade se paga com N clientes voltando", na língua do dono. */
function ancoraDaVisita(o: Oferta): string | null {
  const n = o.clientesQuePagamOPlano;
  if (!n || !o.ticketMedioCents) return null;
  return (
    `A mensalidade de ${emReais(PRECO_MENSAL_CENTS)} se paga com ${n} ` +
    `${n === 1 ? "cliente voltando" : "clientes voltando"} uma vez ` +
    `(cada cliente seu gasta em média ${emReais(o.ticketMedioCents)} por visita).`
  );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/**
 * O QUE A PRIMEIRA ONDA FEZ, pelas marcações do próprio dono. Sem resposta
 * marcada, a parede diz isso sem drama: resposta costuma chegar depois.
 */
function textosDaPrimeiraOnda(o: Oferta, r: ResultadoDaPrimeiraOnda): TextosSemMoldura {
  const mensagens = plural(r.enviadas, "mensagem enviada", "mensagens enviadas");
  const titulo =
    r.responderam > 0
      ? `Sua primeira Onda: ${mensagens}, ${plural(r.responderam, "cliente respondeu", "clientes responderam")}.`
      : `Sua primeira Onda: ${mensagens}.`;

  const proximas =
    o.sumidos > 0
      ? `Sua lista ainda tem ${plural(o.sumidos, "cliente fora do ritmo", "clientes fora do ritmo")}, ` +
        "e as próximas Ondas saem toda segunda com um plano."
      : "As próximas Ondas saem toda segunda com um plano, quando alguém passar do tempo de voltar.";

  const prova =
    r.recuperadoCents > 0
      ? `${emReais(r.recuperadoCents)} já entraram em Dinheiro recuperado com a primeira Onda. ${proximas}`
      : r.responderam > 0
        ? "Ninguém marcado como volta paga ainda: quando a pessoa vier e pagar, marque em " +
          `Reativar clientes e o valor entra em Dinheiro recuperado. ${proximas}`
        : "Nenhuma resposta marcada ainda. Resposta costuma chegar nos dias seguintes: " +
          `quando chegar, marque em Reativar clientes quem apareceu. ${proximas}`;

  const vezes = r.recuperadoCents / PRECO_MENSAL_CENTS;
  const ancora =
    vezes >= 1
      ? `A primeira Onda já trouxe ${vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ` +
        `vezes a mensalidade de ${emReais(PRECO_MENSAL_CENTS)}.`
      : ancoraDaVisita(o);

  return { titulo, prova, ancora, recomendaNaoAssinar: false };
}

const TEXTO_DA_GARANTIA =
  `Garantia Dinheiro Recuperado: se em ${GARANTIA_DIAS} dias você mandar as mensagens de ` +
  `${ONDAS_MINIMAS} ondas, marcar quem voltou e o dinheiro recuperado não chegar a ` +
  `${emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que você pagou.`;

export function textosDaOferta(o: Oferta): TextosDaOferta {
  const lista = textosDaLista(o);
  const r = o.primeiraOnda;
  // A prova da primeira Onda só entra quando ela saiu. Abaixo do Corte Honesto, a
  // recomendação honesta vence — a não ser que a Onda já tenha pago a mensalidade.
  const usaPrimeiraOnda =
    r !== null &&
    r.enviadas > 0 &&
    (!lista.recomendaNaoAssinar || r.recuperadoCents >= PRECO_MENSAL_CENTS);

  const textos = usaPrimeiraOnda && r ? textosDaPrimeiraOnda(o, r) : lista;
  return {
    ...textos,
    rotulo: textos.recomendaNaoAssinar
      ? "Recomendação honesta"
      : usaPrimeiraOnda
        ? "O que a sua primeira Onda fez"
        : "O que a sua lista mostra",
    garantia: o.comGarantia && !textos.recomendaNaoAssinar ? TEXTO_DA_GARANTIA : null,
  };
}

function textosDaLista(o: Oferta): TextosSemMoldura {
  if (o.semData) {
    return {
      titulo: "Ainda não dá para saber quem parou de voltar.",
      prova:
        "Sua lista não tem a data do último atendimento de cada cliente. Inclua essa " +
        "coluna e o diagnóstico mostra quem está fora do ritmo — sem chute.",
      ancora: null,
      recomendaNaoAssinar: false,
    };
  }

  const cobreMensalidade = !o.semValor && o.sumidos > 0 && o.faixaMinCents >= PRECO_MENSAL_CENTS;

  if (o.corteHonesto && !cobreMensalidade) {
    return {
      titulo: "Pela sua lista, hoje a assinatura não se paga.",
      prova:
        o.sumidos === 0
          ? "Não encontramos clientes fora do ritmo na sua lista. É uma boa notícia, e " +
            "significa que a Nexora não tem o que fazer por você agora."
          : `São ${o.sumidos} ${o.sumidos === 1 ? "cliente" : "clientes"} fora do ritmo e ` +
            `cerca de ${emReais(o.faixaMinCents)} de receita potencial em ${JANELA_DIAS} dias — ` +
            "pouco para justificar a mensalidade. Preferimos dizer isso antes de cobrar.",
      ancora: null,
      recomendaNaoAssinar: true,
    };
  }

  if (o.semValor) {
    return {
      titulo: `${clientesSeus(o.sumidos)}.`,
      prova:
        "Sua lista não traz o valor de cada atendimento, então ainda não dá para dizer " +
        "quanto isso representa em dinheiro. Inclua o valor e a conta sai.",
      ancora: null,
      recomendaNaoAssinar: false,
    };
  }

  return {
    titulo: `${clientesSeus(o.sumidos)}.`,
    prova:
      `Pela sua própria lista, eles representam entre ${emReais(o.faixaMinCents)} e ` +
      `${emReais(o.faixaMaxCents)} em receita potencial nos próximos ${JANELA_DIAS} dias. ` +
      "É estimativa, não é garantia: depende de as mensagens saírem e de quem responder.",
    ancora: ancoraDaVisita(o),
    recomendaNaoAssinar: false,
  };
}
