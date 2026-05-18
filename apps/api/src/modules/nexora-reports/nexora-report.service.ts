import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';

export interface WeeklyReportStats {
  inactiveDetected: number;
  recoveriesSent: number;
  responsesReceived: number;
  confirmedRecoveries: number;
  realRevenue: number;
  potentialRevenue: number;
}

/**
 * NexoraReportService
 *
 * Builds and emails the Monday-morning weekly digest to each barbershop owner.
 *
 * The email is the retention motor: it shows the owner exactly how much money
 * the system put back into their cash register last week + how much is still
 * sitting on the table. Without this email, the product is "set and forget" —
 * which means the owner forgets it exists, then cancels.
 *
 * System emails use the global RESEND_API_KEY (not the tenant's outbound
 * config), so we can always reach the owner even if they haven't configured
 * their channels yet.
 */
@Injectable()
export class NexoraReportService {
  private readonly logger = new Logger(NexoraReportService.name);
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('resend.apiKey') || '';

    const fromEmail =
      this.config.get<string>('resend.fromEmail') || 'reports@nexora.com.br';
    const fromName = this.config.get<string>('resend.fromName') || 'Nexora';
    this.fromAddress = `${fromName} <${fromEmail}>`;

    if (!this.apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not configured — weekly reports will be skipped',
      );
    }
  }

  /**
   * Computes the previous 7-day window stats for one org.
   */
  async computeWeeklyStats(orgId: string, weekEnd: Date = new Date()): Promise<WeeklyReportStats> {
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const inactiveThreshold = new Date(weekEnd);
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 30);

    const [
      inactiveDetected,
      recoveriesSent,
      responsesReceived,
      confirmedRecoveries,
      revenueAgg,
    ] = await Promise.all([
      // Inativos atualmente (snapshot — não é por janela semanal, é "agora")
      this.prisma.lead.count({
        where: {
          orgId,
          archivedAt: null,
          optedOutAt: null,
          recoveredAt: null,
          status: { notIn: ['closed_lost', 'closed_won'] },
          updatedAt: { lt: inactiveThreshold },
        },
      }),
      // Tentativas de recuperação na semana
      this.prisma.activityLog.count({
        where: {
          orgId,
          type: 'recovery_sent',
          createdAt: { gte: weekStart, lt: weekEnd },
        },
      }),
      // Respostas positivas na semana
      this.prisma.activityLog.count({
        where: {
          orgId,
          type: 'recovery_sent',
          createdAt: { gte: weekStart, lt: weekEnd },
          metadata: { path: ['success'], equals: true },
        },
      }),
      // Confirmadas (cliente voltou e pagou) na semana
      this.prisma.lead.count({
        where: {
          orgId,
          recoveredAt: { gte: weekStart, lt: weekEnd },
        },
      }),
      // Receita real recuperada na semana
      this.prisma.lead.aggregate({
        where: {
          orgId,
          recoveredAt: { gte: weekStart, lt: weekEnd },
        },
        _sum: { recoveredValue: true },
      }),
    ]);

    return {
      inactiveDetected,
      recoveriesSent,
      responsesReceived,
      confirmedRecoveries,
      realRevenue: Number(revenueAgg._sum.recoveredValue ?? 0),
      potentialRevenue: inactiveDetected * 80,
    };
  }

  /**
   * Renders + sends the weekly email to the admin user of one org.
   * Returns false when the email could not be sent (e.g. Resend not configured,
   * admin has no email). Never throws — designed to be called in a loop.
   */
  async sendWeeklyReport(orgId: string): Promise<boolean> {
    if (!this.apiKey) return false;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, niche: true },
    });
    if (!org || org.niche !== 'barbearia') return false;

    const admin = await this.prisma.user.findFirst({
      where: { orgId, role: 'admin', status: 'active' },
      select: { email: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      this.logger.warn(`No active admin found for org ${orgId} — skipping report`);
      return false;
    }

    const stats = await this.computeWeeklyStats(orgId);

    // Don't send empty reports — wastes the channel
    if (
      stats.recoveriesSent === 0 &&
      stats.confirmedRecoveries === 0 &&
      stats.inactiveDetected === 0
    ) {
      this.logger.debug(`No activity for org ${orgId}, skipping weekly report`);
      return false;
    }

    const { subject, text, html } = this.buildEmail({
      orgName: org.name,
      orgSlug: org.slug,
      adminName: admin.name,
      stats,
    });

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: this.fromAddress,
          to: [admin.email],
          subject,
          text,
          html,
        },
        {
          timeout: 10000,
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      );
      this.logger.log(`Weekly report sent to ${admin.email} for org ${orgId}`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to send weekly report for org ${orgId}: ${err?.message}`,
      );
      return false;
    }
  }

  private buildEmail(input: {
    orgName: string;
    orgSlug: string;
    adminName: string;
    stats: WeeklyReportStats;
  }): { subject: string; text: string; html: string } {
    const { orgName, orgSlug, adminName, stats } = input;
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    const dashboardUrl = `https://app.nexora.com.br/${orgSlug}/dashboard`;

    const subject =
      stats.realRevenue > 0
        ? `Você recuperou ${fmt(stats.realRevenue)} esta semana 🎉`
        : `${stats.inactiveDetected} clientes da ${orgName} esperando uma mensagem`;

    const text = [
      `Oi ${adminName.split(' ')[0]},`,
      '',
      `Resumo da semana na ${orgName}:`,
      '',
      `💰 Receita recuperada: ${fmt(stats.realRevenue)}`,
      `✅ Clientes que voltaram e pagaram: ${stats.confirmedRecoveries}`,
      `📩 Mensagens enviadas: ${stats.recoveriesSent}`,
      `💬 Respostas recebidas: ${stats.responsesReceived}`,
      '',
      `📊 Ainda tem ${stats.inactiveDetected} clientes inativos esperando — potencial de ${fmt(stats.potentialRevenue)}.`,
      '',
      `Ver detalhes: ${dashboardUrl}`,
      '',
      '— Nexora',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #fafafa;">
  <h1 style="font-size: 20px; margin-bottom: 16px;">Oi ${adminName.split(' ')[0]} 👋</h1>
  <p style="font-size: 14px; color: #555;">Resumo da semana na <strong>${orgName}</strong>:</p>

  <div style="background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; margin: 16px 0;">
    <div style="background: #d4f4dd; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 16px;">
      <p style="font-size: 11px; color: #047857; margin: 0 0 4px; text-transform: uppercase; font-weight: 600;">Receita recuperada esta semana</p>
      <p style="font-size: 32px; font-weight: bold; color: #047857; margin: 0;">${fmt(stats.realRevenue)}</p>
      <p style="font-size: 12px; color: #555; margin: 4px 0 0;">${stats.confirmedRecoveries} ${stats.confirmedRecoveries === 1 ? 'cliente voltou' : 'clientes voltaram'}</p>
    </div>

    <table style="width: 100%; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #555;">📩 Mensagens enviadas</td><td style="text-align: right; font-weight: 600;">${stats.recoveriesSent}</td></tr>
      <tr><td style="padding: 6px 0; color: #555;">💬 Respostas recebidas</td><td style="text-align: right; font-weight: 600;">${stats.responsesReceived}</td></tr>
      <tr><td style="padding: 6px 0; color: #555;">⏰ Inativos agora</td><td style="text-align: right; font-weight: 600;">${stats.inactiveDetected}</td></tr>
      <tr><td style="padding: 6px 0; color: #555;">💸 Potencial em aberto</td><td style="text-align: right; font-weight: 600; color: #f59e0b;">${fmt(stats.potentialRevenue)}</td></tr>
    </table>
  </div>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: #d4af37; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ver detalhes no dashboard</a>
  </div>

  <p style="font-size: 12px; color: #888; text-align: center; margin-top: 32px;">
    Nexora · Recuperação de clientes para barbearias
  </p>
</body>
</html>`.trim();

    return { subject, text, html };
  }

  /**
   * Sends weekly reports for ALL active barbershop orgs.
   * Designed to be called from a cron at Monday 8am.
   */
  async sendAllWeeklyReports(): Promise<{ sent: number; skipped: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: { niche: 'barbearia', status: 'active' },
      select: { id: true },
    });

    let sent = 0;
    let skipped = 0;

    for (const org of orgs) {
      const ok = await this.sendWeeklyReport(org.id);
      if (ok) sent++;
      else skipped++;
    }

    this.logger.log(
      `Weekly report run complete — sent: ${sent}, skipped: ${skipped}, total orgs: ${orgs.length}`,
    );
    return { sent, skipped };
  }
}
