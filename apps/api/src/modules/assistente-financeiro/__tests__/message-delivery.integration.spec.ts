import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { MessageDeliveryService, SendArgs, SendResult } from '../services/message-delivery.service';
import { DeliveryRateLimiterService, RateLimitResult } from '../services/delivery-rate-limiter.service';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { MessageDeliveryWorker } from '../workers/message-delivery.worker';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

/**
 * Integration tests for message delivery pipeline
 *
 * Tests cover:
 * 1. Rate limiting enforcement and window expiry
 * 2. WhatsApp delivery via Z-API with retry classification
 * 3. Email delivery via Resend with error handling
 * 4. MessageDeliveryService orchestration
 * 5. Webhook parsing and status updates
 * 6. BullMQ worker retry processing
 */

describe('Message Delivery Integration Tests', () => {
  let module: TestingModule;
  let service: MessageDeliveryService;
  let limiter: DeliveryRateLimiterService;
  let whatsappProvider: ZapiWhatsappProvider;
  let emailProvider: ResendEmailProvider;
  let prismaService: PrismaService;
  let queue: Queue;
  let worker: MessageDeliveryWorker;

  // Mocks
  let prismaMock: any;
  let queueMock: any;
  let whatsappProviderMock: any;
  let emailProviderMock: any;
  let redisMock: any;

  beforeAll(async () => {
    // Setup comprehensive mocks
    prismaMock = {
      assisteFinanceiroMessageDelivery: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      assisteFinanceiroMessageSuggestion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      process: jest.fn(),
    };

    whatsappProviderMock = {
      channel: 'whatsapp',
      send: jest.fn(),
      parseWebhook: jest.fn(),
    };

    emailProviderMock = {
      channel: 'email',
      send: jest.fn(),
      parseWebhook: jest.fn(),
    };

    const redisClient = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    redisMock = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };

    module = await Test.createTestingModule({
      providers: [
        MessageDeliveryService,
        DeliveryRateLimiterService,
        MessageDeliveryWorker,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ZapiWhatsappProvider, useValue: whatsappProviderMock },
        { provide: ResendEmailProvider, useValue: emailProviderMock },
        { provide: RedisService, useValue: redisMock },
        { provide: getQueueToken('message-delivery'), useValue: queueMock },
      ],
    }).compile();

    service = module.get(MessageDeliveryService);
    limiter = module.get(DeliveryRateLimiterService);
    prismaService = module.get(PrismaService);
    queue = module.get(getQueueToken('message-delivery'));
    worker = module.get(MessageDeliveryWorker);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // GROUP 1: Rate Limiting
  // ========================================================================

  describe('DeliveryRateLimiter', () => {
    let redisClient: any;

    beforeEach(() => {
      redisClient = {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(3600),
      };
      redisMock.getClient.mockReturnValue(redisClient);
    });

    it('should allow delivery when under limit', async () => {
      redisClient.incr.mockResolvedValue(30); // Under max of 60

      const result = await limiter.checkLimit('org-1', 'whatsapp', 60, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30); // 60 - 30
      expect(result.retryAfterSec).toBeUndefined();
    });

    it('should block delivery when over limit and return retryAfterSec', async () => {
      redisClient.incr.mockResolvedValue(65); // Over max of 60
      redisClient.ttl.mockResolvedValue(1800);

      const result = await limiter.checkLimit('org-1', 'whatsapp', 60, 3600);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSec).toBe(1800);
    });

    it('should reset counter after window expires', async () => {
      const key = 'af:delivery-limit:org-1:whatsapp';

      // First call: counter at 1, expire set to 3600s
      redisClient.incr.mockResolvedValueOnce(1);
      redisClient.expire.mockResolvedValueOnce(1);
      await limiter.checkLimit('org-1', 'whatsapp', 60, 3600);

      // Second call: window expired, counter resets to 1
      redisClient.incr.mockResolvedValueOnce(1);
      redisClient.expire.mockResolvedValueOnce(1);
      const result = await limiter.checkLimit('org-1', 'whatsapp', 60, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });

    it('should return max window as fallback if ttl is -1', async () => {
      redisClient.incr.mockResolvedValue(65);
      redisClient.ttl.mockResolvedValue(-1); // No expiry set

      const result = await limiter.checkLimit('org-1', 'whatsapp', 60, 3600);

      expect(result.retryAfterSec).toBe(3600);
    });
  });

  // ========================================================================
  // GROUP 2: WhatsApp Delivery via Z-API
  // ========================================================================

  describe('WhatsApp Delivery via Z-API', () => {
    beforeEach(() => {
      prismaMock.assisteFinanceiroMessageDelivery.create.mockResolvedValue({
        id: 'delivery-1',
        status: 'pending',
        attemptCount: 1,
      });
      prismaMock.assisteFinanceiroMessageDelivery.update.mockResolvedValue({
        id: 'delivery-1',
      });
      prismaMock.assisteFinanceiroMessageSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        personalizedMessage: 'Olá João, sua fatura venceu!',
      });
      redisMock.getClient().incr.mockResolvedValue(10);
    });

    it('should successfully deliver WhatsApp message', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-xyz-123',
        status: 'sent',
      });

      const result = await service.send({
        messageSuggestionId: 'sug-1',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('msg-xyz-123');
      expect(result.status).toBe('sent');
      expect(whatsappProviderMock.send).toHaveBeenCalledWith({
        recipient: '5511999999999',
        message: 'Olá João, sua fatura venceu!',
        subject: undefined,
      });
    });

    it('should mark delivery as sent when Z-API returns messageId', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-xyz-123',
        status: 'sent',
      });

      await service.send({
        messageSuggestionId: 'sug-1',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-1' },
        data: {
          externalId: 'msg-xyz-123',
          status: 'sent',
          errorMessage: undefined,
        },
      });
    });

    it('should handle 429 (rate limit) as retryable', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Rate limit exceeded',
        retryable: true,
      });

      const result = await service.send({
        messageSuggestionId: 'sug-1',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(queueMock.add).toHaveBeenCalledWith(
        'retry',
        expect.objectContaining({ deliveryId: 'delivery-1' }),
        expect.any(Object),
      );
    });

    it('should handle 5xx as retryable', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Internal server error',
        retryable: true,
      });

      const result = await service.send({
        messageSuggestionId: 'sug-1',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(result.success).toBe(false);
      expect(queueMock.add).toHaveBeenCalled();
    });

    it('should handle 4xx as permanent failure (non-retryable)', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Invalid phone number',
        retryable: false,
      });

      const result = await service.send({
        messageSuggestionId: 'sug-1',
        channel: 'whatsapp',
        recipient: 'invalid-number',
        orgId: 'org-1',
      });

      expect(result.success).toBe(false);
      expect(queueMock.add).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // GROUP 3: Email Delivery via Resend
  // ========================================================================

  describe('Email Delivery via Resend', () => {
    beforeEach(() => {
      prismaMock.assisteFinanceiroMessageDelivery.create.mockResolvedValue({
        id: 'delivery-2',
        status: 'pending',
        attemptCount: 1,
      });
      prismaMock.assisteFinanceiroMessageDelivery.update.mockResolvedValue({
        id: 'delivery-2',
      });
      prismaMock.assisteFinanceiroMessageSuggestion.findUnique.mockResolvedValue({
        id: 'sug-2',
        personalizedMessage: 'Você tem uma fatura pendente de R$500',
      });
      redisMock.getClient().incr.mockResolvedValue(5);
    });

    it('should successfully deliver email', async () => {
      emailProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'email-abc-456',
        status: 'sent',
      });

      const result = await service.send({
        messageSuggestionId: 'sug-2',
        channel: 'email',
        recipient: 'joao@example.com',
        subject: 'Fatura Pendente',
        orgId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('email-abc-456');
    });

    it('should mark delivery as sent when Resend returns id', async () => {
      emailProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'email-abc-456',
        status: 'sent',
      });

      await service.send({
        messageSuggestionId: 'sug-2',
        channel: 'email',
        recipient: 'joao@example.com',
        subject: 'Fatura Pendente',
        orgId: 'org-1',
      });

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-2' },
        data: {
          externalId: 'email-abc-456',
          status: 'sent',
          errorMessage: undefined,
        },
      });
    });

    it('should handle Resend API errors as non-retryable', async () => {
      emailProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Invalid email address',
        retryable: false,
      });

      const result = await service.send({
        messageSuggestionId: 'sug-2',
        channel: 'email',
        recipient: 'invalid-email',
        subject: 'Fatura Pendente',
        orgId: 'org-1',
      });

      expect(result.success).toBe(false);
      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('should include subject in email send request', async () => {
      emailProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'email-abc-456',
        status: 'sent',
      });

      await service.send({
        messageSuggestionId: 'sug-2',
        channel: 'email',
        recipient: 'joao@example.com',
        subject: 'Cobrança Urgente',
        orgId: 'org-1',
      });

      expect(emailProviderMock.send).toHaveBeenCalledWith({
        recipient: 'joao@example.com',
        message: 'Você tem uma fatura pendente de R$500',
        subject: 'Cobrança Urgente',
      });
    });
  });

  // ========================================================================
  // GROUP 4: MessageDeliveryService Orchestration
  // ========================================================================

  describe('MessageDeliveryService - Orchestration', () => {
    beforeEach(() => {
      prismaMock.assisteFinanceiroMessageDelivery.create.mockResolvedValue({
        id: 'delivery-3',
        status: 'pending',
        attemptCount: 1,
      });
      prismaMock.assisteFinanceiroMessageDelivery.update.mockResolvedValue({
        id: 'delivery-3',
      });
      prismaMock.assisteFinanceiroMessageSuggestion.findUnique.mockResolvedValue({
        id: 'sug-3',
        personalizedMessage: 'Teste',
      });
      redisMock.getClient().incr.mockResolvedValue(10);
    });

    it('should check rate limit before delivery', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-1',
        status: 'sent',
      });

      const redisClient = redisMock.getClient();
      redisClient.incr.mockResolvedValue(61); // Over limit
      redisClient.ttl.mockResolvedValue(1800);

      const result = await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(result.error).toBe('rate_limit_exceeded');
      expect(result.retryAfterSec).toBe(1800);
      expect(whatsappProviderMock.send).not.toHaveBeenCalled();
    });

    it('should fail fast if rate limited', async () => {
      const redisClient = redisMock.getClient();
      redisClient.incr.mockResolvedValue(61);
      redisClient.ttl.mockResolvedValue(900);

      const result = await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(result.success).toBe(false);
      expect(prismaMock.assisteFinanceiroMessageDelivery.create).not.toHaveBeenCalled();
    });

    it('should create delivery record with pending status', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-1',
        status: 'sent',
      });

      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(prismaMock.assisteFinanceiroMessageDelivery.create).toHaveBeenCalledWith({
        data: {
          messageSuggestionId: 'sug-3',
          channel: 'whatsapp',
          recipient: '5511999999999',
          status: 'pending',
          attemptCount: 1,
          lastAttemptAt: expect.any(Date),
        },
      });
    });

    it('should call correct provider based on channel', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-1',
        status: 'sent',
      });
      emailProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'email-1',
        status: 'sent',
      });

      // WhatsApp
      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });
      expect(whatsappProviderMock.send).toHaveBeenCalled();
      expect(emailProviderMock.send).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Email
      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Test',
        orgId: 'org-1',
      });
      expect(emailProviderMock.send).toHaveBeenCalled();
      expect(whatsappProviderMock.send).not.toHaveBeenCalled();
    });

    it('should update delivery with result after provider call', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-xyz-123',
        status: 'sent',
      });

      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-3' },
        data: {
          externalId: 'msg-xyz-123',
          status: 'sent',
          errorMessage: undefined,
        },
      });
    });

    it('should queue retry job if delivery failed but is retryable', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Timeout',
        retryable: true,
      });

      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: '5511999999999',
        orgId: 'org-1',
      });

      expect(queueMock.add).toHaveBeenCalledWith(
        'retry',
        expect.objectContaining({ deliveryId: 'delivery-3' }),
        { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
      );
    });

    it('should not queue retry if delivery failed but is not retryable', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Invalid phone',
        retryable: false,
      });

      await service.send({
        messageSuggestionId: 'sug-3',
        channel: 'whatsapp',
        recipient: 'invalid',
        orgId: 'org-1',
      });

      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if MessageSuggestion does not exist', async () => {
      prismaMock.assisteFinanceiroMessageSuggestion.findUnique.mockResolvedValue(null);

      await expect(
        service.send({
          messageSuggestionId: 'nonexistent',
          channel: 'whatsapp',
          recipient: '5511999999999',
          orgId: 'org-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================================================================
  // GROUP 5: Webhook Handling
  // ========================================================================

  describe('Webhook Parsing and Status Update', () => {
    beforeEach(() => {
      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-4',
        externalId: 'msg-webhook-123',
        status: 'sent',
      });
      prismaMock.assisteFinanceiroMessageDelivery.update.mockResolvedValue({
        id: 'delivery-4',
      });
    });

    it('should parse Z-API webhook payload (SENT)', async () => {
      const payload = {
        event: 'SENT',
        messageId: 'msg-webhook-123',
      };

      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'sent',
      });

      await service.handleWebhook('whatsapp', payload);

      expect(whatsappProviderMock.parseWebhook).toHaveBeenCalledWith(payload);
      expect(prismaMock.assisteFinanceiroMessageDelivery.findFirst).toHaveBeenCalledWith({
        where: { externalId: 'msg-webhook-123' },
      });
    });

    it('should parse Z-API webhook payload (DELIVERED)', async () => {
      const payload = {
        event: 'DELIVERED',
        messageId: 'msg-webhook-123',
      };

      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'delivered',
      });

      await service.handleWebhook('whatsapp', payload);

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-4' },
        data: {
          status: 'delivered',
          deliveredAt: expect.any(Date),
        },
      });
    });

    it('should parse Z-API webhook payload (READ)', async () => {
      const payload = {
        event: 'READ',
        messageId: 'msg-webhook-123',
      };

      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'read',
      });

      await service.handleWebhook('whatsapp', payload);

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-4' },
        data: {
          status: 'read',
          readAt: expect.any(Date),
        },
      });
    });

    it('should parse Z-API webhook payload (FAILED)', async () => {
      const payload = {
        event: 'FAILED',
        messageId: 'msg-webhook-123',
      };

      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'failed',
      });

      await service.handleWebhook('whatsapp', payload);

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery-4' },
          data: { status: 'failed' },
        }),
      );
    });

    it('should parse Resend webhook payload (sent)', async () => {
      const payload = {
        type: 'email.sent',
        data: { email_id: 'email-webhook-456' },
      };

      emailProviderMock.parseWebhook.mockReturnValue({
        externalId: 'email-webhook-456',
        status: 'sent',
      });

      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-5',
        externalId: 'email-webhook-456',
      });

      await service.handleWebhook('email', payload);

      expect(emailProviderMock.parseWebhook).toHaveBeenCalledWith(payload);
    });

    it('should parse Resend webhook payload (delivered)', async () => {
      const payload = {
        type: 'email.delivered',
        data: { email_id: 'email-webhook-456' },
      };

      emailProviderMock.parseWebhook.mockReturnValue({
        externalId: 'email-webhook-456',
        status: 'delivered',
      });

      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-5',
        externalId: 'email-webhook-456',
      });

      await service.handleWebhook('email', payload);

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-5' },
        data: {
          status: 'delivered',
          deliveredAt: expect.any(Date),
        },
      });
    });

    it('should set deliveredAt timestamp on delivered status', async () => {
      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'delivered',
      });

      const beforeTime = new Date();
      await service.handleWebhook('whatsapp', { event: 'DELIVERED' });
      const afterTime = new Date();

      const callArg = prismaMock.assisteFinanceiroMessageDelivery.update.mock.calls[0][0];
      expect(callArg.data.deliveredAt).toBeInstanceOf(Date);
      expect(callArg.data.deliveredAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(callArg.data.deliveredAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should set readAt timestamp on read status', async () => {
      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'msg-webhook-123',
        status: 'read',
      });

      const beforeTime = new Date();
      await service.handleWebhook('whatsapp', { event: 'READ' });
      const afterTime = new Date();

      const callArg = prismaMock.assisteFinanceiroMessageDelivery.update.mock.calls[0][0];
      expect(callArg.data.readAt).toBeInstanceOf(Date);
      expect(callArg.data.readAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(callArg.data.readAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should ignore webhook with missing externalId', async () => {
      whatsappProviderMock.parseWebhook.mockReturnValue(null);

      await service.handleWebhook('whatsapp', { event: 'UNKNOWN' });

      expect(prismaMock.assisteFinanceiroMessageDelivery.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.assisteFinanceiroMessageDelivery.update).not.toHaveBeenCalled();
    });

    it('should ignore webhook if delivery not found', async () => {
      whatsappProviderMock.parseWebhook.mockReturnValue({
        externalId: 'unknown-msg',
        status: 'delivered',
      });
      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue(null);

      await service.handleWebhook('whatsapp', { event: 'DELIVERED' });

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // GROUP 6: BullMQ Worker Processing
  // ========================================================================

  describe('MessageDeliveryWorker - Retry Processing', () => {
    let jobMock: any;

    beforeEach(() => {
      jobMock = {
        name: 'retry',
        data: {
          deliveryId: 'delivery-6',
          args: {
            messageSuggestionId: 'sug-1',
            channel: 'whatsapp',
            recipient: '5511999999999',
            orgId: 'org-1',
          },
        },
        attemptsMade: 0,
      };

      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-6',
        attemptCount: 1,
        externalId: 'msg-123',
      });
      prismaMock.assisteFinanceiroMessageDelivery.update.mockResolvedValue({
        id: 'delivery-6',
      });
      prismaMock.assisteFinanceiroMessageSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        personalizedMessage: 'Teste retry',
      });
    });

    it('should process retry job from queue', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-123',
        status: 'sent',
      });

      await worker.process(jobMock);

      expect(whatsappProviderMock.send).toHaveBeenCalled();
    });

    it('should increment attemptCount on retry', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-123',
        status: 'sent',
      });

      await worker.process(jobMock);

      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-6' },
        data: expect.objectContaining({
          attemptCount: { increment: 1 },
        }),
      });
    });

    it('should retry delivery on job processing', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-123',
        status: 'sent',
      });

      jobMock.attemptsMade = 1;

      await worker.process(jobMock);

      expect(whatsappProviderMock.send).toHaveBeenCalledWith({
        recipient: '5511999999999',
        message: 'Teste retry',
        subject: undefined,
      });
    });

    it('should throw error if retry fails', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: false,
        status: 'failed',
        error: 'Network timeout',
        retryable: true,
      });

      jobMock.attemptsMade = 2;

      await expect(worker.process(jobMock)).rejects.toThrow('Retry failed');
    });

    it('should track attempt count on each retry', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-123',
        status: 'sent',
      });

      jobMock.attemptsMade = 0;
      await worker.process(jobMock);

      jobMock.attemptsMade = 1;
      await worker.process(jobMock);

      jobMock.attemptsMade = 2;
      await worker.process(jobMock);

      // Verify that update was called 3 times with incrementing attempt tracking
      expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledTimes(3);
    });

    it('should update delivery status after successful retry', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-123',
        status: 'sent',
      });

      await worker.process(jobMock);

      const updateCall = prismaMock.assisteFinanceiroMessageDelivery.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('sent');
    });

    it('should preserve externalId on retry', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: 'msg-456', // Different ID from previous attempt
        status: 'sent',
      });

      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-6',
        attemptCount: 2,
        externalId: 'msg-123', // Original external ID
      });

      await worker.process(jobMock);

      const updateCall = prismaMock.assisteFinanceiroMessageDelivery.update.mock.calls[0][0];
      expect(updateCall.data.externalId).toBe('msg-456');
    });

    it('should use original externalId if provider does not return new one', async () => {
      whatsappProviderMock.send.mockResolvedValue({
        success: true,
        externalId: null, // Provider did not return new ID
        status: 'sent',
      });

      prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({
        id: 'delivery-6',
        attemptCount: 2,
        externalId: 'msg-123', // Keep original
      });

      await worker.process(jobMock);

      const updateCall = prismaMock.assisteFinanceiroMessageDelivery.update.mock.calls[0][0];
      expect(updateCall.data.externalId).toBe('msg-123'); // Preserved original
    });
  });
});
