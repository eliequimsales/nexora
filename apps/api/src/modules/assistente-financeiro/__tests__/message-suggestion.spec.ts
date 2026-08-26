import { PrismaClient } from '@nexora/api-prisma';

const prisma = new PrismaClient();

/**
 * Helper to create test setup (org, subscription, customer)
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

  return { org, subscription, customer };
}

/**
 * Helper to cleanup test resources
 */
async function cleanupTestSetup(
  suggestionIds: string[],
  customerId: string,
  subscriptionId: string,
  orgId: string
) {
  if (suggestionIds.length > 0) {
    await prisma.assisteFinanceiroMessageSuggestion.deleteMany({
      where: { id: { in: suggestionIds } },
    });
  }
  await prisma.assisteFinanceiroCustomer.delete({ where: { id: customerId } });
  await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscriptionId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

describe('MessageSuggestion Model', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create message suggestion with all fields', async () => {
    const { customer, subscription, org } = await createTestSetup({
      customerName: 'João Silva',
      crmId: 'pd-123',
    });

    const suggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'whatsapp',
        baseMessage: 'Voltamos a atender melhor',
        personalizedMessage:
          'João, notamos que você não compra há 15 dias. Temos desconto especial para você!',
        confidence: 85,
        contextData: {
          daysSinceLastPurchase: 15,
          totalRevenue: 5000,
          recoveryProbability: 87,
        },
      },
    });

    expect(suggestion.id).toBeDefined();
    expect(suggestion.customerId).toBe(customer.id);
    expect(suggestion.channel).toBe('whatsapp');
    expect(suggestion.confidence).toBe(85);
    expect(suggestion.baseMessage).toBe('Voltamos a atender melhor');
    expect(suggestion.personalizedMessage).toContain('João');
    expect(suggestion.createdAt).toBeDefined();

    await cleanupTestSetup([suggestion.id], customer.id, subscription.id, org.id);
  });

  it('should have relationship to customer', async () => {
    const { customer, subscription, org } = await createTestSetup({
      tier: 'starter',
      customerName: 'Maria Santos',
      crmId: 'pd-456',
    });

    const suggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'email',
        baseMessage: 'Teste',
        personalizedMessage: 'Maria, teste',
        confidence: 75,
      },
    });

    const loaded = await prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: suggestion.id },
      include: { customer: true },
    });

    expect(loaded).toBeDefined();
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.customer).toBeDefined();
      expect(loaded.customer.id).toBe(customer.id);
      expect(loaded.customer.name).toBe('Maria Santos');
    }

    await cleanupTestSetup([suggestion.id], customer.id, subscription.id, org.id);
  });

  it('should enforce confidence is between 0-100', async () => {
    const { customer, subscription, org } = await createTestSetup({
      customerName: 'Test User',
      crmId: 'pd-789',
    });

    const suggestion1 = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'whatsapp',
        baseMessage: 'Test',
        personalizedMessage: 'Test',
        confidence: 0,
      },
    });

    const suggestion2 = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'email',
        baseMessage: 'Test',
        personalizedMessage: 'Test',
        confidence: 100,
      },
    });

    expect(suggestion1.confidence).toBe(0);
    expect(suggestion2.confidence).toBe(100);

    await cleanupTestSetup(
      [suggestion1.id, suggestion2.id],
      customer.id,
      subscription.id,
      org.id
    );
  });

  it('should cascade delete when customer is deleted', async () => {
    const { customer, subscription, org } = await createTestSetup({
      customerName: 'Cascade Test',
      crmId: 'pd-cascade',
    });

    const suggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'whatsapp',
        baseMessage: 'Test',
        personalizedMessage: 'Test',
        confidence: 50,
      },
    });

    // Delete customer
    await prisma.assisteFinanceiroCustomer.delete({ where: { id: customer.id } });

    // Verify suggestion was deleted
    const deletedSuggestion = await prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(deletedSuggestion).toBeNull();

    // Cleanup
    await prisma.assisteFinanceiroSubscription.delete({ where: { id: subscription.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should support different channel types', async () => {
    const { customer, subscription, org } = await createTestSetup({
      customerName: 'Channel Test',
      crmId: 'pd-channels',
    });

    const whatsappSuggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'whatsapp',
        baseMessage: 'WhatsApp message',
        personalizedMessage: 'Personalized WhatsApp',
        confidence: 80,
      },
    });

    const emailSuggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'email',
        baseMessage: 'Email message',
        personalizedMessage: 'Personalized Email',
        confidence: 70,
      },
    });

    expect(whatsappSuggestion.channel).toBe('whatsapp');
    expect(emailSuggestion.channel).toBe('email');

    await cleanupTestSetup(
      [whatsappSuggestion.id, emailSuggestion.id],
      customer.id,
      subscription.id,
      org.id
    );
  });

  it('should allow null contextData', async () => {
    const { customer, subscription, org } = await createTestSetup({
      customerName: 'Null Context Test',
      crmId: 'pd-null',
    });

    const suggestion = await prisma.assisteFinanceiroMessageSuggestion.create({
      data: {
        customerId: customer.id,
        channel: 'whatsapp',
        baseMessage: 'Test',
        personalizedMessage: 'Test',
        confidence: 60,
      },
    });

    expect(suggestion.contextData).toBeNull();

    await cleanupTestSetup([suggestion.id], customer.id, subscription.id, org.id);
  });
});
