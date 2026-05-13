import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ResendEmailProvider } from '../providers/resend-email.provider';

jest.mock('axios');

describe('ResendEmailProvider', () => {
  let provider: ResendEmailProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendEmailProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config: Record<string, any> = {
                'resend.apiKey': 're_test_key_123',
                'resend.fromEmail': 'recovery@assistente.com',
                'resend.fromName': 'Assistente Financeiro',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<ResendEmailProvider>(ResendEmailProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('channel', () => {
    it('should be email', () => {
      expect(provider.channel).toBe('email');
    });
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { id: 'email-xyz-789' },
      });

      const result = await provider.send({
        recipient: 'joao@example.com',
        message: 'Olá João, voltamos a falar!',
        subject: 'Recuperação de cliente',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.externalId).toBe('email-xyz-789');
    });

    it('should return retryable on 5xx', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 502 },
        message: 'Bad Gateway',
      });

      const result = await provider.send({
        recipient: 'joao@example.com',
        message: 'Test',
        subject: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should return retryable on 429', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 429 },
        message: 'Too Many Requests',
      });

      const result = await provider.send({
        recipient: 'joao@example.com',
        message: 'Test',
        subject: 'Test',
      });

      expect(result.retryable).toBe(true);
    });

    it('should not be retryable on 4xx', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { status: 422 },
        message: 'Invalid email',
      });

      const result = await provider.send({
        recipient: 'bad-email',
        message: 'Test',
        subject: 'Test',
      });

      expect(result.retryable).toBe(false);
    });

    it('should not be retryable when not configured', async () => {
      const noConfigModule = await Test.createTestingModule({
        providers: [
          ResendEmailProvider,
          {
            provide: ConfigService,
            useValue: { get: () => null },
          },
        ],
      }).compile();

      const noConfigProvider = noConfigModule.get<ResendEmailProvider>(
        ResendEmailProvider,
      );

      const result = await noConfigProvider.send({
        recipient: 'test@example.com',
        message: 'Test',
        subject: 'Test',
      });

      expect(result.retryable).toBe(false);
      expect(result.error).toBe('provider_not_configured');
    });
  });

  describe('parseWebhook', () => {
    it('should parse email.sent', () => {
      const result = provider.parseWebhook({
        type: 'email.sent',
        data: { email_id: 'email-123' },
      });
      expect(result?.status).toBe('sent');
    });

    it('should parse email.delivered', () => {
      const result = provider.parseWebhook({
        type: 'email.delivered',
        data: { email_id: 'email-456' },
      });
      expect(result?.status).toBe('delivered');
    });

    it('should parse email.opened', () => {
      const result = provider.parseWebhook({
        type: 'email.opened',
        data: { email_id: 'email-789' },
      });
      expect(result?.status).toBe('read');
    });

    it('should parse email.bounced', () => {
      const result = provider.parseWebhook({
        type: 'email.bounced',
        data: { email_id: 'email-bounce' },
      });
      expect(result?.status).toBe('bounced');
    });

    it('should parse email.failed', () => {
      const result = provider.parseWebhook({
        type: 'email.failed',
        data: { email_id: 'email-fail' },
      });
      expect(result?.status).toBe('failed');
    });

    it('should return null for unknown event type', () => {
      expect(
        provider.parseWebhook({
          type: 'email.unknown',
          data: { email_id: 'x' },
        }),
      ).toBeNull();
    });

    it('should return null for missing email_id', () => {
      expect(
        provider.parseWebhook({
          type: 'email.delivered',
          data: {},
        }),
      ).toBeNull();
    });

    it('should return null for null payload', () => {
      expect(provider.parseWebhook(null)).toBeNull();
    });

    it('should return null for string payload', () => {
      expect(provider.parseWebhook('string')).toBeNull();
    });
  });
});
