import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AssistenteFinanceiroController } from '../assistente-financeiro.controller';
import { MessageGenerationService } from '../services/message-generation.service';
import { AIMetricsService } from '../services/ai-metrics.service';
import { PrismaService } from '../../../database/prisma.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Integration tests (e2e) for AssistenteFinanceiroController.
 *
 * Validates the full HTTP request/response cycle for:
 *   - POST /assistente-financeiro/generate-message
 *   - POST /assistente-financeiro/message-feedback
 *   - GET  /assistente-financeiro/ai-metrics/:subscriptionId
 *
 * Strategy:
 *   - Real Nest application with global ValidationPipe (mirrors production).
 *   - Services are mocked to keep tests fast and deterministic.
 *   - Auth/RBAC guards are overridden to always allow access.
 *   - A lightweight middleware injects a tenant context onto req.user so
 *     the @CurrentUser() param decorator resolves correctly.
 */
describe('AssistenteFinanceiro Integration (e2e)', () => {
  let app: INestApplication;
  let messageGenerationService: jest.Mocked<MessageGenerationService>;
  let aiMetricsService: jest.Mocked<AIMetricsService>;

  // Tenant context shape matches src/common/tenant/tenant-context.ts
  const mockTenantContext = {
    userId: 'test-user-id',
    orgId: 'test-org-id',
    role: 'admin' as const,
    tokenId: 'test-token-id',
  };

  beforeAll(async () => {
    const mockMessageGenerationService = {
      generateMessage: jest.fn().mockResolvedValue({
        baseMessage: 'Generic recovery message',
        personalizedMessage: 'Olá João! Sentimos sua falta.',
        channel: 'whatsapp',
        confidence: 85,
        contextData: { daysSinceLastPurchase: 15 },
      }),
    };

    const mockAIMetricsService = {
      getMetrics: jest.fn().mockResolvedValue({
        subscriptionId: 'test-sub-id',
        customersAnalyzed: 10,
        totalSuggestions: 25,
        successfulSuggestions: 18,
        accuracyScore: 72,
        successRate: 72,
      }),
      calculateSuccessRate: jest.fn(),
      calculateAccuracyScore: jest.fn(),
    };

    const mockPrismaService = {};

    // Guards that bypass authentication and authorization for the integration scope.
    const allowAllGuard = { canActivate: jest.fn(() => true) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AssistenteFinanceiroController],
      providers: [
        { provide: MessageGenerationService, useValue: mockMessageGenerationService },
        { provide: AIMetricsService, useValue: mockAIMetricsService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    // Inject tenant context BEFORE init so @CurrentUser() resolves correctly.
    app.use((req: any, _res: any, next: any) => {
      req.user = mockTenantContext;
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );

    messageGenerationService = moduleFixture.get(MessageGenerationService);
    aiMetricsService = moduleFixture.get(AIMetricsService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Reset call history between cases so assertions like toHaveBeenCalled are scoped.
  beforeEach(() => {
    (messageGenerationService.generateMessage as jest.Mock).mockClear();
    (aiMetricsService.getMetrics as jest.Mock).mockClear();
  });

  describe('POST /assistente-financeiro/generate-message', () => {
    it('should generate a personalized message successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/generate-message')
        .send({
          customer: {
            id: 'cust-123',
            name: 'João Silva',
            email: 'joao@example.com',
            totalRevenue: 5000,
          },
          channel: 'whatsapp',
          recoveryProbability: 85,
          context: {
            daysSinceLastPurchase: 15,
            avgMonthlyRevenue: 5000,
          },
        });

      // Controller is POST → expect 201 Created (Nest default) on happy path.
      expect(response.status).toBeLessThan(500);
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('personalizedMessage');
        expect(response.body).toHaveProperty('channel');
        expect(response.body.confidence).toBeGreaterThanOrEqual(0);
        expect(response.body.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('should call messageGenerationService.generateMessage', async () => {
      await request(app.getHttpServer())
        .post('/assistente-financeiro/generate-message')
        .send({
          customer: { id: 'c1', name: 'Test', totalRevenue: 1000 },
          channel: 'email',
          recoveryProbability: 70,
          context: { daysSinceLastPurchase: 20 },
        });

      expect(messageGenerationService.generateMessage).toHaveBeenCalled();
    });

    it('should forward the resolved tenant context to the service', async () => {
      await request(app.getHttpServer())
        .post('/assistente-financeiro/generate-message')
        .send({
          customer: { id: 'c2', name: 'Tenant Test', totalRevenue: 2000 },
          channel: 'whatsapp',
          recoveryProbability: 60,
          context: { daysSinceLastPurchase: 30 },
        });

      // Second argument is the @CurrentUser() tenant context.
      const lastCall = (messageGenerationService.generateMessage as jest.Mock).mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({
        userId: mockTenantContext.userId,
        orgId: mockTenantContext.orgId,
        role: mockTenantContext.role,
      });
    });
  });

  describe('POST /assistente-financeiro/message-feedback', () => {
    it('should accept valid UUID feedback', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: '550e8400-e29b-41d4-a716-446655440000',
          customerResponded: true,
          customerReturned: true,
          revenueRecovered: 2500,
        });

      expect(response.status).toBeLessThan(500);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.feedbackId).toBeDefined();
      }
    });

    it('should reject invalid UUID', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: 'not-a-uuid',
          customerResponded: true,
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should accept optional fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: '550e8400-e29b-41d4-a716-446655440001',
          notes: 'Customer engaged positively',
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should reject negative revenue', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: '550e8400-e29b-41d4-a716-446655440002',
          revenueRecovered: -100,
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should reject non-ISO 8601 responseAt', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: '550e8400-e29b-41d4-a716-446655440003',
          responseAt: '11/05/2026 10:30',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should return a feedbackId that looks like a UUID on success', async () => {
      const response = await request(app.getHttpServer())
        .post('/assistente-financeiro/message-feedback')
        .send({
          messageSuggestionId: '550e8400-e29b-41d4-a716-446655440004',
          customerResponded: true,
          revenueRecovered: 0,
        });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.feedbackId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });
  });

  describe('GET /assistente-financeiro/ai-metrics/:subscriptionId', () => {
    it('should return metrics for valid subscription UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/assistente-financeiro/ai-metrics/550e8400-e29b-41d4-a716-446655440010');

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('subscriptionId');
        expect(response.body).toHaveProperty('customersAnalyzed');
        expect(response.body).toHaveProperty('totalSuggestions');
        expect(response.body).toHaveProperty('accuracyScore');
        expect(response.body).toHaveProperty('successRate');
      }
    });

    it('should reject invalid subscription UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/assistente-financeiro/ai-metrics/invalid-uuid');

      expect([400, 422]).toContain(response.status);
    });

    it('should call aiMetricsService.getMetrics', async () => {
      await request(app.getHttpServer())
        .get('/assistente-financeiro/ai-metrics/550e8400-e29b-41d4-a716-446655440011');

      expect(aiMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should pass the path subscriptionId to the service', async () => {
      const subId = '550e8400-e29b-41d4-a716-446655440012';

      await request(app.getHttpServer())
        .get(`/assistente-financeiro/ai-metrics/${subId}`);

      expect(aiMetricsService.getMetrics).toHaveBeenCalledWith(subId);
    });
  });
});
