import { prisma } from "@/lib/db";
import { RETENCAO_DIAS } from "@/lib/funil";

/**
 * A PODA DA TABELA DE EVENTOS.
 *
 * O teto global de `/api/funil` impede o pico; sem esta poda ele só adia o
 * problema, porque o crescimento normal também nao para nunca.
 *
 * Roda no cron diario que ja existe e ja e protegido por CRON_SECRET. Apaga em
 * lote, com teto por execucao: um DELETE sem limite numa tabela que cresceu
 * demais segura o banco inteiro por minutos -- e a rota que grava evento
 * ficaria esperando junto.
 */

/** Teto por execucao. Sobra fica para o dia seguinte, e tudo bem. */
const LOTE = 50_000;

export async function podarEventos(agora: Date = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - RETENCAO_DIAS * 86_400_000);

  const velhos = await prisma.eventoFunil.findMany({
    where: { criadoEm: { lt: limite } },
    select: { id: true },
    take: LOTE,
  });

  if (velhos.length === 0) return 0;

  const { count } = await prisma.eventoFunil.deleteMany({
    where: { id: { in: velhos.map((e) => e.id) } },
  });

  return count;
}
