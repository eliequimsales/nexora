import { limparCriativo } from "@/lib/funil";
import { MEDIANA_POR_SEGMENTO, medianaDoSegmento, SEGMENTOS } from "@/lib/recuperacao/ciclo";
import { abaixoDoCorte, faixaRecuperavel, visitasNaJanela } from "@/lib/recuperacao/estimativa";

/**
 * A CONTA DA CALCULADORA DA HOME.
 *
 * Três números que o visitante digita e a mesma fórmula do diagnóstico
 * (lib/recuperacao/estimativa.ts). A única suposição a mais é o ritmo: sem saber
 * o ramo, a calculadora usa o padrão do próprio diagnóstico; numa página de ramo,
 * como /barbearia, usa o ritmo daquele ramo — o mesmo que o diagnóstico vai usar
 * quando a pessoa clicar. E a tela diz qual ritmo entrou na conta.
 *
 * Funções puras: o componente só desenha. Assim a conta é testada sem React.
 */

export const FATIAS = [0.2, 0.3, 0.4] as const;
export type Fatia = (typeof FATIAS)[number];

/** O que a calculadora mostra antes de o visitante digitar. A tela diz que é exemplo. */
export const EXEMPLO: { clientes: number; ticketReais: number; fatia: Fatia } = {
  clientes: 400,
  ticketReais: 150,
  fatia: 0.3,
};

/** O ritmo que a calculadora assume: o padrão do diagnóstico para quem não informou o ramo. */
export const CICLO_DA_CALCULADORA = MEDIANA_POR_SEGMENTO.padrao;

export const MAX_CLIENTES = 1_000_000;
export const MAX_TICKET_REAIS = 100_000;

/** A mesma faixa de lib/diagnostico/parametros.ts: R$ 5 a R$ 5.000. */
const TICKET_MIN_NO_LINK = 5;
const TICKET_MAX_NO_LINK = 5_000;

/** Só dígitos, dentro do teto. Campo vazio ou texto vale 0. */
export function lerInteiro(bruto: string, maximo: number): number {
  const n = Number(bruto.replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, maximo);
}

export type ContaDaCalculadora = {
  parados: number;
  umaVisitaCents: number;
  /** O ritmo, em dias, que entrou na conta: o do ramo ou o padrão do diagnóstico. */
  ciclo: number;
  visitas: number;
  potencialCents: number;
  faixa: { min: number; central: number; max: number };
  abaixoDoCorte: boolean;
};

export function contaDaCalculadora(entrada: {
  clientes: number;
  ticketReais: number;
  fatia: number;
  ramo?: string | null;
}): ContaDaCalculadora {
  const clientes = Math.max(0, Math.floor(entrada.clientes));
  const ticketCents = Math.max(0, Math.round(entrada.ticketReais * 100));
  const parados = Math.round(clientes * entrada.fatia);
  const umaVisitaCents = parados * ticketCents;
  const ciclo = entrada.ramo ? medianaDoSegmento(entrada.ramo) : CICLO_DA_CALCULADORA;
  const visitas = visitasNaJanela(ciclo);
  const potencialCents = umaVisitaCents * visitas;
  const faixa = faixaRecuperavel(potencialCents);
  return {
    parados,
    umaVisitaCents,
    ciclo,
    visitas,
    potencialCents,
    faixa,
    // Com campo vazio não há conta. Dizer "não compensa" para quem ainda não
    // digitou seria recusar a venda por falta de dado, e não de oportunidade.
    abaixoDoCorte: clientes > 0 && ticketCents > 0 && abaixoDoCorte(parados, faixa.min),
  };
}

/**
 * O botão leva ao diagnóstico só o que ele sabe usar: o ramo, o ticket e o
 * criativo do anúncio. Número de clientes e percentual ficam na tela — URL vai
 * para o histórico do navegador, e o diagnóstico não precisa deles.
 */
export function linkDoDiagnostico(entrada: {
  ticketReais: number;
  criativo: string | null;
  ramo?: string | null;
}): string {
  const params = new URLSearchParams();
  // Só ramo que o diagnóstico conhece: um ramo inventado na URL cairia no padrão
  // lá, e a página de ramo mostraria uma conta que o diagnóstico não repete.
  if (entrada.ramo && SEGMENTOS.includes(entrada.ramo)) params.set("ramo", entrada.ramo);
  const ticket = Math.round(entrada.ticketReais);
  if (Number.isFinite(ticket) && ticket >= TICKET_MIN_NO_LINK && ticket <= TICKET_MAX_NO_LINK) {
    params.set("ticket", String(ticket));
  }
  const criativo = limparCriativo(entrada.criativo);
  if (criativo) params.set("c", criativo);
  const query = params.toString();
  return query ? `/diagnostico?${query}` : "/diagnostico";
}
