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
