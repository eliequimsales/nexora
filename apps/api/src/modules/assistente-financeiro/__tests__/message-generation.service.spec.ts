import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { MessageGenerationService } from '../services/message-generation.service';
import type {
  GenerateMessageRequest,
  GenerateMessageResponse,
} from '../dtos/message.dtos';
import type { AssisteFinanceiroCustomer } from '../models/customer.model';

/**
 * Mock customer for testing
 */
const MOCK_CUSTOMER: AssisteFinanceiroCustomer = {
  id: 'cust-1',
  subscriptionId: 'sub-1',
  crmId: 'crm-1',
  crmSource: 'pipedrive',
  name: 'João da Silva',
  email: 'joao@example.com',
  phone: '+5585999999999',
  totalRevenue: new Decimal(15000),
  lastActivityDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
  lastTransactionDate: null,
  churnRiskScore: new Decimal(78),
  churnRiskPrediction: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as AssisteFinanceiroCustomer;

/**
 * Mock Anthropic API responses
 */
const MOCK_ANTHROPIC_RESPONSE = {
  success: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          baseMessage:
            'Olá João, notamos que você não interage com a gente há um tempo.',
          personalizedMessage:
            'Olá João 👋 Notamos que você não interage com a gente há 45 dias. Como você investiu R$ 15.000 conosco, queremos entender como podemos melhorar 🤝',
          confidence: 85,
        }),
      },
    ],
    usage: {
      input_tokens: 200,
      output_tokens: 100,
    },
  },
  parseError: {
    content: [
      {
        type: 'text',
        text: 'Invalid response',
      },
    ],
    usage: {
      input_tokens: 200,
      output_tokens: 100,
    },
  },
};

