import { prisma } from "./db";
import { logError } from "./errors";
import { problemaNoGateway } from "./whatsapp/endereco";
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

const avisoDoGateway = globalThis as unknown as { __gatewayAvisado?: boolean };

/**
 * O WhatsApp tem para onde enviar? Checado UMA VEZ, antes do laço.
 *
 * Sem isto, cada conversa elegível chamava `sendWhatsAppText`, que lançava o
 * mesmo erro de configuração, e o catch de dentro do laço gravava uma linha em
 * ErrorLog e imprimia no console — por conversa, a cada 5 minutos, para sempre.
 * Em produção isso encheu o log com a mesma frase repetida dezenas de vezes, o
 * que esconde o primeiro erro de verdade que aparecer.
 *
 * O problema é de configuração, não de conversa: ou vale para todas, ou para
 * nenhuma. Então a rodada inteira é pulada e o aviso sai uma vez por processo.
 */
function gatewayIndisponivel(): string | null {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    return "EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados";
  }
  return problemaNoGateway(process.env.EVOLUTION_API_URL, process.env.NODE_ENV);
}

/** Percorre as empresas com follow-up ativo e envia as mensagens devidas. */
export async function runFollowUps(): Promise<number> {
  const problema = gatewayIndisponivel();
  if (problema) {
    if (!avisoDoGateway.__gatewayAvisado) {
      avisoDoGateway.__gatewayAvisado = true;
      console.warn(`[follow-up] lembretes parados até o WhatsApp ter um servidor fixo: ${problema}`);
    }
    return 0;
  }

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
