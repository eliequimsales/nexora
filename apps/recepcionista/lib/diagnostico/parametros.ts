import { limparCriativo } from "@/lib/funil";
import { SEGMENTOS } from "@/lib/recuperacao/ciclo";

/**
 * O QUE O ANUNCIO PODE PRE-PREENCHER.
 *
 * /diagnostico?ramo=barbearia&ticket=50&c=bar-a1
 *
 * Sem isso, tres coisas quebram de uma vez: o titulo fala generico com um
 * publico especifico ("Barbeiro: voce tem clientes que sumiram" converte
 * diferente de "Voce tem clientes que sumiram"), o dono precisa escolher o ramo
 * a mao logo na primeira tela, e nao da para saber qual criativo trouxe quem --
 * que e o unico jeito barato de decidir onde continuar gastando.
 *
 * TUDO CAI NO PADRAO EM SILENCIO. Valor invalido NUNCA vira erro na cara de
 * trafego frio: quem clicou num anuncio nao vai depurar uma query string, e um
 * erro ali custa o clique inteiro.
 *
 * O ramo e validado contra SEGMENTOS, que e derivado de MEDIANA_POR_SEGMENTO --
 * entao a lista nunca dessincroniza. Isso importa porque se um dentista abrir a
 * landing de barbearia, a mediana errada chama a base inteira dele de sumida.
 */

export type ParametrosDoDiagnostico = {
  ramo: string | null;
  /** Como texto, porque e isso que o campo do formulario espera. */
  ticketReais: string;
  criativo: string | null;
};

/** Mesma faixa do zod da rota: R$ 5 a R$ 5.000. */
const MIN_CENTS = 500;
const MAX_CENTS = 500_000;

function umaString(v: string | string[] | undefined): string | null {
  // Next entrega string[] quando o parametro se repete na URL. Ambiguidade
  // vira padrao, nao a primeira ocorrencia: escolher uma seria adivinhar.
  return typeof v === "string" ? v : null;
}

function lerRamo(bruto: string | string[] | undefined): string | null {
  const v = umaString(bruto)?.trim().toLowerCase();
  if (!v) return null;
  return SEGMENTOS.includes(v) ? v : null;
}

function lerTicket(bruto: string | string[] | undefined): string {
  const v = umaString(bruto)?.trim();
  if (!v) return "";

  const n = Number.parseFloat(v.replace(/[^0-9,.]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";

  const cents = Math.round(n * 100);
  if (cents < MIN_CENTS || cents > MAX_CENTS) return "";

  // Devolve o que ele digitou, e nao o normalizado: "49,90" some da tela e
  // vira "49.9" seria o tipo de detalhe que faz parecer defeito.
  return v;
}

export function lerParametros(
  searchParams: Record<string, string | string[] | undefined>,
): ParametrosDoDiagnostico {
  return {
    ramo: lerRamo(searchParams.ramo),
    ticketReais: lerTicket(searchParams.ticket),
    criativo: limparCriativo(umaString(searchParams.c)),
  };
}
