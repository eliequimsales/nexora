import { prisma } from "@/lib/db";
import { relogioParaGravar } from "./relogio";

/**
 * Garante que a conta tem prazo antes de alguém decidir o estado dela.
 *
 * Conta criada antes do relógio nunca passou pelo cadastro que grava prazo. A
 * primeira leitura grava — com os dias de aviso — e as seguintes só leem. Conta
 * que aceitou Termos sem teste grátis não ganha prazo nenhum: fica em GRATIS.
 *
 * O filtro com `subscriptionStatus: null` e `trialEndsAt: null` torna a escrita
 * idempotente e segura contra corrida: duas requisições ao mesmo tempo gravam
 * uma vez só, e nenhuma sobrescreve o prazo que a Stripe tenha escrito no meio.
 *
 * Fica fora de guarda.ts de propósito: quem importa daqui (a régua, a tela da
 * conta) não precisa arrastar `next/server` junto.
 */
export async function garantirRelogio(
  empresa: {
    id: string;
    subscriptionStatus: string | null;
    trialEndsAt: Date | null;
    createdAt: Date;
    termosVersao: string | null;
  },
  agora: Date,
): Promise<Date | null> {
  const prazo = relogioParaGravar(empresa, agora);
  if (!prazo) return empresa.trialEndsAt;

  const { count } = await prisma.company.updateMany({
    where: { id: empresa.id, subscriptionStatus: null, trialEndsAt: null },
    data: { trialEndsAt: prazo },
  });
  if (count > 0) return prazo;

  // Alguém gravou primeiro. Vale o que está no banco, não o que calculamos.
  const atual = await prisma.company.findUnique({
    where: { id: empresa.id },
    select: { trialEndsAt: true },
  });
  return atual?.trialEndsAt ?? prazo;
}
