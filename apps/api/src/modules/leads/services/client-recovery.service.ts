import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { assertSameTenant } from '../../../common/tenant/assert-same-tenant';
import { LlmService } from '../../ai-actions/llm.service';
import { ZapiWhatsappProvider } from '../../assistente-financeiro/providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../../assistente-financeiro/providers/resend-email.provider';
import type { TenantContext } from '../../../common/tenant/tenant-context';
import type {
  MessageDeliveryProvider,
  DeliveryResult,
} from '../../assistente-financeiro/providers/message-delivery-provider.interface';

/** Outbound channel used to deliver the AI-generated recovery message. */
export type RecoveryChannel = 'whatsapp' | 'email';

/**
 * Result returned to the controller after a recovery attempt.
 *
 * The activity log entry is always persisted (success or failure), so the
 * frontend can rely on the `success` flag plus `error` for user feedback
 * and on the backend for analytics / audit.
 */
export interface RecoveryResult {
  success: boolean;
  leadId: string;
  channel: RecoveryChannel;
  message: string;
  sentTo: string;
  externalId?: string;
  error?: string;
}

/**
 * ClientRecoveryService
 *
 * Closes the loop of the Nexora "recover inactive clients" feature:
 *   1. Pick the lead by id (tenant-scoped).
 *   2. Auto-detect the delivery channel (whatsapp if the lead has a phone,
 *      otherwise email) — caller may override.
 *   3. Ask the LLM to generate an empathetic, short Brazilian-Portuguese
 *      message tailored to a barbershop client.
 *   4. Push the message through the existing channel-specific provider
 *      (`ZapiWhatsappProvider` for WhatsApp, `ResendEmailProvider` for email).
 *   5. Record the attempt in `ActivityLog` (even on failure) so the customer
 *      always sees what happened on the timeline.
 *   6. On success, bump `followUpCount` — touching `updatedAt` also makes the
 *      client exit the inactive list automatically.
 *
 * The service intentionally keeps the LLM prompt small and deterministic so it
 * works under both `LLM_PROVIDER=mock` (used in tests/dev) and the real
 * Anthropic backend.
 */
@Injectable()
export class ClientRecoveryService {
  private readonly logger = new Logger(ClientRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly whatsappProvider: ZapiWhatsappProvider,
    private readonly emailProvider: ResendEmailProvider,
  ) {}

