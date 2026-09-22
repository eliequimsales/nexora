import { prisma } from "./db";
import { logError } from "./errors";
import { atender } from "./atendente/executar";
import { pediuParaParar } from "./recuperacao/optout";
import { variantesDeTelefone } from "./recuperacao/telefone";
import type { IncomingWhatsAppMessage } from "./whatsapp/evolution";
import { enviarWhatsApp } from "./whatsapp/envio";

/** Log simples de latência (debug): caminho + marcos + total até a resposta sair. */
function logTiming(path: string, startedAt: number, marks: Record<string, number> = {}) {
  const parts = Object.entries(marks)
    .map(([key, value]) => `${key}=${value}ms`)
    .join(" ");
  console.log(`[timing] caminho=${path} ${parts} total=${Date.now() - startedAt}ms`.replace("  ", " "));
}

async function saveOutgoing(conversationId: string, content: string) {
  await prisma.message.create({ data: { conversationId, role: "AI", content } });
}

/**
 * Resposta ao pedido de parar. Curta e sem tentativa de retenção: quem pediu
 * para sair não quer negociar, e insistir aqui é o comportamento que faz o
 * cliente bloquear o número da barbearia.
 */
const CONFIRMACAO_DESCADASTRO =
  "Pronto, não te mando mais mensagem de retorno. " +
  "Se um dia quiser marcar um horário, é só chamar aqui que eu te atendo normalmente.";

/**
 * Fluxo principal:
 * webhook → identifica a empresa pela conexão → salva a mensagem → honra o
 * pedido de parar → o Atendente Virtual decide se e quando responde
 * (lib/atendente/executar.ts).
 */
export async function handleIncomingMessage(incoming: IncomingWhatsAppMessage): Promise<void> {
  const startedAt = Date.now();

  // 1. Identifica a empresa dona do número
  const profile = await prisma.companyProfile.findUnique({
    where: { whatsappInstance: incoming.instance },
    select: { companyId: true },
  });
  if (!profile) {
    await logError("webhook", new Error(`Instância desconhecida: ${incoming.instance}`));
    return;
  }
  const companyId = profile.companyId;

  try {
    // 2. Dedupe de retries do webhook — chave com escopo da instância, para que
    // ids iguais vindos de números diferentes nunca colidam entre empresas
    const dedupeKey = incoming.messageId ? `${incoming.instance}:${incoming.messageId}` : null;
    if (dedupeKey) {
      const existing = await prisma.message.findUnique({
        where: { whatsappMessageId: dedupeKey },
        select: { id: true },
      });
      if (existing) return;
    }

    // 3. Localiza ou cria a conversa
    const now = new Date();
    let conversation = await prisma.conversation.findUnique({
      where: { companyId_customerPhone: { companyId, customerPhone: incoming.phone } },
    });

    const wasFinished = conversation?.status === "FINISHED";

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          companyId,
          customerPhone: incoming.phone,
          customerName: incoming.senderName,
          lastCustomerMessageAt: now,
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastCustomerMessageAt: now,
          customerName: conversation.customerName ?? incoming.senderName,
          // Cliente voltou depois de finalizada: reabre um novo ciclo com o Atendente
          ...(wasFinished ? { status: "AI" as const, followUpCount: 0 } : {}),
        },
      });
    }

    // 4. Salva a mensagem do cliente (tudo fica registrado, sempre)
    try {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "CUSTOMER",
          content: incoming.text,
          whatsappMessageId: dedupeKey,
        },
      });
    } catch (error) {
      // Duas entregas simultâneas do mesmo webhook: a segunda perde a corrida
      // no índice único e deve encerrar em silêncio (não é erro real)
      if ((error as { code?: string }).code === "P2002") return;
      throw error;
    }

    // 4.5 PEDIDO DE DESCADASTRO.
    //
    // Vem ANTES de tudo — inclusive antes do silêncio por atendimento humano —
    // porque isto não é preferência de atendimento, é revogação de
    // consentimento: a LGPD manda honrar independente de quem está na conversa.
    //
    // O `in` com as variantes existe porque a planilha do dono guarda
    // "11988881234" e o WhatsApp entrega "5511988881234". Comparar direto
    // acharia zero e não reclamaria.
    //
    // Opt-out barra a mensagem que a Nexora MANDA (a Onda), não a conversa que
    // o cliente inicia. Ele continua podendo chamar para marcar horário — por
    // isso a confirmação diz exatamente isso, e nada é bloqueado aqui.
    if (pediuParaParar(incoming.text)) {
      await prisma.customer.updateMany({
        where: {
          companyId,
          phone: { in: variantesDeTelefone(incoming.phone) },
          optOut: false,
        },
        data: { optOut: true, optOutAt: now },
      });

      if (conversation.status !== "HUMAN" && conversation.status !== "WAITING_HUMAN") {
        await enviarWhatsApp(incoming.instance, incoming.phone, CONFIRMACAO_DESCADASTRO);
        await saveOutgoing(conversation.id, CONFIRMACAO_DESCADASTRO);
      }
      logTiming("descadastro", startedAt);
      return;
    }

    // 5. O ATENDENTE VIRTUAL.
    //
    // Nada responde sozinho sem o dono ligar o Atendente. Ligado, ele responde
    // na hora com a loja fechada; no expediente, só depois de 5 minutos sem
    // resposta (quem responde então é o resgate de cada minuto). Resposta do
    // dono pelo celular o cala na conversa. A mensagem do cliente já foi salva
    // acima: silêncio não é perder o que ele escreveu.
    const resultado = await atender({ companyId, conversationId: conversation.id, origem: "WEBHOOK" });
    logTiming(
      resultado.acao === "SILENCIO" ? `silencio-${resultado.motivo.toLowerCase()}` : resultado.acao.toLowerCase(),
      startedAt,
    );
  } catch (error) {
    await logError("conversation-service", error, companyId);
  }
}
