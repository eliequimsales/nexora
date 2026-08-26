import { prisma } from "./db";
import { logError } from "./errors";
import { sendWhatsAppText } from "./whatsapp/evolution";

export interface FollowUpCandidate {
  status: string;
  followUpCount: number;
  maxFollowUps: number;
  delayHours: number;
  lastCustomerMessageAt: Date | null;
  lastFollowUpAt: Date | null;
}

/**
 * Regra pura de elegibilidade (testada em tests/followup.test.ts):
 * só conversas em que a IA atende, cliente sumiu há mais de `delayHours`,
 * dentro do limite de follow-ups e respeitando o intervalo entre eles.
 */
export function isEligibleForFollowUp(candidate: FollowUpCandidate, now: Date = new Date()): boolean {
  if (candidate.status !== "AI") return false;
  if (candidate.followUpCount >= candidate.maxFollowUps) return false;
  if (!candidate.lastCustomerMessageAt) return false;

  const delayMs = candidate.delayHours * 60 * 60 * 1000;
  if (now.getTime() - candidate.lastCustomerMessageAt.getTime() < delayMs) return false;
  if (candidate.lastFollowUpAt && now.getTime() - candidate.lastFollowUpAt.getTime() < delayMs) {
    return false;
  }
  return true;
}

/** Percorre as empresas com follow-up ativo e envia as mensagens devidas. */
export async function runFollowUps(): Promise<number> {
  let sent = 0;

  const profiles = await prisma.companyProfile.findMany({
    where: {
      followUpEnabled: true,
      followUpMessage: { not: "" },
      whatsappInstance: { not: null },
    },
    select: {
      companyId: true,
      whatsappInstance: true,
      followUpDelayHours: true,
      followUpMessage: true,
      maxFollowUps: true,
    },
  });

  const now = new Date();

  for (const profile of profiles) {
    const cutoff = new Date(now.getTime() - profile.followUpDelayHours * 60 * 60 * 1000);
    const conversations = await prisma.conversation.findMany({
      where: {
        companyId: profile.companyId,
        status: "AI",
        followUpCount: { lt: profile.maxFollowUps },
        lastCustomerMessageAt: { lte: cutoff },
      },
      take: 50,
    });

    for (const conversation of conversations) {
      const eligible = isEligibleForFollowUp(
        {
          status: conversation.status,
          followUpCount: conversation.followUpCount,
          maxFollowUps: profile.maxFollowUps,
          delayHours: profile.followUpDelayHours,
          lastCustomerMessageAt: conversation.lastCustomerMessageAt,
          lastFollowUpAt: conversation.lastFollowUpAt,
        },
        now,
      );
      if (!eligible) continue;

      try {
        await sendWhatsAppText(
          profile.whatsappInstance!,
          conversation.customerPhone,
          profile.followUpMessage,
        );
        await prisma.message.create({
          data: { conversationId: conversation.id, role: "AI", content: profile.followUpMessage },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { followUpCount: { increment: 1 }, lastFollowUpAt: now },
        });
        sent += 1;
      } catch (error) {
        await logError("follow-up", error, profile.companyId);
      }
    }
  }

  return sent;
}

const workerFlag = globalThis as unknown as { __followUpWorkerStarted?: boolean };

/** Inicia o worker interno (chamado pelo instrumentation.ts no boot do servidor). */
export function startFollowUpWorker() {
  if (workerFlag.__followUpWorkerStarted) return;
  workerFlag.__followUpWorkerStarted = true;

  const minutes = Math.max(1, parseInt(process.env.FOLLOWUP_INTERVAL_MINUTES ?? "5", 10) || 5);
  console.log(`[follow-up] worker ativo (a cada ${minutes} min)`);

  setInterval(() => {
    runFollowUps().catch((error) => {
      console.error("[follow-up] execução falhou", error);
    });
  }, minutes * 60 * 1000);
}