  /**
   * Generates the recovery message via LLM and dispatches it through the
   * appropriate channel.
   *
   * @throws NotFoundException when the lead does not exist OR belongs to a
   *   different tenant (we hide existence cross-tenant).
   * @throws BadRequestException when the requested channel is missing its
   *   recipient field on the lead (e.g. whatsapp without phone).
   */
  async recover(
    leadId: string,
    ctx: TenantContext,
    channel?: RecoveryChannel,
  ): Promise<RecoveryResult> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Cliente não encontrado');
    }
    assertSameTenant(lead.orgId, ctx.orgId);

    const targetChannel: RecoveryChannel =
      channel ?? (lead.phone ? 'whatsapp' : 'email');
    const recipient =
      targetChannel === 'whatsapp' ? lead.phone : lead.email;
    if (!recipient) {
      throw new BadRequestException(
        targetChannel === 'whatsapp'
          ? 'Cliente não tem telefone cadastrado'
          : 'Cliente não tem email cadastrado',
      );
    }

    const daysSinceLast = Math.max(
      0,
      Math.floor(
        (Date.now() - lead.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const prompt = this.buildPrompt(lead.name, daysSinceLast, targetChannel);

    // 200 tokens é suficiente para WhatsApp curto / email pequeno
    const llmResult = await this.llm.call(prompt, 200);
    const message = llmResult.content.trim();

    const provider: MessageDeliveryProvider =
      targetChannel === 'whatsapp' ? this.whatsappProvider : this.emailProvider;

    let sendResult: DeliveryResult;
    try {
      sendResult = await provider.send({
        recipient,
        message,
        subject:
          targetChannel === 'email'
            ? `${lead.name}, sentimos sua falta!`
            : undefined,
      });
    } catch (err: any) {
      // Provider lançou — convertemos em DeliveryResult para sempre logar a tentativa
      this.logger.error(
        `Provider ${targetChannel} threw for lead ${lead.id}: ${err?.message}`,
      );
      sendResult = {
        success: false,
        status: 'failed',
        error: err?.message ?? 'unknown_provider_error',
        retryable: false,
      };
    }

    // Sempre registra a tentativa — sucesso ou falha
    await this.prisma.activityLog.create({
      data: {
        orgId: ctx.orgId,
        leadId: lead.id,
        userId: ctx.userId,
        type: 'recovery_sent',
        content: `Mensagem de recuperação ${
          sendResult.success ? 'enviada' : 'tentada'
        } via ${targetChannel}`,
        metadata: {
          channel: targetChannel,
          recipient,
          message,
          success: sendResult.success,
          externalId: sendResult.externalId ?? null,
          error: sendResult.error ?? null,
        },
      },
    });

    // Em sucesso: incrementa followUpCount (e o `updatedAt` da @updatedAt do Prisma
    // muda junto, então o cliente sai da lista de inativos automaticamente)
    if (sendResult.success) {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { followUpCount: { increment: 1 } },
      });
    }

    return {
      success: sendResult.success,
      leadId: lead.id,
      channel: targetChannel,
      message,
      sentTo: recipient,
      externalId: sendResult.externalId,
      error: sendResult.error,
    };
  }

  /**
   * Executa recuperação em lote para múltiplos leads.
   *
   * Processa cada lead sequencialmente para evitar rate-limit em providers.
   * Sucessos e falhas são contabilizados — não para na primeira falha.
   *
   * Channels parameter:
   * - Se omitido: auto-detect por lead (whatsapp se phone, senão email)
   * - Se ['whatsapp']: força whatsapp (falha leads sem phone)
   * - Se ['whatsapp', 'email']: auto-detect entre os dois canais permitidos
   */
  async batchRecover(
    leadIds: string[],
    ctx: TenantContext,
    channels?: RecoveryChannel[],
  ): Promise<{ sent: number; failed: number; total: number; results: RecoveryResult[] }> {
    const results: RecoveryResult[] = [];
    let sent = 0;
    let failed = 0;

    // Pre-validate: get all leads at once and filter by tenant
    const leads = await this.prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        orgId: ctx.orgId,
      },
    });

    const leadsMap = new Map(leads.map((l) => [l.id, l]));

    // Process each lead sequentially
    for (const leadId of leadIds) {
      const lead = leadsMap.get(leadId);
      if (!lead) {
        failed++;
        results.push({
          success: false,
          leadId,
          channel: 'whatsapp',
          message: '',
          sentTo: '',
          error: 'Lead não encontrado ou não pertence a esta organização',
        });
        continue;
      }

      // Determine channel for this specific lead
      let targetChannel: RecoveryChannel | undefined;
      if (channels && channels.length > 0) {
        // Pick first allowed channel that lead has data for
        if (channels.includes('whatsapp') && lead.phone) {
          targetChannel = 'whatsapp';
        } else if (channels.includes('email') && lead.email) {
          targetChannel = 'email';
        } else {
          failed++;
          results.push({
            success: false,
            leadId,
            channel: channels[0],
            message: '',
            sentTo: '',
            error: `Lead não tem ${channels[0] === 'whatsapp' ? 'telefone' : 'email'} cadastrado`,
          });
          continue;
        }
      }

      try {
        const result = await this.recover(leadId, ctx, targetChannel);
        results.push(result);
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
        this.logger.error(
          `Batch recovery failed for lead ${leadId}: ${err?.message}`,
        );
        results.push({
          success: false,
          leadId,
          channel: targetChannel || 'whatsapp',
          message: '',
          sentTo: '',
          error: err?.message || 'unknown_error',
        });
      }
    }

    return {
      sent,
      failed,
      total: leadIds.length,
      results,
    };
  }

  /**
   * Marks the most recent recovery attempt as "responded" when a customer
   * replies via WhatsApp or Email.
   *
   * Lookup strategy:
   *   1. Find the lead by phone (for whatsapp) or email (for email) in the
   *      given org. If multiple match, prefer the most recently updated one.
   *   2. Find the most recent `recovery_sent` ActivityLog for that lead within
   *      the last 30 days that has not yet been marked as responded.
   *   3. Patch its metadata with `success: true`, `respondedAt`, `response`.
   *
   * Returns the leadId touched (null if nothing was matched — webhook noise).
   *
   * NOTE: this is intentionally org-scoped via the lead lookup. Webhooks are
   * public, so we never trust org-id from the payload.
   */
  async markResponseReceived(input: {
    channel: RecoveryChannel;
    fromIdentifier: string; // phone or email of the responding customer
    responseText: string;
    receivedAt?: Date;
  }): Promise<{ matched: boolean; leadId: string | null }> {
    const receivedAt = input.receivedAt ?? new Date();

    // Find a lead with this phone/email (across all tenants — webhook context)
    const lead = await this.prisma.lead.findFirst({
      where:
        input.channel === 'whatsapp'
          ? { phone: input.fromIdentifier }
          : { email: input.fromIdentifier },
      orderBy: { updatedAt: 'desc' },
    });

    if (!lead) {
      this.logger.debug(
        `No lead matched for ${input.channel} from ${input.fromIdentifier}`,
      );
      return { matched: false, leadId: null };
    }

    // Find the most recent recovery_sent log NOT yet marked as responded,
    // within the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const log = await this.prisma.activityLog.findFirst({
      where: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: 'recovery_sent',
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!log) {
      this.logger.debug(
        `No recent recovery_sent log for lead ${lead.id}; webhook ignored`,
      );
      return { matched: false, leadId: lead.id };
    }

    // Patch metadata to record the response
    const existing = (log.metadata as Record<string, unknown>) ?? {};
    if (existing.success === true) {
      // Already marked — idempotency for noisy webhooks
      return { matched: true, leadId: lead.id };
    }

    await this.prisma.activityLog.update({
      where: { id: log.id },
      data: {
        metadata: {
          ...existing,
          success: true,
          respondedAt: receivedAt.toISOString(),
          response: input.responseText,
        },
      },
    });

    return { matched: true, leadId: lead.id };
  }

  /**
   * Builds the AI prompt — kept inside the service so the wording is
   * versionable alongside the recovery rules.
   */
  private buildPrompt(
    name: string,
    daysSinceLast: number,
    channel: RecoveryChannel,
  ): string {
    const channelInstruction =
      channel === 'whatsapp'
        ? 'curta de WhatsApp (máx 2 frases, tom amigável e informal)'
        : 'curta de email (máx 4 linhas, tom amigável)';

    return `Você é uma IA empática trabalhando para uma barbearia brasileira.
Escreva uma mensagem ${channelInstruction} para um cliente que não retorna à barbearia há ${daysSinceLast} dias.

Cliente: ${name}

Regras:
- NÃO use 'Prezado' ou linguagem formal
- Comece pelo nome do cliente
- Mencione discretamente o tempo sem vir (sem ser invasivo)
- Termine com um convite leve para voltar
- Use no máximo 1 emoji
- NÃO mencione preços nem promoções
- Responda APENAS com o texto da mensagem, sem aspas, sem prefixos`;
  }
}
