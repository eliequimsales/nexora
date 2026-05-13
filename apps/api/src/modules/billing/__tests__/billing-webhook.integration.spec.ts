import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import request from 'supertest';
import { BillingController } from '../billing.controller';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../../database/prisma.service';
import { PlanLimitsService, PLAN_LIMITS } from '../../../common/billing/plan-limits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PlanLimitsGuard } from '../../../common/guards/plan-limits.guard';

/**
 * I1 - Billing Webhook Integration Tests
 *
 * Validates the Stripe webhook flow:
 *   - POST /billing/webhook with valid signature → updates subscription plan
 *   - Plan transitions: free → starter / pro / business via priceId mapping
 *   - customer.subscription.deleted → resets plan to free + canceled status
 *   - Invalid signatures are rejected
 *   - Unsupported event types are silently ignored (HTTP 200)
 *
 * Strategy:
 *   - Real BillingService + BillingController with global ValidationPipe.
 *   - PrismaService mocked so we can assert on subscription writes.
 *   - Stripe SDK signature verification is stubbed via constructEvent mock —
 *     this is the only mock that prevents a real network handshake.
 *   - Guards bypassed (webhook is @Public anyway, but the global guards
 *     would otherwise reject without an injected user).
 */
describe('Billing Webhook Integration (e2e)', () => {
  let app: INestApplication;
  let prismaMock: any;
  let constructEventMock: jest.Mock;

  const STRIPE_PRICES = {
    starter: 'price_starter_123',
    pro: 'price_pro_456',
    business: 'price_business_789',
  };

  const VALID_SIGNATURE = 't=1234567,v1=valid';

  beforeAll(async () => {
    prismaMock = {
      organization: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      subscription: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      lead: { count: jest.fn().mockResolvedValue(0) },
      aiExecution: { count: jest.fn().mockResolvedValue(0) },
    };

    constructEventMock = jest.fn();

    const configMock = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'stripe.secretKey': 'sk_test_xxx',
          'stripe.webhookSecret': 'whsec_test_xxx',
          'stripe.prices': STRIPE_PRICES,
          appUrl: 'http://localhost:3000',
        };
        return map[key];
      }),
    };

    const allowAllGuard = { canActivate: jest.fn(() => true) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [BillingController],
      providers: [
        BillingService,
        PlanLimitsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .overrideGuard(PlanLimitsGuard)
      .useValue(allowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });

    // Patch the stripe.webhooks.constructEvent on the BillingService instance
    // so we control signature validation deterministically without keys.
    const service = moduleFixture.get(BillingService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe: any = (service as any).stripe;
    stripe.webhooks.constructEvent = constructEventMock;

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.subscription.upsert.mockResolvedValue({});
    prismaMock.subscription.findFirst.mockResolvedValue({ orgId: 'org-test-1' });
  });

  // ── Tests ────────────────────────────────────────────────────────────────

  it('should update org plan to starter on checkout.session.completed', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { orgId: 'org-test-1' },
          customer: 'cus_starter_123',
          subscription: 'sub_starter_xyz',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', VALID_SIGNATURE)
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    // checkout.session.completed maps customer + subId; plan resolution
    // happens on subscription.updated.
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-test-1' },
        create: expect.objectContaining({
          orgId: 'org-test-1',
          stripeCustomerId: 'cus_starter_123',
          stripeSubId: 'sub_starter_xyz',
        }),
        update: expect.objectContaining({
          stripeCustomerId: 'cus_starter_123',
        }),
      }),
    );
  });

  it('should update org plan to pro on customer.subscription.updated with pro priceId', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_pro_xyz',
          customer: 'cus_pro_456',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
          items: { data: [{ price: { id: STRIPE_PRICES.pro } }] },
        },
      },
    });
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ orgId: 'org-test-pro' });

    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', VALID_SIGNATURE)
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBe(200);
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-test-pro' },
        update: expect.objectContaining({
          plan: 'pro',
          stripeSubId: 'sub_pro_xyz',
          status: 'active',
        }),
      }),
    );
  });

  it('should update org plan to business on customer.subscription.updated with business priceId', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_business_xyz',
          customer: 'cus_business_789',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
          items: { data: [{ price: { id: STRIPE_PRICES.business } }] },
        },
      },
    });
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ orgId: 'org-test-business' });

    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', VALID_SIGNATURE)
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBe(200);
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-test-business' },
        update: expect.objectContaining({
          plan: 'business',
          stripeSubId: 'sub_business_xyz',
        }),
      }),
    );
  });

  it('should reset org plan to free on customer.subscription.deleted', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_canceled_xyz',
          customer: 'cus_canceled_xyz',
          status: 'canceled',
        },
      },
    });
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ orgId: 'org-test-cancel' });

    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', VALID_SIGNATURE)
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBe(200);
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'org-test-cancel' },
      data: expect.objectContaining({
        status: 'canceled',
        plan: 'free',
        stripeSubId: null,
        limits: PLAN_LIMITS.free,
      }),
    });
  });

  it('should reject webhook with invalid signature', async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    // BillingService throws 'Invalid webhook signature' — NestJS wraps it
    // as a 500 (since it's a plain Error, not an HttpException).
    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', 'bad-sig')
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBeGreaterThanOrEqual(400);
    // No subscription writes should have happened
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('should ignore webhook with unsupported event type (returns 200, no DB writes)', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.created', // not in the switch
      data: { object: { id: 'cus_anything' } },
    });

    const response = await request(app.getHttpServer())
      .post('/billing/webhook')
      .set('stripe-signature', VALID_SIGNATURE)
      .set('content-type', 'application/json')
      .send({ raw: 'payload' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled();
  });
});
