import type { CompanyProfile, Conversation } from "@nexora/recepcionista-prisma";
import { prisma } from "./db";
import { logError } from "./errors";
import { matchesHandoffKeyword } from "./ai/handoff";
import { buildSystemPrompt, getLocalTime, isOpenNow } from "./ai/prompt";
import { generateReceptionistReply, type HistoryMessage } from "./ai/provider";
import { DEFAULT_HANDOFF_TERMS, matchQuickReply } from "./ai/quick-reply";
import { asSegments, getApprovedKnowledge, recordKnowledgeGap } from "./training";
import { slugifySegment, type SegmentTopic } from "./segments";
import { pediuParaParar } from "./recuperacao/optout";
import { variantesDeTelefone } from "./recuperacao/telefone";
import { sendWhatsAppText, type IncomingWhatsAppMessage } from "./whatsapp/evolution";
import type { BusinessHour, Faq } from "./validation";

const TRANSFER_MESSAGE = "Claro, vou chamar nossa equipe para continuar seu atendimento.";
const FALLBACK_MESSAGE = "Vou encaminhar para nossa equipe te ajudar melhor. 🙏";

/** Log simples de latência (debug): caminho + marcos + total até a resposta sair. */
function logTiming(path: string, startedAt: number, marks: Record<string, number> = {}) {
  const parts = Object.entries(marks)
    .map(([key, value]) => `${key}=${value}ms`)
    .join(" ");
  console.log(`[timing] caminho=${path} ${parts} total=${Date.now() - startedAt}ms`.replace("  ", " "));
}

function asBusinessHours(value: unknown): BusinessHour[] {
  return Array.isArray(value) ? (value as BusinessHour[]) : [];
}

function asFaqs(value: unknown): Faq[] {
  return Array.isArray(value) ? (value as Faq[]) : [];
}

function asKeywords(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]).filter((k) => typeof k === "string") : [];
}

async function saveOutgoing(conversationId: string, content: string, role: "AI" | "SYSTEM" = "AI") {
  await prisma.message.create({ data: { conversationId, role, content } });
}

/**
 * Fluxo principal (item 12 da spec):
 * webhook → identifica empresa pela instância → salva mensagem → decide
 * (humano atendendo? gatilho de handoff?) → IA gera resposta com base no
 * cadastro → envia pelo WhatsApp → salva tudo → atualiza status/lead.
 */
/**
 * Resposta ao pedido de parar. Curta e sem tentativa de retenção: quem pediu
 * para sair não quer negociar, e insistir aqui é o comportamento que faz o
 * cliente bloquear o número da barbearia.
 */
const CONFIRMACAO_DESCADASTRO =
  "Pronto, não te mando mais mensagem de retorno. " +
  "Se um dia quiser marcar um horário, é só chamar aqui que eu te atendo normalmente.";

export async function handleIncomingMessage(incoming: IncomingWhatsAppMessage): Promise<void> {
  const startedAt = Date.now();

  // 1. Identifica a empresa dona do número
  const profile = await prisma.companyProfile.findUnique({
    where: { whatsappInstance: incoming.instance },
    include: { company: true },
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

    const isFirstMessage = !conversation;
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
          // Cliente voltou depois de finalizada: reabre um novo ciclo com a IA
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
        await sendWhatsAppText(incoming.instance, incoming.phone, CONFIRMACAO_DESCADASTRO);
        await saveOutgoing(conversation.id, CONFIRMACAO_DESCADASTRO);
      }
      logTiming("descadastro", startedAt);
      return;
    }

    // 5. Equipe atendendo (ou aguardando equipe): o Atendente fica em silêncio
    if (conversation.status === "HUMAN" || conversation.status === "WAITING_HUMAN") return;

    // 6. Handoff sem IA: termos padrão (atendente, humano, suporte...) + os da empresa
    const handoffTerms = [...DEFAULT_HANDOFF_TERMS, ...asKeywords(profile.handoffKeywords)];
    if (matchesHandoffKeyword(incoming.text, handoffTerms)) {
      await sendWhatsAppText(incoming.instance, incoming.phone, TRANSFER_MESSAGE);
      await saveOutgoing(conversation.id, TRANSFER_MESSAGE);
      await requestHuman(conversation.id, "Cliente pediu atendimento da equipe");
      logTiming("handoff", startedAt);
      return;
    }

    // 7. Resposta direta do cadastro, sem IA (saudação, horário, endereço, pagamento)
    const quickReply = matchQuickReply(incoming.text, {
      companyName: profile.company.name,
      greetingMessage: profile.greetingMessage,
      businessHours: asBusinessHours(profile.businessHours),
      address: profile.address,
      paymentMethods: profile.paymentMethods,
      isFirstMessage: isFirstMessage || wasFinished,
    });
    if (quickReply) {
      await sendWhatsAppText(incoming.instance, incoming.phone, quickReply);
      await saveOutgoing(conversation.id, quickReply);
      logTiming("cadastro", startedAt);
      return;
    }

    // 8. O Atendente gera e envia a resposta via IA
    await respondWithAi(profile, conversation, incoming, isFirstMessage || wasFinished, startedAt);
  } catch (error) {
    await logError("conversation-service", error, companyId);
  }
}

