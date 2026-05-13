# Bloco 10 — Billing Stripe

## Objetivo

Integração mínima com Stripe: Checkout, Customer Portal e Webhooks. Persistência de subscription no banco. Enforcement de limites de plano com `402`. Superfície de billing em `settings`.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/common/exceptions/plan-limit.exception.ts` | Exceção tipada para limit exceeded com campo `resource` |
| `apps/api/src/common/billing/plan-limits.service.ts` | Serviço compartilhado: conta uso, verifica limites, expõe `getUsage()` |
| `apps/api/src/common/guards/plan-limits.guard.ts` | Guard global + decorator `@PlanLimit('leads' | 'aiExecutions')` |
| `apps/api/src/modules/billing/billing.service.ts` | createCheckoutSession, createPortalSession, handleWebhook, getSummary |
| `apps/api/src/modules/billing/billing.controller.ts` | GET /billing/summary, POST /billing/checkout, POST /billing/portal, POST /billing/webhook |
| `apps/api/src/modules/billing/billing.module.ts` | Módulo com providers e exports |
| `apps/api/src/modules/billing/dto/create-checkout.dto.ts` | DTO para POST /billing/checkout |
| `apps/app/lib/api/billing.api.ts` | API client para billing |
| `apps/app/lib/hooks/billing/useBillingSummary.ts` | Query do summary |
| `apps/app/lib/hooks/billing/useCreateCheckoutSession.ts` | Mutation checkout → redirect |
| `apps/app/lib/hooks/billing/useCreatePortalSession.ts` | Mutation portal → redirect |
| `apps/app/lib/stores/plan-limit.store.ts` | Zustand store para estado do modal de limite |
| `apps/app/components/modules/billing/PlanCard.tsx` | Card de plano com upgrade button |
| `apps/app/components/modules/billing/UsageMeter.tsx` | Barra de progresso de uso |
| `apps/app/components/modules/billing/PlanLimitModal.tsx` | Modal global de limite atingido com CTA para billing |
| `apps/app/app/(app)/[slug]/settings/billing/page.tsx` | Página de billing settings |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/api/package.json` | Adicionado `stripe: ^16.0.0` |
| `apps/api/.env.example` | Documentadas vars `STRIPE_*` |
| `apps/api/src/config/env.validation.ts` | Schema Joi para `STRIPE_*` (optional) |
| `apps/api/src/config/configuration.ts` | Seção `stripe` com secretKey/webhookSecret/prices |
| `apps/api/prisma/schema.prisma` | Model `Subscription` + relação `Organization.subscription?` |
| `apps/api/src/main.ts` | `NestFactory.create(AppModule, { rawBody: true })` |
| `apps/api/src/app.module.ts` | Import de `BillingModule`, `PlanLimitsGuard` e `PlanLimitsService` como APP_GUARD global |
| `apps/api/src/common/filters/http-exception.filter.ts` | Trata `PlanLimitException` → 402 com body `{ statusCode, error, message, code, resource }` |
| `apps/api/src/modules/leads/leads.controller.ts` | `@PlanLimit('leads')` em `POST /leads` |
| `apps/api/src/modules/ai-actions/ai-actions.controller.ts` | `@PlanLimit('aiExecutions')` em classify/respond/follow-up |
| `apps/api/src/modules/integrations/ingest.controller.ts` | `assertLeadAllowed()` antes de criar lead |
| `apps/api/src/modules/integrations/integrations.module.ts` | `PlanLimitsService` adicionado aos providers |
| `apps/app/lib/api/client.ts` | Interceptor de 402 → `usePlanLimitStore.open(resource)` |
| `apps/app/lib/providers/index.tsx` | `<PlanLimitModal />` montado globalmente |
| `apps/app/components/shell/Sidebar.tsx` | Item "Plano" → `settings/billing` |

---

## Modelo de dados

