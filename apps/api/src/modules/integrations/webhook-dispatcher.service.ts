import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { JOB_NAMES, QUEUE_NAMES } from '@reshit/shared';

@Injectable()
export class WebhookDispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.WEBHOOKS) private readonly webhooksQueue: Queue,
  ) {}

  @OnEvent('lead.created')
  async onLeadCreated(payload: Record<string, unknown>) {
    await this.enqueue('lead.created', payload.orgId as string, payload);
  }

  @OnEvent('lead.status_changed')
  async onLeadStatusChanged(payload: Record<string, unknown>) {
    await this.enqueue('lead.status_changed', payload.orgId as string, payload);
  }

  @OnEvent('proposal.sent')
  async onProposalSent(payload: Record<string, unknown>) {
    await this.enqueue('proposal.sent', payload.orgId as string, payload);
  }

  @OnEvent('proposal.accepted')
  async onProposalAccepted(payload: Record<string, unknown>) {
    await this.enqueue('proposal.accepted', payload.orgId as string, payload);
  }

  @OnEvent('proposal.rejected')
  async onProposalRejected(payload: Record<string, unknown>) {
    await this.enqueue('proposal.rejected', payload.orgId as string, payload);
  }

  private async enqueue(eventType: string, orgId: string, data: Record<string, unknown>): Promise<void> {
    await this.webhooksQueue.add(
      JOB_NAMES.WEBHOOK_DISPATCH,
      { orgId, eventType, data },
      { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    );
  }

  // Public: called by WebhookProcessor to deliver a single webhook
  async deliverOne(
    orgId: string,
    webhook: { id: string; url: string; signingSecret: string },
    eventType: string,
    data: Record<string, unknown>,
    attemptsMade: number,
  ): Promise<void> {
    const body = JSON.stringify({
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
    });

    const signature = createHmac('sha256', webhook.signingSecret).update(body).digest('hex');

    let httpStatus: number | undefined;
    let status: 'success' | 'failed' = 'failed';
    let errorMsg: string | undefined;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Reshit-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });

      httpStatus = res.status;
      status = res.ok ? 'success' : 'failed';
      if (!res.ok) errorMsg = `HTTP ${res.status}`;
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
    }

    await this.prisma.integrationLog.create({
      data: {
        orgId,
        channel: 'webhook',
        direction: 'outbound',
        status,
        webhookId: webhook.id,
        targetUrl: webhook.url,
        httpStatus: httpStatus ?? null,
        payload: JSON.parse(body) as object,
        errorMsg: errorMsg ?? null,
        attempts: attemptsMade + 1,
      },
    });

    if (status === 'failed') {
      throw new Error(errorMsg ?? `Webhook delivery failed for ${webhook.url}`);
    }
  }

  async findActiveWebhooks(orgId: string, eventType: string) {
    return this.prisma.outboundWebhook.findMany({
      where: { orgId, isActive: true, events: { has: eventType } },
    });
  }
}
