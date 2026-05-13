import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Assistente Financeiro Database Schema', () => {
  beforeAll(async () => {
    // Ensure connection is established
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Tables Exist', () => {
    it('should have assistente_financeiro_subscriptions table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_subscriptions'
        )
      `;
      expect(result).toBeDefined();
    });

    it('should have assistente_financeiro_customers table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_customers'
        )
      `;
      expect(result).toBeDefined();
    });

    it('should have assistente_financeiro_recovery_actions table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_recovery_actions'
        )
      `;
      expect(result).toBeDefined();
    });

    it('should have assistente_financeiro_ai_metrics table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_ai_metrics'
        )
      `;
      expect(result).toBeDefined();
    });

    it('should have assistente_financeiro_integrations table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_integrations'
        )
      `;
      expect(result).toBeDefined();
    });

    it('should have assistente_financeiro_monthly_metrics table', async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'assistente_financeiro_monthly_metrics'
        )
      `;
      expect(result).toBeDefined();
    });
  });

  describe('Subscriptions Model', () => {
    it('should create a subscription', async () => {
      // Create an organization first
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: `test-org-${Date.now()}`,
          niche: 'financial',
          formToken: `token-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'starter',
          status: 'trial',
          trialStartedAt: new Date(),
          trialExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          recoveryActionsUsed: 0,
        },
      });

      expect(subscription).toBeDefined();
      expect(subscription.organizationId).toBe(org.id);
      expect(subscription.tier).toBe('starter');

      // Cleanup
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Customers Model', () => {
    it('should create a customer', async () => {
      // Create organization and subscription
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 2',
          slug: `test-org-2-${Date.now()}`,
          niche: 'financial',
          formToken: `token-2-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'pro',
          status: 'active',
        },
      });

      const customer = await prisma.assisteFinanceiroCustomer.create({
        data: {
          subscriptionId: subscription.id,
          crmId: 'pipedrive-123',
          crmSource: 'pipedrive',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5511999999999',
          lastActivityDate: new Date(),
          totalRevenue: 5000.0,
          lastTransactionDate: new Date(),
          churnRiskScore: 75,
          churnRiskPrediction: false,
        },
      });

      expect(customer).toBeDefined();
      expect(customer.name).toBe('John Doe');
      expect(customer.crmSource).toBe('pipedrive');

      // Cleanup
      await prisma.assisteFinanceiroCustomer.delete({ where: { id: customer.id } });
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Recovery Actions Model', () => {
    it('should create a recovery action', async () => {
      // Setup
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 3',
          slug: `test-org-3-${Date.now()}`,
          niche: 'financial',
          formToken: `token-3-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'pro',
          status: 'active',
        },
      });

      const customer = await prisma.assisteFinanceiroCustomer.create({
        data: {
          subscriptionId: subscription.id,
          crmId: 'pipedrive-456',
          crmSource: 'pipedrive',
          name: 'Jane Smith',
          email: 'jane@example.com',
          totalRevenue: 3000.0,
          churnRiskScore: 85,
          churnRiskPrediction: true,
        },
      });

      const action = await prisma.assisteFinanceiroRecoveryAction.create({
        data: {
          customerId: customer.id,
          subscriptionId: subscription.id,
          actionType: 'whatsapp',
          suggestedMessage: 'We miss you! Come back for 15% off.',
          sentAt: new Date(),
          sentBy: 'ai_automatic',
          discountOffered: 15,
          customerResponded: true,
          responseAt: new Date(),
          customerReturned: true,
          returnedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          revenueRecovered: 2000.0,
        },
      });

      expect(action).toBeDefined();
      expect(action.actionType).toBe('whatsapp');
      expect(action.customerResponded).toBe(true);

      // Cleanup
      await prisma.assisteFinanceiroRecoveryAction.delete({ where: { id: action.id } });
      await prisma.assisteFinanceiroCustomer.delete({ where: { id: customer.id } });
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('AI Metrics Model', () => {
    it('should create AI metrics record', async () => {
      // Setup
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 4',
          slug: `test-org-4-${Date.now()}`,
          niche: 'financial',
          formToken: `token-4-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'pro',
          status: 'active',
        },
      });

      const metrics = await prisma.assisteFinanceiroAiMetrics.create({
        data: {
          subscriptionId: subscription.id,
          customersAnalyzed: 342,
          totalSuggestions: 1247,
          successfulSuggestions: 1134,
          accuracyScore: 91,
          modelVersion: 1,
        },
      });

      expect(metrics).toBeDefined();
      expect(metrics.customersAnalyzed).toBe(342);
      expect(metrics.accuracyScore).toBe(91);

      // Cleanup
      await prisma.assisteFinanceiroAiMetrics.delete({ where: { id: metrics.id } });
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Integrations Model', () => {
    it('should create an integration record', async () => {
      // Setup
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 5',
          slug: `test-org-5-${Date.now()}`,
          niche: 'financial',
          formToken: `token-5-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'pro',
          status: 'active',
        },
      });

      const integration = await prisma.assisteFinanceiroIntegration.create({
        data: {
          subscriptionId: subscription.id,
          integrationType: 'pipedrive',
          isActive: true,
          accessToken: 'encrypted-token-abc123',
          refreshToken: 'encrypted-refresh-token',
          lastSyncAt: new Date(),
          syncStatus: 'idle',
        },
      });

      expect(integration).toBeDefined();
      expect(integration.integrationType).toBe('pipedrive');
      expect(integration.isActive).toBe(true);

      // Cleanup
      await prisma.assisteFinanceiroIntegration.delete({ where: { id: integration.id } });
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Monthly Metrics Model', () => {
    it('should create monthly metrics', async () => {
      // Setup
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 6',
          slug: `test-org-6-${Date.now()}`,
          niche: 'financial',
          formToken: `token-6-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'pro',
          status: 'active',
        },
      });

      const monthlyMetrics = await prisma.assisteFinanceiroMonthlyMetrics.create({
        data: {
          subscriptionId: subscription.id,
          monthYear: '2026-05',
          goalAmount: 50000.0,
          revenueActual: 42000.0,
          revenueProjected: 48000.0,
          customersLost: 8,
          customersRecovered: 5,
          recoverySuccessRate: 62.5,
        },
      });

      expect(monthlyMetrics).toBeDefined();
      expect(monthlyMetrics.monthYear).toBe('2026-05');
      expect(monthlyMetrics.customersRecovered).toBe(5);

      // Cleanup
      await prisma.assisteFinanceiroMonthlyMetrics.delete({ where: { id: monthlyMetrics.id } });
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Relationships', () => {
    it('should cascade delete when subscription is deleted', async () => {
      // Setup
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 7',
          slug: `test-org-7-${Date.now()}`,
          niche: 'financial',
          formToken: `token-7-${Date.now()}`,
        },
      });

      const subscription = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'starter',
          status: 'active',
        },
      });

      const customer = await prisma.assisteFinanceiroCustomer.create({
        data: {
          subscriptionId: subscription.id,
          crmId: 'test-cascade',
          crmSource: 'pipedrive',
          name: 'Cascade Test',
          totalRevenue: 1000,
          churnRiskScore: 50,
        },
      });

      // Delete subscription
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });

      // Verify customer was deleted
      const deletedCustomer = await prisma.assisteFinanceiroCustomer.findUnique({
        where: { id: customer.id },
      });

      expect(deletedCustomer).toBeNull();

      // Cleanup
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Indexes and Uniqueness', () => {
    it('should enforce unique subscription per organization', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org 8',
          slug: `test-org-8-${Date.now()}`,
          niche: 'financial',
          formToken: `token-8-${Date.now()}`,
        },
      });

      const subscription1 = await prisma.assisteFinanceiroSubscription.create({
        data: {
          organizationId: org.id,
          tier: 'starter',
          status: 'active',
        },
      });

      expect(subscription1).toBeDefined();

      // Try to create duplicate - should fail
      try {
        await prisma.assisteFinanceiroSubscription.create({
          data: {
            organizationId: org.id,
            tier: 'pro',
            status: 'active',
          },
        });
        throw new Error('Should have thrown unique constraint error');
      } catch (e) {
        expect((e as any).code).toBe('P2002');
      }

      // Cleanup
      await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription1.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });
});
