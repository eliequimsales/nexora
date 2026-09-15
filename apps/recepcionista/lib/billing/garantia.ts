import { MIN_DIAS_PARA_COBRAR } from "@/lib/recuperacao/desfecho";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { chaveDaSemana } from "@/lib/reengajamento/onda-semanal";
import { emReais, PRECO_MENSAL_CENTS } from "./preco";

/**
 * GARANTIA DINHEIRO RECUPERADO — a regra, pura.
 *
 * Aprovada pelo fundador em 14/09/2026: quem manda as mensagens de 3 ondas nos
 * primeiros 30 dias e não recupera nem R$ 97 recebe de volta tudo o que pagou —
 * a mensalidade, os 30 dias no Pix ou o anual. Vale uma vez por negócio e só para
 * lista acima do Corte Honesto na compra.
 *
 * Por que 30 dias: é o primeiro dia em que a medição é honesta, porque o 4º
 * contato do Protocolo 4 Toques sai no dia 25. Por que a condição de uso: quem não
 * manda as mensagens não prova nada contra a Nexora. E por que não "7 dias": esses
 * já são lei (CDC, art. 49) e não podem ser vendidos como vantagem.
 *
 * Toda decisão devolve uma ação: a Regra Zero vale também para a recusa.
 */

export const GARANTIA_DIAS = 30;
export const PRAZO_PEDIDO_DIAS = 7;
export const ONDAS_MINIMAS = 3;

/**
 * Uma onda conta quando pelo menos metade dela saiu na semana. Uma mensagem por
 * semana não é usar a Nexora; exigir as 12 puniria a semana em que alguns
 * clientes foram pulados de propósito.
 */
export const ENVIOS_POR_ONDA = Math.ceil(TAMANHO_DA_ONDA / 2);

const DIA_MS = 86_400_000;

export type SinaisDaGarantia = {
  /** Início do primeiro período pago contratado com a garantia; null sem compra com garantia. */
  inicio: Date | null;
  /** A lista estava acima do Corte Honesto no checkout que virou pagamento. */
  acimaDoCorte: boolean;
  usadaEm: Date | null;
  ondas: number;
  pendentesSemResposta: number;
  recuperadoCents: number;
};

type AcaoDaGarantia = { texto: string; href: string };

type SemPrazo =
  | "SEM_GARANTIA"
  | "USADA"
  | "PRAZO_VENCIDO"
  | "ABAIXO_DO_CORTE"
  | "SE_PAGOU"
  | "POUCAS_ONDAS"
  | "SEM_RESPOSTA";

export type DecisaoDaGarantia =
  | { devolve: true; situacao: "DISPONIVEL"; motivo: string; acao: AcaoDaGarantia; pedirAte: Date }
  | { devolve: false; situacao: "EM_ANDAMENTO"; motivo: string; acao: AcaoDaGarantia; abreEm: Date }
  | { devolve: false; situacao: SemPrazo; motivo: string; acao: AcaoDaGarantia };

export type SituacaoDaGarantia = DecisaoDaGarantia["situacao"];

