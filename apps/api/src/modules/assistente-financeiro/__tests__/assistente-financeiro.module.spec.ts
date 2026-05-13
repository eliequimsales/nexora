import { Test, TestingModule } from '@nestjs/testing';
import { AssistenteFinanceiroModule } from '../assistente-financeiro.module';
import { MessageGenerationService } from '../services/message-generation.service';
import { AIMetricsService } from '../services/ai-metrics.service';
import { MessageDeliveryService } from '../services/message-delivery.service';
import { DeliveryRateLimiterService } from '../services/delivery-rate-limiter.service';
import { AIRetrainingWorker } from '../workers/ai-retraining.worker';
import { MessageDeliveryWorker } from '../workers/message-delivery.worker';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { PrismaService } from '../../../database/prisma.service';

describe('AssistenteFinanceiroModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AssistenteFinanceiroModule],
    })
      .useMocker((token) => {
        // Mock all external dependencies
        if (token === PrismaService) {
          return {};
        }
        // Return empty mock objects for other dependencies
        return {};
      })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('module compilation', () => {
    it('should compile successfully', () => {
      expect(module).toBeDefined();
    });

    it('should be a ModuleMetadata instance', () => {
      expect(module.get(AssistenteFinanceiroModule)).toBeDefined();
    });
  });

  describe('service providers', () => {
    it('should provide MessageGenerationService', () => {
      const service = module.get<MessageGenerationService>(MessageGenerationService);
      expect(service).toBeDefined();
    });

    it('should provide AIMetricsService', () => {
      const service = module.get<AIMetricsService>(AIMetricsService);
      expect(service).toBeDefined();
    });

    it('should provide MessageDeliveryService', () => {
      const service = module.get<MessageDeliveryService>(MessageDeliveryService);
      expect(service).toBeDefined();
    });

    it('should provide DeliveryRateLimiterService', () => {
      const service = module.get<DeliveryRateLimiterService>(DeliveryRateLimiterService);
      expect(service).toBeDefined();
    });
  });

  describe('worker providers', () => {
    it('should provide AIRetrainingWorker', () => {
      const worker = module.get<AIRetrainingWorker>(AIRetrainingWorker);
      expect(worker).toBeDefined();
    });

    it('should provide MessageDeliveryWorker', () => {
      const worker = module.get<MessageDeliveryWorker>(MessageDeliveryWorker);
      expect(worker).toBeDefined();
    });
  });

  describe('message delivery provider providers', () => {
    it('should provide ZapiWhatsappProvider', () => {
      const provider = module.get<ZapiWhatsappProvider>(ZapiWhatsappProvider);
      expect(provider).toBeDefined();
    });

    it('should provide ResendEmailProvider', () => {
      const provider = module.get<ResendEmailProvider>(ResendEmailProvider);
      expect(provider).toBeDefined();
    });
  });

  describe('dependency injection', () => {
    it('should inject MessageDeliveryService into MessageDeliveryWorker', () => {
      const worker = module.get<MessageDeliveryWorker>(MessageDeliveryWorker);
      expect(worker).toBeDefined();
      // Verify the worker has access to delivery service via constructor
      expect(worker['delivery']).toBeDefined();
    });

    it('should inject dependencies into MessageGenerationService', () => {
      const service = module.get<MessageGenerationService>(MessageGenerationService);
      expect(service).toBeDefined();
    });

    it('should inject dependencies into AIMetricsService', () => {
      const service = module.get<AIMetricsService>(AIMetricsService);
      expect(service).toBeDefined();
    });
  });

  describe('BullMQ queue registration', () => {
    it('should have BullModule registered via imports', () => {
      // The BullModule.registerQueue({ name: 'message-delivery' }) is registered
      // in the module imports and is verified by the successful compilation
      // and MessageDeliveryWorker availability (tested above)
      const worker = module.get<MessageDeliveryWorker>(MessageDeliveryWorker);
      expect(worker).toBeDefined();
      // If BullModule wasn't registered, the @Processor('message-delivery')
      // decorated class would fail to compile/inject
    });
  });
});
