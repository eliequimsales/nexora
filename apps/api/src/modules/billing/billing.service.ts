import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@nexora/api-prisma';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitsService, PLAN_LIMITS } from '../../common/billing/plan-limits.service';
import Stripe from 'stripe';

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planLimitsService: PlanLimitsService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey') ?? '';
    this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  }

  async createCheckoutSession(orgId: string, priceId: string, userId: string) {
    const [org, user] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, slug: true, name: true, subscription: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    if (!org) throw new NotFoundException('Organização não encontrada');

    const userEmail = user?.email;
    let customerId = (org.subscription as any)?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: userEmail ?? undefined,
        name: org.name,
        metadata: { orgId, slug: org.slug },
      });
      customerId = customer.id;
    }

    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/${org.slug}/settings/billing?success=1`,
      cancel_url: `${appUrl}/${org.slug}/settings/billing?canceled=1`,
      metadata: { orgId, slug: org.slug },
    });

    if (!org.subscription) {
      await this.prisma.subscription.create({
        data: {
          orgId,
          stripeCustomerId: customerId,
          plan: 'free',
          status: 'incomplete',
          currentPeriodEnd: new Date(),
          limits: asJson(PLAN_LIMITS.free),
        },
      });
    } else {
      await this.prisma.subscription.update({
        where: { orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    return { url: session.url };
  }

  async createPortalSession(orgId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { orgId },
      select: { stripeCustomerId: true },
    });
    if (!sub) throw new NotFoundException('Sem assinatura ativa');

    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/${org?.slug}/settings/billing`,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret') ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${String(err)}`);
      throw new Error('Invalid webhook signature');
    }

    this.logger.log(`Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event — ignore
        break;
    }
  }

  async getSummary(orgId: string) {
    const [sub, usage] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { orgId } }),
      this.planLimitsService.getUsage(orgId),
    ]);

    const limits = sub ? (sub.limits as any) ?? PLAN_LIMITS[sub.plan] ?? PLAN_LIMITS.free : PLAN_LIMITS.free;

    return {
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      limits: limits ?? null,
      usage,
    };
  }

  // ── Webhook handlers ──────────────────────────────────────────────────────

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.orgId;
    if (!orgId) return;

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!customerId) return;

    await this.prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        stripeCustomerId: customerId,
        stripeSubId: subId ?? null,
        plan: 'free',
        status: 'incomplete',
        currentPeriodEnd: new Date(),
        limits: asJson(PLAN_LIMITS.free),
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubId: subId ?? undefined,
      },
    });
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription) {
    const orgId = await this.resolveOrgId(sub.customer);
    if (!orgId) return;

    const priceId = sub.items.data[0]?.price?.id ?? '';
    const plan = this.resolvePlan(priceId);
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    await this.prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripeSubId: sub.id,
        plan,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        limits: asJson(limits),
      },
      update: {
        stripeSubId: sub.id,
        plan,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        limits: asJson(limits),
      },
    });
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription) {
    const orgId = await this.resolveOrgId(sub.customer);
    if (!orgId) return;

    await this.prisma.subscription.updateMany({
      where: { orgId },
      data: {
        status: 'canceled',
        plan: 'free',
        stripeSubId: null,
        limits: asJson(PLAN_LIMITS.free),
      },
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const orgId = await this.resolveOrgId(customerId);
    if (!orgId) return;

    await this.prisma.subscription.updateMany({
      where: { orgId },
      data: { status: 'past_due' },
    });
  }

  private async resolveOrgId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
    const customerId = typeof customer === 'string' ? customer : customer?.id ?? null;
    if (!customerId) return null;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      select: { orgId: true },
    });
    return sub?.orgId ?? null;
  }

  private resolvePlan(priceId: string): string {
    const prices = this.config.get<{ starter: string; pro: string; business: string }>('stripe.prices');
    if (prices?.starter && priceId === prices.starter) return 'starter';
    if (prices?.pro && priceId === prices.pro) return 'pro';
    if (prices?.business && priceId === prices.business) return 'business';
    return 'starter';
  }
}