async function respondWithAi(
  profile: CompanyProfile & { company: { name: string } },
  conversation: Conversation,
  incoming: IncomingWhatsAppMessage,
  isFirstMessage: boolean,
  startedAt: number,
): Promise<void> {
  try {
    const [history, approvedKnowledge, segmentTemplate] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: 60,
        select: { role: true, content: true },
      }),
      // NALS: só conhecimento APROVADO pela empresa entra no contexto
      getApprovedKnowledge(conversation.companyId),
      // KUS: vocabulário das áreas escolhidas pela empresa (só templates JÁ
      // existentes — nunca gerar nada durante uma conversa de cliente)
      prisma.segmentTemplate.findMany({
        where: { slug: { in: asSegments(profile.segments).map(slugifySegment) } },
      }),
    ]);

    const businessHours = asBusinessHours(profile.businessHours);
    const systemPrompt = buildSystemPrompt({
      companyName: profile.company.name,
      description: profile.description,
      address: profile.address,
      productsServices: profile.productsServices,
      pricingInfo: profile.pricingInfo,
      paymentMethods: profile.paymentMethods,
      serviceRules: profile.serviceRules,
      aiTone: profile.aiTone,
      greetingMessage: profile.greetingMessage,
      awayMessage: profile.awayMessage,
      businessHours,
      faqs: asFaqs(profile.faqs),
      approvedKnowledge,
      segments: asSegments(profile.segments),
      segmentTopics: segmentTemplate.length
        ? segmentTemplate
            .flatMap((t) => (t.topics as unknown as SegmentTopic[]).map((topic) => topic.topic))
            .slice(0, 20)
        : undefined,
      isOpen: isOpenNow(businessHours),
      isFirstMessage,
      localTimeFormatted: getLocalTime().formatted,
    });

    const preAiAt = Date.now();
    const result = await generateReceptionistReply({
      systemPrompt,
      history: history as HistoryMessage[],
    });
    const aiDoneAt = Date.now();

    // NALS: se o Atendente decidiu encaminhar, registra a lacuna JÁ —
    // o sinal de conhecimento não pode depender de o envio funcionar
    if (result.transferir_humano) {
      await recordKnowledgeGap(conversation.companyId, incoming.text, result.motivo_transferencia);
    }

    await sendWhatsAppText(incoming.instance, incoming.phone, result.resposta);
    await saveOutgoing(conversation.id, result.resposta);
    logTiming("ia", startedAt, {
      pre: preAiAt - startedAt,
      ia: aiDoneAt - preAiAt,
      envio: Date.now() - aiDoneAt,
    });

    if (result.nome_cliente) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { customerName: result.nome_cliente },
      });
      await prisma.lead.upsert({
        where: { conversationId: conversation.id },
        create: {
          companyId: conversation.companyId,
          conversationId: conversation.id,
          name: result.nome_cliente,
          phone: conversation.customerPhone,
          interest: result.interesse || null,
        },
        update: {
          name: result.nome_cliente,
          ...(result.interesse ? { interest: result.interesse } : {}),
        },
      });
    }

    if (result.transferir_humano) {
      await requestHuman(
        conversation.id,
        result.motivo_transferencia || "Atendente encaminhou para a equipe",
      );
    }
  } catch (error) {
    await logError("ai-reply", error, conversation.companyId);
    // Degradação honesta: avisa o cliente e chama a equipe em vez de deixar no vácuo
    try {
      await sendWhatsAppText(incoming.instance, incoming.phone, FALLBACK_MESSAGE);
      await saveOutgoing(conversation.id, FALLBACK_MESSAGE);
    } catch (sendError) {
      await logError("ai-reply-fallback", sendError, conversation.companyId);
    }
    await requestHuman(conversation.id, "Falha ao gerar resposta da IA");
  }
}

async function requestHuman(conversationId: string, reason: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "WAITING_HUMAN" },
  });
  await saveOutgoing(conversationId, `Transferido para atendimento humano — ${reason}`, "SYSTEM");
}
