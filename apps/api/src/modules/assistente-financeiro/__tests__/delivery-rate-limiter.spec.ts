import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MessageDeliveryService } from '../services/message-delivery.service';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { DeliveryRateLimiterService } from '../services/delivery-rate-limiter.service';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('MessageDeliveryService', () => {
  let service: MessageDeliveryService;
  let prismaMock: any;
  let whatsappMock: any;
  let emailMock: any;
  let limiterMock: any;
  let queueMock: any;

  beforeEach(async () => {
    prismaMock = {
      assisteFinanceiroMessageDelivery: {
        create: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
      assisteFinanceiroMessageSuggestion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sug-1',
          personalizedMessage: 'Olá João!',
          channel: 'whatsapp',
        }),
      },
    };
    whatsappMock = { channel: 'whatsapp', send: jest.fn(), parseWebhook: jest.fn() };
    emailMock = { channel: 'email', send: jest.fn(), parseWebhook: jest.fn() };
    limiterMock = { checkLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 50 }) };
    queueMock = { add: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MessageDeliveryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ZapiWhatsappProvider, useValue: whatsappMock },
        { provide: ResendEmailProvider, useValue: emailMock },
        { provide: DeliveryRateLimiterService, useValue: limiterMock },
        { provide: getQueueToken('message-delivery'), useValue: queueMock },
      ],
    }).compile();
    service = module.get(MessageDeliveryService);
  });

  it('sends whatsapp message and persists delivery', async () => {
    whatsappMock.send.mockResolvedValue({
      success: true,
      externalId: 'msg-xyz',
      status: 'sent',
    });

    const result = await service.send({
      messageSuggestionId: 'sug-1',
      channel: 'whatsapp',
      recipient: '5511999999999',
      orgId: 'org-1',
    });

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('msg-xyz');
    expect(whatsappMock.send).toHaveBeenCalled();
    expect(prismaMock.assisteFinanceiroMessageDelivery.create).toHaveBeenCalled();
    expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalled();
  });

  it('blocks when rate limited', async () => {
    limiterMock.checkLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 60 });

    const result = await service.send({
      messageSuggestionId: 'sug-1',
      channel: 'whatsapp',
      recipient: '5511999999999',
      orgId: 'org-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('rate_limit');
    expect(whatsappMock.send).not.toHaveBeenCalled();
  });

  it('enqueues retry job on retryable failure', async () => {
    whatsappMock.send.mockResolvedValue({
      success: false,
      status: 'failed',
      error: 'timeout',
      retryable: true,
    });

    const result = await service.send({
      messageSuggestionId: 'sug-1',
      channel: 'whatsapp',
      recipient: '5511999999999',
      orgId: 'org-1',
    });

    expect(result.success).toBe(false);
    expect(queueMock.add).toHaveBeenCalledWith('retry', expect.objectContaining({ deliveryId: 'delivery-1' }), expect.any(Object));
  });

  it('does NOT enqueue retry on permanent failure', async () => {
    whatsappMock.send.mockResolvedValue({
      success: false,
      status: 'failed',
      error: 'invalid_phone',
      retryable: false,
    });

    await service.send({
      messageSuggestionId: 'sug-1',
      channel: 'whatsapp',
      recipient: 'bad',
      orgId: 'org-1',
    });

    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('handles webhook and updates delivery status', async () => {
    prismaMock.assisteFinanceiroMessageDelivery.findFirst.mockResolvedValue({ id: 'delivery-1' });
    whatsappMock.parseWebhook.mockReturnValue({ externalId: 'msg-xyz', status: 'delivered' });

    await service.handleWebhook('whatsapp', { messageId: 'msg-xyz', status: 'DELIVERED' });

    expect(prismaMock.assisteFinanceiroMessageDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'delivered', deliveredAt: expect.any(Date) }),
    });
  });
});

describe('DeliveryRateLimiterService', () => {
  let limiter: DeliveryRateLimiterService;
  let mockRedis: { incr: jest.Mock; expire: jest.Mock; ttl: jest.Mock };

  beforeEach(async () => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        DeliveryRateLimiterService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    limiter = module.get(DeliveryRateLimiterService);
  });

  it('allows first request and sets expiry', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
    expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it('does not reset expiry on subsequent requests', async () => {
    mockRedis.incr.mockResolvedValue(5);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(55);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('blocks when limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(61);
    mockRedis.ttl.mockResolvedValue(120);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(120);
  });
});
