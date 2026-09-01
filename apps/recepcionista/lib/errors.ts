import { prisma } from "./db";

/**
 * Registra erro no console e no banco (ErrorLog). Nunca lança — logging não
 * pode derrubar o fluxo de atendimento.
 */
export async function logError(context: string, error: unknown, companyId?: string) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  console.error(`[${context}]`, message);
  try {
    await prisma.errorLog.create({
      data: { context, message, stack, companyId: companyId ?? null },
    });
  } catch (dbError) {
    console.error("[error-log] falha ao gravar log no banco", dbError);
  }
}

/**
 * Log SEM a mensagem do erro.
 *
 * A página do Diagnóstico promete, sem ressalva, que a lista colada não é
 * gravada — e ela é lista de clientes de terceiros, gente que nunca ouviu falar
 * da Nexora. Só que `logError` persiste `error.message`, e mensagem de erro de
 * parsing costuma embutir justamente o trecho que não foi lido. O caminho feliz
 * cumpria a promessa; o caminho de erro a quebrava em silêncio.
 *
 * Aqui fica só a CLASSE do erro e a pilha. Pilha aponta linha de código, nunca
 * valor de variável — dá para depurar sem guardar o dado de ninguém. Perde-se
 * detalhe de diagnóstico de propósito: a promessa vale mais.
 */
export async function logErroSemConteudo(context: string, error: unknown, companyId?: string) {
  const classe = error instanceof Error ? error.constructor.name : typeof error;
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  console.error(`[${context}] ${classe} (mensagem omitida: pode conter dado colado)`);
  try {
    await prisma.errorLog.create({
      data: {
        context,
        message: `${classe} — mensagem omitida para não gravar conteúdo colado`,
        stack,
        companyId: companyId ?? null,
      },
    });
  } catch (dbError) {
    console.error("[error-log] falha ao gravar log no banco", dbError);
  }
}