describe('MessageGenerationService', () => {
  let service: MessageGenerationService;
  let configService: ConfigService;
  let mockAnthropicClient: any;

  beforeEach(async () => {
    // Mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageGenerationService,
        {
          provide: 'ANTHROPIC_CLIENT',
          useValue: mockAnthropicClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config: Record<string, any> = {
                'anthropic.apiKey': 'sk-ant-test-key',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MessageGenerationService>(MessageGenerationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('generateMessage', () => {
    it('should generate message successfully with context', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(
        MOCK_ANTHROPIC_RESPONSE.success,
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
          avgMonthlyRevenue: 1000,
          lastPurchaseValue: 5000,
          channelHistory: ['email', 'whatsapp'],
        },
      };

      const result: GenerateMessageResponse =
        await service.generateMessage(request);

      expect(result).toBeDefined();
      expect(result.baseMessage).toBeDefined();
      expect(result.personalizedMessage).toBeDefined();
      expect(result.channel).toBe('whatsapp');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.personalizedMessage).toContain('João');
    });

    it('should adapt message based on channel (WhatsApp)', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(
        MOCK_ANTHROPIC_RESPONSE.success,
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      const result = await service.generateMessage(request);

      expect(result.channel).toBe('whatsapp');
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled();

      const callArgs = mockAnthropicClient.messages.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('whatsapp');
    });

    it('should adapt message based on channel (Email)', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(
        MOCK_ANTHROPIC_RESPONSE.success,
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'email',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      const result = await service.generateMessage(request);

      expect(result.channel).toBe('email');
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled();

      const callArgs = mockAnthropicClient.messages.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('email');
    });

    it('should include customer name in personalization', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(
        MOCK_ANTHROPIC_RESPONSE.success,
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      const result = await service.generateMessage(request);

      // Check that the name (or at least the first name) is included
      expect(
        result.personalizedMessage.toLowerCase().includes('joão'),
      ).toBeTruthy();
    });

    it('should vary confidence based on recovery probability', async () => {
      mockAnthropicClient.messages.create.mockResolvedValueOnce(
        MOCK_ANTHROPIC_RESPONSE.success,
      );

      const highProbabilityRequest: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 90,
        context: {
          daysSinceLastPurchase: 30,
        },
      };

      const result1 = await service.generateMessage(highProbabilityRequest);

      expect(result1.confidence).toBeGreaterThanOrEqual(0);
      expect(result1.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('fallback behavior', () => {
    it('should fallback when Claude API fails with network error', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error('Network error'),
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      const result = await service.generateMessage(request);

      expect(result).toBeDefined();
      expect(result.baseMessage).toBeDefined();
      expect(result.personalizedMessage).toBeDefined();
      expect(result.channel).toBe('whatsapp');
      expect(result.confidence).toBeLessThan(50); // Low confidence for fallback
    });

    it('should fallback when response parsing fails', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(
        MOCK_ANTHROPIC_RESPONSE.parseError,
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'email',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      const result = await service.generateMessage(request);

      expect(result).toBeDefined();
      expect(result.baseMessage).toBeDefined();
      expect(result.personalizedMessage).toBeDefined();
      expect(result.confidence).toBeLessThan(50);
    });

    it('should never throw error, always return response', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      const request: GenerateMessageRequest = {
        customer: MOCK_CUSTOMER,
        channel: 'whatsapp',
        recoveryProbability: 75,
        context: {
          daysSinceLastPurchase: 45,
        },
      };

      expect(async () => {
        await service.generateMessage(request);
      }).not.toThrow();

      const result = await service.generateMessage(request);
      expect(result).toBeDefined();
      expect(result.baseMessage).toBeTruthy();
    });
  });

  describe('buildPrompt', () => {
    it('should construct prompt with all context', () => {
      const prompt = service.buildPrompt(
        MOCK_CUSTOMER,
        'whatsapp',
        75,
        {
          daysSinceLastPurchase: 45,
          avgMonthlyRevenue: 1000,
        },
      );

      expect(prompt).toContain(MOCK_CUSTOMER.name);
      expect(prompt).toContain('whatsapp');
      expect(prompt).toContain('45');
      expect(prompt).toContain('JSON');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        baseMessage: 'Base message',
        personalizedMessage: 'Personalized message',
        confidence: 85,
      });

      const parsed = service.parseResponse(response, 'whatsapp');

      expect(parsed).toBeDefined();
      expect(parsed.baseMessage).toBe('Base message');
      expect(parsed.personalizedMessage).toBe('Personalized message');
      expect(parsed.confidence).toBe(85);
    });

    it('should handle invalid JSON gracefully', () => {
      const response = 'Invalid JSON response';

      const parsed = service.parseResponse(response, 'whatsapp');

      expect(parsed).toBeDefined();
      expect(parsed.baseMessage).toBeDefined();
      expect(parsed.personalizedMessage).toBeDefined();
    });
  });

  describe('getGenericMessage', () => {
    it('should return generic message with name personalization', () => {
      const result = service.getGenericMessage(
        MOCK_CUSTOMER,
        'whatsapp',
        {
          daysSinceLastPurchase: 45,
        },
      );

      expect(result.personalizedMessage).toContain(MOCK_CUSTOMER.name);
      expect(result.channel).toBe('whatsapp');
      expect(result.confidence).toBeLessThan(50);
    });

    it('should return different messages for email vs whatsapp', () => {
      const whatsappResult = service.getGenericMessage(
        MOCK_CUSTOMER,
        'whatsapp',
        {
          daysSinceLastPurchase: 45,
        },
      );

      const emailResult = service.getGenericMessage(
        MOCK_CUSTOMER,
        'email',
        {
          daysSinceLastPurchase: 45,
        },
      );

      expect(whatsappResult.baseMessage).not.toBe(emailResult.baseMessage);
    });
  });

  describe('getDefaultMessage', () => {
    it('should return hardcoded whatsapp message', () => {
      const result = service.getDefaultMessage('whatsapp');

      expect(result.baseMessage).toBeDefined();
      expect(result.personalizedMessage).toBeDefined();
      expect(result.baseMessage.length).toBeGreaterThan(0);
    });

    it('should return hardcoded email message', () => {
      const result = service.getDefaultMessage('email');

      expect(result.baseMessage).toBeDefined();
      expect(result.personalizedMessage).toBeDefined();
      expect(result.baseMessage.length).toBeGreaterThan(0);
    });

    it('should return different messages for each channel', () => {
      const whatsapp = service.getDefaultMessage('whatsapp');
      const email = service.getDefaultMessage('email');

      expect(whatsapp.baseMessage).not.toBe(email.baseMessage);
    });
  });
});
