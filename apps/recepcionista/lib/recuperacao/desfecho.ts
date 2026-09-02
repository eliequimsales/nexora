import { JANELA_DIAS } from "./atribuicao";

/**
 * O DESFECHO ESTAVA SENDO PERDIDO NA ORIGEM.
 *
 * O botão "Enviei" da Onda gravava `SEM_RESPOSTA` — um desfecho FINAL, no
 * exato instante em que o dono copia a mensagem. O cliente ainda nem recebeu.
 *
 * Na prática: ele manda na segunda, marca "Enviei", o cliente aparece na
 * quinta, e esse retorno nunca entra no Livro-Caixa. A North Star do produto
 * estava sendo sistematicamente subestimada pelo próprio produto — e o número
 * subestimado é justamente o que prova ao dono que a Nexora vale R$ 97.
 *
 * O conserto tem duas metades e nenhuma funciona sozinha:
 *   1. "Enviei" passa a significar AGUARDANDO, que é a verdade.
 *   2. A Onda pergunta, na semana seguinte, quem apareceu.
 *
 * Sem a segunda metade, tudo vira AGUARDANDO para sempre e o Livro-Caixa fica
 * ainda mais vazio do que estava.
 */

/** Desfechos FINAIS. AGUARDANDO não está aqui de propósito: é estado, não desfecho. */
export const DESFECHOS = ["VOLTOU", "MARCOU", "RESPONDEU", "SEM_RESPOSTA", "PULADO"] as const;

export type Desfecho = (typeof DESFECHOS)[number];

/**
 * Três dias antes de cobrar resposta.
 *
 * Perguntar no dia seguinte é cobrar o dono por algo que ainda vai acontecer, e
 * ensina que a pergunta pode ser ignorada — que é o pior hábito possível para
 * o dado do qual o Livro-Caixa depende.
 */
export const MIN_DIAS_PARA_COBRAR = 3;

/**
 * Depois da janela de atribuição, a resposta não muda mais o Livro-Caixa
 * (ver lib/recuperacao/atribuicao.ts), e continuar cobrando transforma a tela
 * numa lista de tarefas que nunca esvazia.
 */
export const MAX_DIAS_PARA_COBRAR = JANELA_DIAS;

/** No máximo dez por vez: cobrança sem fim vira ruído e o dono para de ler. */
const TETO = 10;

export type ToquePendente = {
  id: string;
  clienteId: string;
  nome: string;
  toqueNumero: number;
  esteira: string;
  ticketMedioCents: number;
  enviadoEm: Date;
};

export function vencidosParaPerguntar(
  pendentes: ToquePendente[],
  agora: Date = new Date(),
): ToquePendente[] {
  const dias = (t: ToquePendente) =>
    Math.floor((agora.getTime() - t.enviadoEm.getTime()) / 86_400_000);

  return pendentes
    .filter((t) => {
      const d = dias(t);
      return d >= MIN_DIAS_PARA_COBRAR && d <= MAX_DIAS_PARA_COBRAR;
    })
    // Mais antigo primeiro: é o que está mais perto de sair da janela de
    // atribuição, ou seja, o que a gente está prestes a perder para sempre.
    .sort((a, b) => a.enviadoEm.getTime() - b.enviadoEm.getTime())
    .slice(0, TETO);
}