```prisma
model Subscription {
  id               String   @id @default(uuid())
  orgId            String   @unique @map("org_id")
  stripeCustomerId String   @map("stripe_customer_id")
  stripeSubId      String?  @map("stripe_sub_id")
  plan             String   @db.VarChar(20)
  status           String   @db.VarChar(20)
  currentPeriodEnd DateTime @map("current_period_end") @db.Timestamptz
  limits           Json
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [orgId], references: [id])

  @@index([status])
  @@map("subscriptions")
}
```

---

## Planos e limites

| Plano | Leads/mês | IA/mês | Usuários |
|-------|-----------|--------|----------|
| free (sem sub) | 50 | 100 | 2 |
| starter | 200 | 500 | 3 |
| pro | 2.000 | 10.000 | 10 |
| business | 20.000 | 100.000 | 50 |

Limites ficam centralizados em `PLAN_LIMITS` no backend (`plan-limits.service.ts`), não vindos do Stripe.

---

## Webhook handlers

| Evento | Efeito |
|--------|--------|
| `checkout.session.completed` | Garante `stripeCustomerId` e vincula `stripeSubId` |
| `customer.subscription.updated` | Atualiza `plan`, `status`, `currentPeriodEnd`, `limits` |
| `customer.subscription.deleted` | Marca status como `canceled` |
| `invoice.payment_failed` | Marca status como `past_due` |

Rota do webhook: `POST /api/v1/billing/webhook` — pública, valida `stripe-signature` com `rawBody`.

---

## Guard de limites

`PlanLimitsGuard` é registrado como `APP_GUARD` global na ordem JwtAuth → Roles → PlanLimits.

Decorator `@PlanLimit('leads' | 'aiExecutions')` marca o endpoint. O guard lê o `orgId` do `TenantContext` e delega para `PlanLimitsService`.

Para ingest público (sem TenantContext), a verificação é feita diretamente no `IngestController` via `planLimitsService.assertLeadAllowed(org.id)`.

---

## Resposta 402

```json
{
  "statusCode": 402,
  "error": "PAYMENT_REQUIRED",
  "message": "Limite do plano atingido",
  "code": "plan_limit_exceeded",
  "resource": "leads"
}
```

---

## Fluxo frontend de 402

```
apiClient interceptor detects status 402
  → usePlanLimitStore.open(resource)
  → PlanLimitModal renders com CTA para /{slug}/settings/billing
```

---

## Variáveis de ambiente necessárias

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
```

Frontend (Next.js):
```
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_...
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_...
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS=price_...
```

---

## O que testar

- [ ] `GET /billing/summary` retorna plan/status/limits/usage para org com subscription
- [ ] `GET /billing/summary` retorna plan: null para org sem subscription
- [ ] `POST /billing/checkout` cria customer Stripe e retorna URL de checkout
- [ ] `POST /billing/portal` retorna URL do portal (requer subscription existente)
- [ ] `POST /billing/webhook` rejeita request sem `stripe-signature` (400)
- [ ] Webhook `checkout.session.completed` cria/atualiza subscription
- [ ] Webhook `customer.subscription.updated` atualiza plan + limits
- [ ] Webhook `customer.subscription.deleted` marca como `canceled`
- [ ] Webhook `invoice.payment_failed` marca como `past_due`
- [ ] `POST /leads` retorna 402 quando limite de leads atingido
- [ ] `POST /ai-actions/classify/:id` retorna 402 quando limite de IA atingido
- [ ] `POST /ingest/:token` retorna 402 quando limite de leads atingido
- [ ] Frontend: PlanLimitModal abre ao receber 402 de qualquer endpoint
- [ ] Frontend: página `/settings/billing` mostra plano atual e uso
- [ ] Frontend: botão de upgrade redireciona para Stripe Checkout
- [ ] Frontend: botão de portal redireciona para Stripe Portal
- [ ] Sidebar: item "Plano" navega para `/settings/billing`
