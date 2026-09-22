/**
 * OS NÚMEROS DO ATENDENTE VIRTUAL.
 *
 * Moram aqui sozinhos para que a tela, a landing, os Termos e o motor digam o
 * mesmo número. Mudar um deles é mudar aqui — os testes de promessa conferem o
 * resto.
 */

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;

/** Conversas por mês incluídas no plano de R$ 97 (decisão do fundador em 21/09/2026). */
export const TETO_CONVERSAS_MES = 200;

/** A primeira semana por nossa conta, para quem ainda não paga. */
export const SEMANA_GRATIS_DIAS = 7;
export const SEMANA_GRATIS_CONVERSAS = 50;

/** No expediente, o Atendente só entra quando ninguém respondeu neste tempo. */
export const MINUTOS_SEM_RESPOSTA = 5;

/** Respostas por conversa por dia. Protege de conversa em loop com outro robô. */
export const MAX_RESPOSTAS_POR_DIA = 8;

/** O dono respondeu pelo celular: o Atendente fica fora da conversa por este tempo. */
export const JANELA_DO_DONO_MS = 12 * HORA_MS;

/** Uma oferta (serviços ou horários) vale por este tempo; depois, oferece de novo. */
export const VALIDADE_DA_OFERTA_MS = 2 * HORA_MS;

/**
 * Quem escreve "oi", "tudo bem?" e "tem horário amanhã?" em três mensagens
 * recebe uma resposta só, para as três: a mais nova espera este tanto e responde.
 */
export const ESPERA_DA_RAJADA_MS = 2_000;

/** O resgate roda a cada minuto. */
export const INTERVALO_DO_RESGATE_MS = MINUTO_MS;

/**
 * Com a loja fechada, quem responde é o webhook, na hora. O resgate só pega a
 * mensagem que passou desta idade sem resposta — antes disso, o webhook ainda
 * pode estar respondendo, e os dois responderiam juntos.
 */
export const CARENCIA_DO_RESGATE_MS = 2 * MINUTO_MS;

/** Mensagem pendente mais velha que isto não é respondida pelo resgate: já esfriou. */
export const IDADE_MAXIMA_DO_RESGATE_MS = 60 * MINUTO_MS;

/** Antecedência mínima para marcar — a mesma da página pública. */
export const ANTECEDENCIA_MINUTOS = 60;

/** Quantos dias à frente o Atendente procura horário livre. */
export const DIAS_DE_BUSCA = 14;
