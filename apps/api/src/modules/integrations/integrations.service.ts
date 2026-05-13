import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationCryptoService } from './integration-crypto.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import type { SaveConfigDto } from './dto/save-config.dto';
import type { SaveWebhookDto } from './dto/save-webhook.dto';

const MASKED_FIELDS: Record<string, string[]> = {
  email: ['password'],
  whatsapp: ['apiKey'],
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: IntegrationCryptoService,
  ) {}

  // ── Configs ────────────────────────────────────────────────────────────────

  async getConfigs(orgId: string) {
    const rows = await this.prisma.integrationConfig.findMany({
      where: { orgId },
      orderBy: { channel: 'asc' },
    });

    return rows.map((row) => {
      let publicFields: Record<string, unknown> = {};
      try {
        const full = JSON.parse(this.crypto.decrypt(row.config)) as Record<string, unknown>;
        const masked = MASKED_FIELDS[row.channel] ?? [];
        publicFields = Object.fromEntries(
          Object.entries(full).filter(([k]) => !masked.includes(k)),
        );
      } catch {
        // decryption failure — return empty public fields
      }

      return {
        id: row.id,
        channel: row.channel,
        isActive: row.isActive,
        fields: publicFields,
        updatedAt: row.updatedAt,
      };
    });
  }

  async saveConfig(orgId: string, dto: SaveConfigDto) {
    const encrypted = this.crypto.encrypt(JSON.stringify(dto.config));

    const existing = await this.prisma.integrationConfig.findUnique({
      where: { orgId_channel: { orgId, channel: dto.channel } },
    });

    if (existing) {
      return this.prisma.integrationConfig.update({
        where: { id: existing.id },
        data: { config: encrypted, isActive: dto.isActive ?? existing.isActive },
      });
    }

    return this.prisma.integrationConfig.create({
      data: { orgId, channel: dto.channel, config: encrypted, isActive: dto.isActive ?? true },
    });
  }

  async toggleConfig(orgId: string, channel: string, isActive: boolean) {
    const row = await this.prisma.integrationConfig.findUnique({
      where: { orgId_channel: { orgId, channel } },
    });
    if (!row) throw new NotFoundException('Configuração não encontrada');
    return this.prisma.integrationConfig.update({
      where: { id: row.id },
      data: { isActive },
      select: { id: true, channel: true, isActive: true, updatedAt: true },
    });
  }

  async deleteConfig(orgId: string, channel: string) {
    const row = await this.prisma.integrationConfig.findUnique({
      where: { orgId_channel: { orgId, channel } },
    });
    if (!row) throw new NotFoundException('Configuração não encontrada');
    await this.prisma.integrationConfig.delete({ where: { id: row.id } });
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  async getWebhooks(orgId: string) {
    return this.prisma.outboundWebhook.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, events: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async createWebhook(orgId: string, dto: SaveWebhookDto) {
    const signingSecret = randomBytes(32).toString('hex');
    return this.prisma.outboundWebhook.create({
      data: {
        orgId,
        url: dto.url,
        events: dto.events,
        signingSecret,
        isActive: dto.isActive ?? true,
      },
      select: { id: true, url: true, events: true, isActive: true, signingSecret: true, createdAt: true },
    });
  }

  async updateWebhook(orgId: string, id: string, dto: Partial<SaveWebhookDto>) {
    const existing = await this.prisma.outboundWebhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook não encontrado');
    assertSameTenant(existing.orgId, orgId);

    return this.prisma.outboundWebhook.update({
      where: { id },
      data: {
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { id: true, url: true, events: true, isActive: true, updatedAt: true },
    });
  }

  async deleteWebhook(orgId: string, id: string) {
    const existing = await this.prisma.outboundWebhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook não encontrado');
    assertSameTenant(existing.orgId, orgId);
    await this.prisma.outboundWebhook.delete({ where: { id } });
  }

  // ── Logs ───────────────────────────────────────────────────────────────────

  async getLogs(orgId: string, channel?: string, status?: string, page = 1, limit = 30) {
    const where: Record<string, unknown> = { orgId };
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, channel: true, direction: true, status: true,
          targetUrl: true, httpStatus: true, errorMsg: true, attempts: true, createdAt: true,
        },
      }),
      this.prisma.integrationLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
