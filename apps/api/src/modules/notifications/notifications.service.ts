import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ChannelService } from '../integrations/channel.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { resolveTemplate } from './templates';

type TemplateVars = Record<string, string | number | undefined>;

interface ProposalSentEvent {
  orgId: string;
  proposalId: string;
  leadId: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelService: ChannelService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async sendTransactional(
    orgId: string,
    to: string,
    template: string,
    vars: TemplateVars,
  ): Promise<void> {
    const { subject, text, html } = resolveTemplate(template, vars);
    await this.channelService.sendEmail(orgId, to, { subject, text, html });

    this.eventEmitter.emit('notification.sent', {
      orgId,
      channel: 'email',
      to,
      template,
    });

    this.auditLog.record({
      orgId,
      actorId: null,
      actorRole: 'system',
      action: 'notification.sent',
      resourceType: 'notification',
      metadata: { channel: 'email', template, target: to },
    });
  }

  async sendInApp(
    orgId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.eventEmitter.emit('notification.sent', {
      orgId,
      channel: 'in_app',
      userId,
      type,
    });

    this.auditLog.record({
      orgId,
      actorId: null,
      actorRole: 'system',
      action: 'notification.sent',
      resourceType: 'notification',
      metadata: { channel: 'in_app', type, target: userId, ...payload },
    });
  }

  @OnEvent('proposal.sent')
  async handleProposalSent(event: ProposalSentEvent): Promise<void> {
    try {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: event.proposalId },
        include: { lead: { select: { email: true, name: true } } },
      });

      if (!proposal || !proposal.lead.email || !proposal.token) return;

      const appUrl = this.config.get<string>('appUrl') ?? '';
      const link = `${appUrl}/p/${proposal.token}`;

      await this.sendTransactional(event.orgId, proposal.lead.email, 'proposal_sent', {
        leadName: proposal.lead.name,
        proposalTitle: proposal.title,
        link,
      });
    } catch (err) {
      this.logger.warn(
        `proposal.sent notification failed for proposal ${event.proposalId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
