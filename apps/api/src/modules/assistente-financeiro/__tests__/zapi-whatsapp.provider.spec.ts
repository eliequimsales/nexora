import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import type { DeliveryRequest } from '../providers/message-delivery-provider.interface';

jest.mock('axios');

describe('ZapiWhatsappProvider', () => {
  let provider: ZapiWhatsappProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZapiWhatsappProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config: Record<string, any> = {
                'zapi.instanceId': 'test-instance-123',
                'zapi.token': 'test-token-abc',
                'zapi.clientToken': 'test-client-token-xyz',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<ZapiWhatsappProvider>(ZapiWhatsappProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('channel', () => {
    it('should be whatsapp', () => {
      expect(provider.channel).toBe('whatsapp');
    });
  });

  describe('send', () => {
    it('should send message successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { messageId: 'msg-xyz-123' },
      });

      const result = await provider.send({
        recipient: '+5585999999999',
        message: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.externalId).toBe('msg-xyz-123');
    });

    it('should return retryable on 5xx', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 502 },
        message: 'Bad Gateway',
      });

      const result = await provider.send({
        recipient: '+5585999999999',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should return retryable on 429', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 429 },
        message: 'Too Many',
      });

      const result = await provider.send({
        recipient: '+5585999999999',
        message: 'Hello',
      });

      expect(result.retryable).toBe(true);
    });

    it('should not be retryable on 4xx', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 400 },
        message: 'Bad',
      });

      const result = await provider.send({
        recipient: 'invalid',
        message: 'Hello',
      });

      expect(result.retryable).toBe(false);
    });

    it('should not be retryable when not configured', async () => {
      const noConfigModule = await Test.createTestingModule({
        providers: [
          ZapiWhatsappProvider,
          {
            provide: ConfigService,
            useValue: { get: () => null },
          },
        ],
      }).compile();

      const noConfigProvider = noConfigModule.get<ZapiWhatsappProvider>(
        ZapiWhatsappProvider,
      );

      const result = await noConfigProvider.send({
        recipient: '+5585999999999',
        message: 'Hello',
      });

      expect(result.retryable).toBe(false);
      expect(result.error).toBe('provider_not_configured');
    });
  });

  describe('parseWebhook', () => {
    it('should parse DELIVERED', () => {
      const result = provider.parseWebhook({
        messageId: 'msg-123',
        status: 'DELIVERED',
      });
      expect(result?.status).toBe('delivered');
    });

    it('should parse READ', () => {
      const result = provider.parseWebhook({
        messageId: 'msg-456',
        status: 'READ',
      });
      expect(result?.status).toBe('read');
    });

    it('should parse FAILED', () => {
      const result = provider.parseWebhook({
        messageId: 'msg-789',
        status: 'FAILED',
      });
      expect(result?.status).toBe('failed');
    });

    it('should parse SENT', () => {
      const result = provider.parseWebhook({
        messageId: 'msg-999',
        status: 'SENT',
      });
      expect(result?.status).toBe('sent');
    });

    it('should return null for missing messageId', () => {
      expect(provider.parseWebhook({ status: 'DELIVERED' })).toBeNull();
    });

    it('should return null for missing status', () => {
      expect(provider.parseWebhook({ messageId: 'msg-123' })).toBeNull();
    });

    it('should return null for unknown status', () => {
      expect(
        provider.parseWebhook({
          messageId: 'msg-123',
          status: 'UNKNOWN',
        }),
      ).toBeNull();
    });

    it('should return null for null payload', () => {
      expect(provider.parseWebhook(null)).toBeNull();
    });

    it('should return null for string payload', () => {
      expect(provider.parseWebhook('string')).toBeNull();
    });

    it('should handle case-insensitive status', () => {
      const result = provider.parseWebhook({
        messageId: 'msg-123',
        status: 'delivered',
      });
      expect(result?.status).toBe('delivered');
    });
  });
});