const ONDA: AcaoDaGarantia = { texto: "Abrir a onda desta semana", href: "/painel/onda" };

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function avaliarGarantia(s: SinaisDaGarantia, agora: Date): DecisaoDaGarantia {
  if (!s.inicio) {
    return {
      devolve: false,
      situacao: "SEM_GARANTIA",
      motivo: "A garantia acompanha a primeira contratação feita com ela, e esta conta ainda não tem uma.",
      acao: { texto: "Ver os planos", href: "/painel/assinatura" },
    };
  }

  if (s.usadaEm) {
    return {
      devolve: false,
      situacao: "USADA",
      motivo: "A garantia vale uma vez por negócio, e a desta conta já foi usada.",
      acao: { texto: "Exportar minha lista", href: "/painel/clientes/importar" },
    };
  }

  const dia = Math.floor((agora.getTime() - s.inicio.getTime()) / DIA_MS);

  if (dia < GARANTIA_DIAS) {
    return {
      devolve: false,
      situacao: "EM_ANDAMENTO",
      abreEm: new Date(s.inicio.getTime() + GARANTIA_DIAS * DIA_MS),
      motivo:
        `A conta da garantia fecha no dia ${GARANTIA_DIAS}. Até aqui: ` +
        `${Math.min(s.ondas, ONDAS_MINIMAS)} de ${ONDAS_MINIMAS} ondas enviadas.`,
      acao: ONDA,
    };
  }

  if (dia > GARANTIA_DIAS + PRAZO_PEDIDO_DIAS) {
    return {
      devolve: false,
      situacao: "PRAZO_VENCIDO",
      motivo: `O prazo para pedir a garantia terminou no ${GARANTIA_DIAS + PRAZO_PEDIDO_DIAS}º dia da contratação.`,
      acao: ONDA,
    };
  }

  if (!s.acimaDoCorte) {
    return {
      devolve: false,
      situacao: "ABAIXO_DO_CORTE",
      motivo:
        `Na compra, sua lista tinha menos de ${MIN_SUMIDOS} clientes sumidos ou menos de ` +
        `${emReais(MIN_RECUPERAVEL_CENTS)} para recuperar. Nesse tamanho a garantia não vale, ` +
        "e a tela de planos avisava isso antes do pagamento.",
      acao: { texto: "Adicionar mais clientes à lista", href: "/painel/clientes/importar" },
    };
  }

  // Antes das condições de uso: marcar mais respostas só aumenta o que voltou, e
  // mandar quem já passou do valor fazer mais ondas "para ter direito" seria
  // empurrar para um beco.
  if (s.recuperadoCents >= PRECO_MENSAL_CENTS) {
    return {
      devolve: false,
      situacao: "SE_PAGOU",
      motivo:
        `Seu Dinheiro recuperado chegou a ${emReais(s.recuperadoCents)}: a Nexora se pagou. ` +
        `A garantia devolve quando ele não chega a ${emReais(PRECO_MENSAL_CENTS)}.`,
      acao: ONDA,
    };
  }

  if (s.ondas < ONDAS_MINIMAS) {
    return {
      devolve: false,
      situacao: "POUCAS_ONDAS",
      motivo:
        `A garantia pede ${ONDAS_MINIMAS} ondas enviadas nos ${GARANTIA_DIAS} primeiros dias, ` +
        `com pelo menos ${ENVIOS_POR_ONDA} mensagens cada. Foram ${s.ondas}.`,
      acao: ONDA,
    };
  }

  if (s.pendentesSemResposta > 0) {
    const contatos = s.pendentesSemResposta === 1 ? "contato" : "contatos";
    return {
      devolve: false,
      situacao: "SEM_RESPOSTA",
      motivo: `Falta marcar se a pessoa voltou em ${s.pendentesSemResposta} ${contatos}.`,
      acao: { texto: "Marcar quem voltou", href: "/painel/onda" },
    };
  }

  const pedirAte = new Date(s.inicio.getTime() + (GARANTIA_DIAS + PRAZO_PEDIDO_DIAS + 1) * DIA_MS);
  return {
    devolve: true,
    situacao: "DISPONIVEL",
    pedirAte,
    motivo:
      `Você mandou as ${ONDAS_MINIMAS} ondas e o Dinheiro recuperado não chegou a ` +
      `${emReais(PRECO_MENSAL_CENTS)}. Pode pedir a devolução até ` +
      `${dataBR.format(new Date(pedirAte.getTime() - 1))}.`,
    acao: { texto: "Pedir minha garantia", href: "/painel/assinatura#garantia" },
  };
}

/** Semanas dos 30 dias em que saiu pelo menos metade de uma onda. */
export function semanasComOnda(enviosEm: Date[], inicio: Date): number {
  const fim = inicio.getTime() + GARANTIA_DIAS * DIA_MS;
  const porSemana = new Map<string, number>();
  for (const data of enviosEm) {
    const t = data.getTime();
    if (t < inicio.getTime() || t >= fim) continue;
    const semana = chaveDaSemana(data);
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
  }
  return Array.from(porSemana.values()).filter((n) => n >= ENVIOS_POR_ONDA).length;
}

/**
 * Contatos dos 30 dias ainda sem desfecho marcado. Os dos últimos 3 dias não
 * contam: é cedo para saber se a pessoa voltou, e a própria onda só pergunta
 * depois disso (lib/recuperacao/desfecho.ts).
 */
export function pendentesSemResposta(
  toques: { sentAt: Date; outcome: string }[],
  inicio: Date,
  agora: Date,
): number {
  const fim = inicio.getTime() + GARANTIA_DIAS * DIA_MS;
  const cobravelAte = agora.getTime() - MIN_DIAS_PARA_COBRAR * DIA_MS;
  return toques.filter((t) => {
    const enviado = t.sentAt.getTime();
    return (
      t.outcome === "AGUARDANDO" &&
      enviado >= inicio.getTime() &&
      enviado < fim &&
      enviado <= cobravelAte
    );
  }).length;
}

/**
 * Dinheiro recuperado ATRIBUÍDO desde o início até o pedido. Até o pedido, e não
 * só até o dia 30: quem voltou no dia 29 costuma ser marcado dias depois, e deixar
 * para marcar não pode virar direito a devolução.
 */
export function recuperadoNaGarantia(
  entradas: { returnedAt: Date; valueCents: number; attributed: boolean }[],
  inicio: Date,
  agora: Date,
): number {
  return entradas
    .filter(
      (e) =>
        e.attributed &&
        e.returnedAt.getTime() >= inicio.getTime() &&
        e.returnedAt.getTime() <= agora.getTime(),
    )
    .reduce((soma, e) => soma + e.valueCents, 0);
}
