import { Test, TestingModule } from '@nestjs/testing';
import { AIMetricsService } from '../services/ai-metrics.service';
import { PrismaService } from '../../../database/prisma.service';

describe('AIMetricsService', () => {
  let service: AIMetricsService;

  beforeEach(async () => {
    const mockPrisma = {
      messageSuggestion: { findMany: jest.fn(), count: jest.fn() },
      messageFeedback: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIMetricsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AIMetricsService>(AIMetricsService);
  });

  describe('calculateSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      expect(service.calculateSuccessRate(7, 10)).toBe(70);
    });

    it('should handle zero attempts', () => {
      expect(service.calculateSuccessRate(0, 0)).toBe(0);
    });

    it('should round to integer', () => {
      expect(service.calculateSuccessRate(1, 3)).toBe(33);
    });

    it('should handle 100% success', () => {
      expect(service.calculateSuccessRate(10, 10)).toBe(100);
    });
  });

  describe('calculateAccuracyScore', () => {
    it('should return default accuracy for new subscription', async () => {
      const score = await service.calculateAccuracyScore('test-sub-id');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getMetrics', () => {
    it('should return complete metrics object', async () => {
      const metrics = await service.getMetrics('test-sub-id');
      expect(metrics).toHaveProperty('subscriptionId', 'test-sub-id');
      expect(metrics).toHaveProperty('customersAnalyzed');
      expect(metrics).toHaveProperty('totalSuggestions');
      expect(metrics).toHaveProperty('successfulSuggestions');
      expect(metrics).toHaveProperty('accuracyScore');
      expect(metrics).toHaveProperty('successRate');
    });
  });
});
