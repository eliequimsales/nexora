import { PrismaClient } from '@nexora/api-prisma';

const prisma = new PrismaClient();

/**
 * Helper to create test setup (org, subscription, customer, message suggestion)
 */
async function createTestSetup(overrides: {
  orgName?: string;
  tier?: string;
  customerName?: string;
  crmId?: string;
} = {}) {
  const {
    orgName = 'Test Org',
    tier = 'pro',
    customerName = 'Test Customer',
    crmId = `pd-${Date.now()}`,
  } = overrides;

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: `test-org-${Date.now()}-${Math.random()}`,
      niche: 'financial',
      formToken: `token-${Date.now()}`,
    },
  });

  const subscription = await prisma.assisteFinanceiroSubscription.create({
    data: {
      organizationId: org.id,
      tier: tier as 'starter' | 'pro',
      status: 'active',
    },
  });

  const customer = await prisma.assisteFinanceiroCustomer.create({
    data: {
      subscriptionId: subscription.id,
      crmId,
      crmSource: 'pipedrive',
      name: customerName,
    },
  });

  const suggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
    data: {
      customerId: customer.id,
      channel: 'whatsapp',
      baseMessage: 'Base message',
      personalizedMessage: 'Personalized message',
      confidence: 80,
    },
  });

  return { org, subscription, customer, suggestion };
}

/**
 * Helper to cleanup test resources
 */
async function cleanupTestSetup(
  feedbackIds: string[],
  suggestionIds: string[],
  customerId: string,
  subscriptionId: string,
  orgId: string
) {
  if (feedbackIds.length > 0) {
    await prisma.assisteFinanceiroMessageFeedback.deleteMany({
      where: { id: { in: feedbackIds } },
    });
  }
  if (suggestionIds.length > 0) {
    await prisma.assisteFinanceiroMessageSuggestion.deleteMany({
      where: { id: { in: suggestionIds } },
    });
  }
  await prisma.assisteFinanceiroCustomer.delete({ where: { id: customerId } });
  await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscriptionId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

describe('MessageFeedback Model', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create feedback with all fields', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'João Silva',
      crmId: 'pd-123',
    });

    const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        customerResponded: true,
        responseAt: new Date('2026-05-11T10:30:00Z'),
        customerReturned: true,
        returnedAt: new Date('2026-05-11T15:00:00Z'),
        revenueRecovered: 150.5,
        notes: 'Customer responded positively and made a purchase',
      },
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.messageSuggestionId).toBe(suggestion.id);
    expect(feedback.customerResponded).toBe(true);
    expect(feedback.responseAt).toEqual(new Date('2026-05-11T10:30:00Z'));
    expect(feedback.customerReturned).toBe(true);
    expect(feedback.returnedAt).toEqual(new Date('2026-05-11T15:00:00Z'));
    expect(feedback.revenueRecovered.toNumber()).toBe(150.5);
    expect(feedback.notes).toBe('Customer responded positively and made a purchase');
    expect(feedback.createdAt).toBeDefined();

    await cleanupTestSetup([feedback.id], [suggestion.id], customer.id, subscription.id, org.id);
  });

  it('should track message effectiveness (response and return tracking)', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'Maria Santos',
      crmId: 'pd-456',
    });

    // Case 1: Response without return
    const feedback1 = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        customerResponded: true,
        responseAt: new Date('2026-05-10T12:00:00Z'),
        customerReturned: false,
        revenueRecovered: 0,
      },
    });

    expect(feedback1.customerResponded).toBe(true);
    expect(feedback1.responseAt).toBeDefined();
    expect(feedback1.customerReturned).toBe(false);
    expect(feedback1.revenueRecovered.toNumber()).toBe(0);

    // Case 2: Return without response (customer returned but didn't respond)
    const suggestion2 = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'email',
        baseMessage: 'Email base',
        personalizedMessage: 'Email personalized',
        confidence: 75,
      },
    });

    const feedback2 = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion2.id,
        customerResponded: false,
        customerReturned: true,
        returnedAt: new Date('2026-05-11T14:30:00Z'),
        revenueRecovered: 200.0,
      },
    });

    expect(feedback2.customerResponded).toBe(false);
    expect(feedback2.customerReturned).toBe(true);
    expect(feedback2.returnedAt).toBeDefined();
    expect(feedback2.revenueRecovered.toNumber()).toBe(200.0);

    await cleanupTestSetup(
      [feedback1.id, feedback2.id],
      [suggestion.id, suggestion2.id],
      customer.id,
      subscription.id,
      org.id
    );
  });

  it('should allow null feedback fields', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'Test User',
      crmId: 'pd-789',
    });

    const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
      },
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.messageSuggestionId).toBe(suggestion.id);
    expect(feedback.customerResponded).toBeNull();
    expect(feedback.responseAt).toBeNull();
    expect(feedback.customerReturned).toBeNull();
    expect(feedback.returnedAt).toBeNull();
    expect(feedback.revenueRecovered.toNumber()).toBe(0);
    expect(feedback.notes).toBeNull();
    expect(feedback.createdAt).toBeDefined();

    await cleanupTestSetup([feedback.id], [suggestion.id], customer.id, subscription.id, org.id);
  });

  it('should enforce revenueRecovered default to 0', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'Default Test',
      crmId: 'pd-default',
    });

    const feedback1 = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        customerResponded: true,
      },
    });

    const feedback2 = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        revenueRecovered: 500.75,
      },
    });

    expect(feedback1.revenueRecovered.toNumber()).toBe(0);
    expect(feedback2.revenueRecovered.toNumber()).toBe(500.75);

    await cleanupTestSetup(
      [feedback1.id, feedback2.id],
      [suggestion.id],
      customer.id,
      subscription.id,
      org.id
    );
  });

  it('should have relationship to message suggestion', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'Relationship Test',
      crmId: 'pd-relation',
    });

    const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        customerResponded: true,
        revenueRecovered: 250.0,
      },
    });

    const loaded = await prisma.assisteFinanceiroMessageFeedback.findUnique({
      where: { id: feedback.id },
      include: { messageSuggestion: true },
    });

    expect(loaded).toBeDefined();
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.messageSuggestion).toBeDefined();
      expect(loaded.messageSuggestion.id).toBe(suggestion.id);
      expect(loaded.messageSuggestion.customerId).toBe(customer.id);
    }

    await cleanupTestSetup([feedback.id], [suggestion.id], customer.id, subscription.id, org.id);
  });

  it('should cascade delete when suggestion is deleted', async () => {
    const { customer, subscription, org, suggestion } = await createTestSetup({
      customerName: 'Cascade Test',
      crmId: 'pd-cascade',
    });

    const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
      data: {
        messageSuggestionId: suggestion.id,
        customerResponded: true,
        revenueRecovered: 100.0,
      },
    });

    // Delete suggestion - feedback should cascade delete
    await prisma.assisteFinanceiroMessageSuggestion.delete({
      where: { id: suggestion.id },
    });

    // Verify feedback was deleted
    const deletedFeedback = await prisma.assisteFinanceiroMessageFeedback.findUnique({
      where: { id: feedback.id },
    });

    expect(deletedFeedback).toBeNull();

    // Cleanup
    await prisma.assisteFinanceiroCustomer.delete({ where: { id: customer.id } });
    await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
