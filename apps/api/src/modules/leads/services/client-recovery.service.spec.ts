import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientRecoveryService, isOptOutMessage } from './client-recovery.service';
import { PrismaService } from '../../../database/prisma.service';
import { LlmService } from '../../ai-actions/llm.service';
import { ZapiWhatsappProvider } from '../../assistente-financeiro/providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../../assistente-financeiro/providers/resend-email.provider';
import type { TenantContext } from '../../../common/tenant/tenant-context';

const CTX: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  role: 'admin',
  tokenId: 'tok-1',
};

const FORTY_DAYS_AGO = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

const buildLead = (overrides: Partial<{
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  updatedAt: Date;
}> = {}) => ({
  id: 'lead-1',
  orgId: 'org-1',
  name: 'João Silva',
  email: 'joao@example.com',
  phone: '5511999998888',
  source: 'manual',
  status: 'contacted',
  pipelineStageId: null,
  archivedAt: null,
  aiClassification: null,
  aiScore: null,
  assignedTo: null,
  followUpCount: 0,
  nicheData: {},
  createdAt: new Date(),
  updatedAt: FORTY_DAYS_AGO,
  ...overrides,
});

describe('ClientRecoveryService', () => {
  let service: ClientRecoveryService;
  let prismaMock: any;
  let llmMock: any;
  let whatsappMock: any;
  let emailMock: any;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock = {
      lead: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    llmMock = {
      call: jest.fn().mockResolvedValue({
        content: 'João, faz um tempinho que a gente não te vê por aqui. Aparece pra dar aquele trato! ✂️',
        tokensInput: 50,
        tokensOutput: 30,
        latencyMs: 100,
      }),
    };

    whatsappMock = {
      channel: 'whatsapp',
      send: jest.fn(),
      parseWebhook: jest.fn(),
    };

    emailMock = {
      channel: 'email',
      send: jest.fn(),
      parseWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientRecoveryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LlmService, useValue: llmMock },
        { provide: ZapiWhatsappProvider, useValue: whatsappMock },
        { provide: ResendEmailProvider, useValue: emailMock },
      ],
    }).compile();

    service = module.get<ClientRecoveryService>(ClientRecoveryService);
  });

  describe('happy paths', () => {
    it('recovers via whatsapp when lead has phone (auto-detected channel)', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-msg-123',
        status: 'sent',
      });

      const result = await service.recover('lead-1', CTX);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
      expect(result.sentTo).toBe('5511999998888');
      expect(result.externalId).toBe('wa-msg-123');
      expect(result.message).toContain('João');
      expect(whatsappMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '5511999998888',
          message: expect.any(String),
        }),
      );
      expect(emailMock.send).not.toHaveBeenCalled();
    });

    it('recovers via email when lead has no phone (auto-detected)', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ phone: null, email: 'maria@example.com', name: 'Maria' }),
      );
      emailMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'email-id-456',
        status: 'sent',
      });

      const result = await service.recover('lead-1', CTX);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.sentTo).toBe('maria@example.com');
      expect(emailMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'maria@example.com',
          subject: expect.stringContaining('Maria'),
        }),
      );
      expect(whatsappMock.send).not.toHaveBeenCalled();
    });

    it('respects explicit channel override (email even when phone exists)', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ phone: '5511...', email: 'a@b.com' }),
      );
      emailMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'mail-1',
        status: 'sent',
      });

      const result = await service.recover('lead-1', CTX, 'email');

      expect(result.channel).toBe('email');
      expect(emailMock.send).toHaveBeenCalled();
      expect(whatsappMock.send).not.toHaveBeenCalled();
    });

    it('bumps followUpCount on success', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      await service.recover('lead-1', CTX);

      expect(prismaMock.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { followUpCount: { increment: 1 } },
      });
    });

    it('persists ActivityLog with recovery_sent type on success', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      await service.recover('lead-1', CTX);

      expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          leadId: 'lead-1',
          userId: 'user-1',
          type: 'recovery_sent',
          metadata: expect.objectContaining({
            channel: 'whatsapp',
            recipient: '5511999998888',
            success: true,
            externalId: 'wa-1',
          }),
        }),
      });
    });
  });

  describe('error paths', () => {
    it('throws NotFoundException when lead does not exist', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(null);

      await expect(service.recover('ghost', CTX)).rejects.toThrow(
        NotFoundException,
      );
      expect(llmMock.call).not.toHaveBeenCalled();
      expect(whatsappMock.send).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when lead belongs to another tenant (no leak)', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ orgId: 'org-EVIL' }),
      );

      await expect(service.recover('lead-1', CTX)).rejects.toThrow(
        NotFoundException,
      );
      expect(whatsappMock.send).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when whatsapp explicitly chosen but lead has no phone', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ phone: null, email: 'a@b.com' }),
      );

      await expect(
        service.recover('lead-1', CTX, 'whatsapp'),
      ).rejects.toThrow(BadRequestException);
      expect(whatsappMock.send).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when email explicitly chosen but lead has no email', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ phone: '5511...', email: null }),
      );

      await expect(service.recover('lead-1', CTX, 'email')).rejects.toThrow(
        BadRequestException,
      );
      expect(emailMock.send).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('still logs ActivityLog when provider returns failure', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockResolvedValueOnce({
        success: false,
        status: 'failed',
        error: 'provider_not_configured',
        retryable: false,
      });

      const result = await service.recover('lead-1', CTX);

      expect(result.success).toBe(false);
      expect(result.error).toBe('provider_not_configured');
      expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'recovery_sent',
          metadata: expect.objectContaining({
            success: false,
            error: 'provider_not_configured',
          }),
        }),
      });
      // followUpCount NÃO deve incrementar em falha
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });

    it('logs ActivityLog when provider throws unexpectedly', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockRejectedValueOnce(new Error('network down'));

      const result = await service.recover('lead-1', CTX);

      expect(result.success).toBe(false);
      expect(result.error).toContain('network down');
      expect(prismaMock.activityLog.create).toHaveBeenCalled();
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('AI prompt', () => {
    it('builds prompt with lead name and days inactive', async () => {
      const fifty = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ name: 'Carlos Pereira', updatedAt: fifty }),
      );
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      await service.recover('lead-1', CTX);

      const prompt = llmMock.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Carlos Pereira');
      // dias inativos entre 49 e 51 (rounding tolerância)
      expect(prompt).toMatch(/há (49|50|51) dias/);
      expect(prompt).toContain('barbearia');
      expect(prompt).toContain('NÃO mencione preços');
    });

    it('uses whatsapp-specific copy hint for whatsapp channel', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      await service.recover('lead-1', CTX);

      const prompt = llmMock.call.mock.calls[0][0] as string;
      expect(prompt).toContain('WhatsApp');
    });

    it('uses email-specific copy hint for email channel', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ phone: null, email: 'x@y.com' }),
      );
      emailMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'm-1',
        status: 'sent',
      });

      await service.recover('lead-1', CTX);

      const prompt = llmMock.call.mock.calls[0][0] as string;
      expect(prompt).toContain('email');
    });
  });

  describe('batchRecover', () => {
    it('sends recovery to multiple leads sequentially and counts sent/failed', async () => {
      const lead1 = buildLead({ id: 'lead-1', name: 'João' });
      const lead2 = buildLead({ id: 'lead-2', name: 'Maria', phone: null, email: 'm@e.com' });

      prismaMock.lead.findMany.mockResolvedValueOnce([lead1, lead2]);
      // recover() reads individual leads via findUnique
      prismaMock.lead.findUnique
        .mockResolvedValueOnce(lead1)
        .mockResolvedValueOnce(lead2);
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });
      emailMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'em-1',
        status: 'sent',
      });

      const result = await service.batchRecover(['lead-1', 'lead-2'], CTX);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].channel).toBe('whatsapp');
      expect(result.results[1].channel).toBe('email');
    });

    it('counts a lead as failed when it does not belong to the tenant', async () => {
      // findMany returns nothing because the lead belongs to another tenant
      prismaMock.lead.findMany.mockResolvedValueOnce([]);

      const result = await service.batchRecover(['lead-orphan'], CTX);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('não pertence');
    });

    it('does not stop on individual failures — continues batch', async () => {
      const lead1 = buildLead({ id: 'lead-1' });
      const lead2 = buildLead({ id: 'lead-2' });

      prismaMock.lead.findMany.mockResolvedValueOnce([lead1, lead2]);
      prismaMock.lead.findUnique
        .mockResolvedValueOnce(lead1)
        .mockResolvedValueOnce(lead2);
      whatsappMock.send
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValueOnce({
          success: true,
          externalId: 'wa-2',
          status: 'sent',
        });

      const result = await service.batchRecover(['lead-1', 'lead-2'], CTX);

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(2);
    });

    it('respects channel restriction — fails leads without the requested channel data', async () => {
      const leadNoPhone = buildLead({ id: 'lead-1', phone: null, email: 'a@e.com' });

      prismaMock.lead.findMany.mockResolvedValueOnce([leadNoPhone]);

      const result = await service.batchRecover(['lead-1'], CTX, ['whatsapp']);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('telefone');
    });

    it('prefers whatsapp when both channels allowed and lead has phone', async () => {
      const leadWithBoth = buildLead({ id: 'lead-1' }); // has both phone + email

      prismaMock.lead.findMany.mockResolvedValueOnce([leadWithBoth]);
      prismaMock.lead.findUnique.mockResolvedValueOnce(leadWithBoth);
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      const result = await service.batchRecover(['lead-1'], CTX, ['whatsapp', 'email']);

      expect(result.sent).toBe(1);
      expect(result.results[0].channel).toBe('whatsapp');
      expect(emailMock.send).not.toHaveBeenCalled();
    });
  });

  describe('markResponseReceived (webhook inbound)', () => {
    it('marks the most recent recovery_sent as responded when a known phone replies', async () => {
      const lead = buildLead({ phone: '5511999998888' });
      const log = {
        id: 'log-1',
        orgId: lead.orgId,
        leadId: lead.id,
        type: 'recovery_sent',
        metadata: { channel: 'whatsapp', success: false },
        createdAt: new Date(),
      };

      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(log);

      const result = await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'Quero voltar sim!',
      });

      expect(result.matched).toBe(true);
      expect(result.leadId).toBe(lead.id);
      expect(prismaMock.activityLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          metadata: expect.objectContaining({
            success: true,
            response: 'Quero voltar sim!',
            respondedAt: expect.any(String),
          }),
        },
      });
    });

    it('returns matched=false when no lead exists for the phone', async () => {
      prismaMock.lead.findFirst.mockResolvedValueOnce(null);

      const result = await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511000000000',
        responseText: 'spam',
      });

      expect(result.matched).toBe(false);
      expect(result.leadId).toBeNull();
      expect(prismaMock.activityLog.update).not.toHaveBeenCalled();
    });

    it('returns leadId but does nothing when lead has no recent recovery log', async () => {
      const lead = buildLead({ phone: '5511999998888' });
      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(null);

      const result = await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'oi',
      });

      expect(result.matched).toBe(false);
      expect(result.leadId).toBe(lead.id);
      expect(prismaMock.activityLog.update).not.toHaveBeenCalled();
    });

    it('is idempotent — does not overwrite when already marked as responded', async () => {
      const lead = buildLead();
      const alreadyResponded = {
        id: 'log-2',
        metadata: { channel: 'whatsapp', success: true, respondedAt: '2026-01-01' },
        createdAt: new Date(),
      };

      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(alreadyResponded);

      const result = await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'second reply',
      });

      expect(result.matched).toBe(true);
      expect(prismaMock.activityLog.update).not.toHaveBeenCalled();
    });

    it('looks up by email when channel is email', async () => {
      const lead = buildLead({ phone: null, email: 'maria@example.com' });
      const log = {
        id: 'log-3',
        metadata: { channel: 'email', success: false },
        createdAt: new Date(),
      };

      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(log);

      await service.markResponseReceived({
        channel: 'email',
        fromIdentifier: 'maria@example.com',
        responseText: 'Quero agendar',
      });

      // Verify the lead lookup used email, not phone
      expect(prismaMock.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'maria@example.com' },
        }),
      );
    });
  });

  describe('isOptOutMessage (keyword detector)', () => {
    it.each([
      ['parar', true],
      ['PARAR', true],
      ['Parar.', true],
      ['Pare!', true],
      ['sair', true],
      ['cancelar', true],
      ['stop', true],
      ['Não quero mais receber mensagens', true],
      ['nao envie mais', true],
      ['Quero parar de receber', true],
      // Not opt-outs
      ['ok', false],
      ['Quero voltar sim', false],
      ['Tudo bem', false],
      ['', false],
      ['nao posso hoje', false], // "não" alone is NOT opt-out
      ['quero saber mais', false], // "saber" must not match "sair"
    ])('isOptOutMessage(%j) → %s', (text, expected) => {
      expect(isOptOutMessage(text as string)).toBe(expected);
    });
  });

  describe('confirmRecovery (real revenue tracking)', () => {
    it('marks lead as recovered with the given value', async () => {
      const lead = buildLead();
      prismaMock.lead.findUnique.mockResolvedValueOnce(lead);

      const result = await service.confirmRecovery('lead-1', 80, CTX);

      expect(result.leadId).toBe('lead-1');
      expect(result.recoveredValue).toBe(80);
      expect(prismaMock.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: expect.objectContaining({
          recoveredAt: expect.any(Date),
          recoveredValue: 80,
        }),
      });
    });

    it('writes a recovery_confirmed ActivityLog on first confirmation', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(buildLead());

      await service.confirmRecovery('lead-1', 50, CTX);

      expect(prismaMock.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'recovery_confirmed',
            content: expect.stringContaining('R$ 50.00'),
          }),
        }),
      );
    });

    it('does NOT duplicate the audit log when correcting the value', async () => {
      // Already-recovered lead
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ recoveredAt: new Date('2026-05-01') } as any),
      );

      await service.confirmRecovery('lead-1', 95, CTX);

      // Update should still run (correcting the value), but audit log entry
      // for recovery_confirmed must NOT be appended again.
      expect(prismaMock.lead.update).toHaveBeenCalled();
      expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when lead does not exist', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(null);

      await expect(service.confirmRecovery('missing', 50, CTX)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses cross-tenant confirmation', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ orgId: 'other-org' }),
      );

      await expect(service.confirmRecovery('lead-1', 50, CTX)).rejects.toThrow();
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('opt-out enforcement', () => {
    it('recover() throws BadRequestException when lead has optedOutAt set', async () => {
      prismaMock.lead.findUnique.mockResolvedValueOnce(
        buildLead({ optedOutAt: new Date('2026-05-01') } as any),
      );

      await expect(service.recover('lead-1', CTX)).rejects.toThrow(BadRequestException);
      expect(whatsappMock.send).not.toHaveBeenCalled();
      expect(emailMock.send).not.toHaveBeenCalled();
    });

    it('batchRecover() counts opt-outs as skipped, not failed', async () => {
      const optedOut = buildLead({ id: 'lead-out', optedOutAt: new Date() } as any);
      const ok = buildLead({ id: 'lead-ok' });

      prismaMock.lead.findMany.mockResolvedValueOnce([optedOut, ok]);
      prismaMock.lead.findUnique.mockResolvedValueOnce(ok);
      whatsappMock.send.mockResolvedValueOnce({
        success: true,
        externalId: 'wa-1',
        status: 'sent',
      });

      const result = await service.batchRecover(['lead-out', 'lead-ok'], CTX);

      expect(result.sent).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      const skippedResult = result.results.find((r) => r.leadId === 'lead-out');
      expect(skippedResult?.error).toBe('opted_out');
    });

    it('markResponseReceived() flags lead as opted out when reply matches stop-keyword', async () => {
      const lead = buildLead();
      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      // No recovery_sent log needed — opt-out is independent
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(null);

      const result = await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'PARAR',
      });

      expect(result.optedOut).toBe(true);
      expect(prismaMock.lead.update).toHaveBeenCalledWith({
        where: { id: lead.id },
        data: { optedOutAt: expect.any(Date) },
      });
      // Audit log entry of type recovery_opt_out should be created
      expect(prismaMock.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'recovery_opt_out' }),
        }),
      );
    });

    it('opt-out reply does NOT mark the recovery_sent log as successful', async () => {
      const lead = buildLead();
      const log = {
        id: 'log-1',
        metadata: { channel: 'whatsapp', success: false },
        createdAt: new Date(),
      };
      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(log);

      await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'parar',
      });

      // The activity_log.update should NOT have been called with success: true
      const updateCalls = prismaMock.activityLog.update.mock.calls;
      const successCalls = updateCalls.filter(
        (c: any[]) => c[0]?.data?.metadata?.success === true,
      );
      expect(successCalls).toHaveLength(0);
    });

    it('does not re-record opt-out when lead is already opted out (idempotent)', async () => {
      const lead = buildLead({ optedOutAt: new Date('2026-05-01') } as any);
      prismaMock.lead.findFirst.mockResolvedValueOnce(lead);
      prismaMock.activityLog.findFirst.mockResolvedValueOnce(null);

      await service.markResponseReceived({
        channel: 'whatsapp',
        fromIdentifier: '5511999998888',
        responseText: 'parar',
      });

      expect(prismaMock.lead.update).not.toHaveBeenCalled();
      expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
    });
  });
});
