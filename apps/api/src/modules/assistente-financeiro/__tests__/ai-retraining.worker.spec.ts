import { Test, TestingModule } from '@nestjs/testing';
import { AIRetrainingWorker } from '../workers/ai-retraining.worker';
import { AIMetricsService } from '../services/ai-metrics.service';
import { PrismaService } from '../../../database/prisma.service';

describe('AIRetrainingWorker', () => {
  let worker: AIRetrainingWorker;
  let aiMetricsService: AIMetricsService;

  beforeEach(async () => {
    const mockPrisma = {};
    const mockMetricsService = {
      getMetrics: jest.fn().mockResolvedValue({
        subscriptionId: 'test-sub-id',
        customersAnalyzed: 10,
        totalSuggestions: 20,
        successfulSuggestions: 15,
        accuracyScore: 75,
        successRate: 75,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIRetrainingWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AIMetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    worker = module.get<AIRetrainingWorker>(AIRetrainingWorker);
    aiMetricsService = module.get<AIMetricsService>(AIMetricsService);
  });

  describe('retrainAll', () => {
    it('should complete without errors when no subscriptions exist', async () => {
      await expect(worker.retrainAll()).resolves.not.toThrow();
    });

    it('should not call getMetrics when there are no subscriptions', async () => {
      await worker.retrainAll();
      expect(aiMetricsService.getMetrics).not.toHaveBeenCalled();
    });
  });

  describe('retrainSubscription', () => {
    it('should call getMetrics for the given subscription', async () => {
      await worker.retrainSubscription('sub-123');
      expect(aiMetricsService.getMetrics).toHaveBeenCalledWith('sub-123');
    });

    it('should propagate errors from getMetrics', async () => {
      (aiMetricsService.getMetrics as jest.Mock).mockRejectedValueOnce(
        new Error('metrics failure'),
      );
      await expect(worker.retrainSubscription('sub-err')).rejects.toThrow('metrics failure');
    });
  });

  describe('retrainNow', () => {
    it('should retrain a specific subscription', async () => {
      await worker.retrainNow('sub-456');
      expect(aiMetricsService.getMetrics).toHaveBeenCalledWith('sub-456');
    });
  });
});
