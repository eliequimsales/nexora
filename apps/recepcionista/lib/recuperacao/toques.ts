/**
 * PROTOCOLO 4 TOQUES
 *
 * Quatro a cinco tentativas recuperam cerca de 81% a mais que uma tentativa só.
 * Quase todo mundo — inclusive a primeira versão da Nexora — manda UMA mensagem
 * e desiste. O sistema guarda em qual toque cada cliente está e coloca o
 * follow-up vencido na frente da onda seguinte.
 *
 * Os quatro toques têm ÂNGULOS diferentes, nunca a mesma mensagem repetida:
 *
 *   1  D0    leve, só percebeu a ausência, sem oferta e sem desconto
 *   2  D+4   horário concreto reservado — o compromisso fica fácil de aceitar
 *   3  D+11  motivo novo verdadeiro: agora dá para marcar sozinho pelo link
 *   4  D+25  despedida honesta com saída explícita (exigência de CDC/LGPD)
 *
 * A sequência PARA na hora em que houver qualquer resposta, agendamento ou
 * pedido de saída. Nunca vira perseguição.
 */

export const INTERVALOS_TOQUES = [0, 4, 11, 25] as const;

export const TOTAL_TOQUES = INTERVALOS_TOQUES.length;

const DIA_MS = 24 * 60 * 60 * 1000;

export type ToqueEnviado = { touchNumber: number; sentAt: Date };

export type ProximoToque = {
  numero: number;
  /** Quando esse toque deveria sair. */
  venceEm: Date;
  /** Já passou da data — entra na frente da onda desta semana. */
  vencido: boolean;
};

export function proximoToque(
  enviados: ToqueEnviado[],
  hoje: Date,
): ProximoToque | null {
  if (enviados.length === 0) {
    return { numero: 1, venceEm: hoje, vencido: true };
  }

  const ultimo = [...enviados].sort((a, b) => b.touchNumber - a.touchNumber)[0];
  const proximoNumero = ultimo.touchNumber + 1;

  if (proximoNumero > TOTAL_TOQUES) return null;

  const primeiro = [...enviados].sort((a, b) => a.touchNumber - b.touchNumber)[0];
  const offsetDias = INTERVALOS_TOQUES[proximoNumero - 1];
  const venceEm = new Date(primeiro.sentAt.getTime() + offsetDias * DIA_MS);

  return { numero: proximoNumero, venceEm, vencido: venceEm.getTime() <= hoje.getTime() };
}

export type ContextoMensagem = {
  primeiroNome: string;
  negocio: string;
  link: string;
  /** Sugestão de horário concreto para o toque 2, ex.: "quinta às 15h". */
  horarioSugerido?: string;
};

/**
 * Base de planilha vem suja: linha sem nome, empresa sem nome fantasia.
 * Interpolar direto produzia "Oi, !" e "Aqui é da ." — erro que o dono só
 * descobre depois de já ter mandado para o cliente dele.
 */
function vocativo(nome: string): string {
  return nome ? `${nome}, ` : "";
}

export function mensagemDoToque(numero: number, ctx: ContextoMensagem): string {
  const { link, horarioSugerido = "essa semana" } = ctx;
  const primeiroNome = (ctx.primeiroNome ?? "").trim();
  const negocio = (ctx.negocio ?? "").trim();
  const chamado = vocativo(primeiroNome);

  switch (numero) {
    case 1: {
      const abertura = primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!";
      const quem = negocio ? ` Aqui é da ${negocio}.` : "";
      return `${abertura}${quem} Passei os olhos na agenda e vi que faz um tempo que você não aparece por aqui. Tá tudo certo por aí?\n\nSe quiser, eu te encaixo essa semana.`;
    }

    case 2:
      return `${chamado}separei ${horarioSugerido} pra você. Se não der nesse horário, me fala qual dia é melhor que eu ajeito.\n\nSe preferir escolher sozinho, dá pra marcar por aqui: ${link}`;

    case 3:
      return `${chamado}agora dá pra marcar direto por aqui, sem precisar me chamar e esperar resposta: ${link}\n\nDá uma olhada nos horários da semana que vem, tem uns bons livres.`;

    case 4:
      return `${chamado}é a última vez que te chamo pra não virar chatice.\n\nSe um dia quiser voltar, é só me mandar mensagem ou usar ${link} — você é sempre bem-vindo. E se preferir que eu não te mande mais nada, responde "parar" que eu tiro seu número da lista na hora.\n\nValeu por ter sido meu cliente.`;

    default:
      throw new Error(`Toque ${numero} não existe — o protocolo tem ${TOTAL_TOQUES} toques.`);
  }
}
