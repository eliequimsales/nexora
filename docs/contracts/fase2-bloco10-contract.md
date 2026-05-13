# Fase 2 - Bloco 10 Contract

## Objetivo

Preparar o contrato tecnico do bloco 10 para introduzir billing com Stripe, limites por organizacao e superficie minima de upgrade, sem misturar isso com novas frentes de produto.

O bloco deve fechar:
- integracao minima com Stripe Checkout + Customer Portal + Webhooks
- persistencia de subscription no banco
- enforcement de limites de plano
- superficie minima de billing em `settings`
- resposta operacional clara quando o limite estourar

Fora do escopo:
- trial complexo
- invoices customizadas
- proration manual
- cupons
- assentos por usuario com cobranca granular
- analytics financeiros
- automacao de downgrade complexo

## Auditoria do estado atual

### Ja existe no repositorio

Infra:
- [apps/api/.env.example](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/.env.example) ja documenta `APP_URL` e `INTEGRATION_ENCRYPTION_KEY`, mas nao documenta nenhuma variavel de Stripe.
- [env.validation.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/config/env.validation.ts) nao conhece `STRIPE_*`.
- [configuration.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/config/configuration.ts) nao expõe config de billing/stripe.
- [main.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/main.ts) nao esta configurado com `rawBody` e nao registra parser especifico para webhook.

Backend funcional relacionado:
- `Organization`, `Lead`, `AiExecution`, `User` e `IntegrationConfig` ja existem no schema.
- [LeadsController](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/leads/leads.controller.ts) tem `POST /leads`.
- [AiActionsController](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/ai-actions/ai-actions.controller.ts) tem endpoints de execucao (`classify`, `respond`, `follow-up`).
- [IngestController](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/ingest.controller.ts) tem endpoint publico `POST /ingest/:formToken`.
- [HttpExceptionFilter](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/common/filters/http-exception.filter.ts) ainda nao mapeia `402`.

Frontend funcional relacionado:
- [Sidebar.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/shell/Sidebar.tsx) ja tem secao `Configurações`, mas nao existe `settings/billing`.
- [client.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/api/client.ts) so trata `401` globalmente.
- [ToastProvider.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/providers/ToastProvider.tsx) e [Providers](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/providers/index.tsx) oferecem toasts globais, mas nao ha infraestrutura global de modal de limite de plano.

RBAC:
- [packages/shared/src/rbac/permissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/rbac/permissions.ts) nao tem permissoes de billing.
- `org:update`, `settings:read` e `settings:update` ja existem e podem ser reutilizadas no MVP.

### Ainda nao existe

- dependencia `stripe` em `apps/api/package.json`
- model `Subscription` no Prisma
- migration `add-subscriptions`
- `src/modules/billing/`
- `plan-limits.guard.ts`
- qualquer superficie de billing no frontend
- tratamento global de `402` no app

## Preparacao obrigatoria

### 1. Dependencia

Adicionar em `apps/api/package.json`:
- `stripe`

Nao ha indicio no repo de que ela ja exista.

### 2. Variaveis de ambiente

Adicionar em `apps/api/.env.example`, `env.validation.ts` e `configuration.ts`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`

Contrato:
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` devem ser obrigatorios quando billing estiver ativo
- os `PRICE_*` devem ser strings nao vazias

Observacao:
- os IDs de price nao podem ser descobertos pelo repositorio; isso e prerequisito manual externo no Stripe Dashboard

### 3. Stripe Dashboard

Prerequisito operacional externo:
- criar produtos/precos no Stripe Dashboard
- registrar e entregar os IDs reais para:
  - Starter
  - Pro
  - Business

Contrato:
- o contrato nao inventa IDs placeholder como fonte de verdade
- o bloco depende de IDs reais preenchidos em env

### 4. Prisma

Adicionar model:

```prisma
model Subscription {
  id                String   @id @default(uuid())
  orgId             String   @unique @map("org_id")
  stripeCustomerId  String   @map("stripe_customer_id")
  stripeSubId       String?  @map("stripe_sub_id")
  plan              String   @db.VarChar(20)
  status            String   @db.VarChar(20)
  currentPeriodEnd  DateTime @map("current_period_end") @db.Timestamptz
  limits            Json
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [orgId], references: [id])

  @@index([status])
  @@map("subscriptions")
}
```

Decisao de contrato:
- relacao `Organization -> Subscription?` deve ser adicionada
- `limits` fica em `Json` no MVP

### 5. Migration

Prerequisito do bloco:
- `pnpm prisma migrate dev --name add-subscriptions`

Observacao:
- o projeto ainda nao materializou migrations antigas no repo; esse bloco nao deve fingir que isso ja esta resolvido
- a migration do billing precisa existir mesmo assim

## Decisoes de contrato

### 1. Modulo de billing no backend

Criar:
- `apps/api/src/modules/billing/billing.module.ts`
- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/billing/billing.service.ts`

Responsabilidades:
- `createCheckoutSession(orgId, priceId)`
- `createPortalSession(orgId)`
- `handleWebhook(rawBody, signature)`

Reuso:
- `ConfigService`
- `PrismaService`
- eventualmente `AuditLogService` para eventos de billing

### 2. Webhook do Stripe e raw body

Estado real:
- `main.ts` nao captura raw body

Contrato:
- o webhook de Stripe deve validar signature antes de processar
- para isso, precisa de `rawBody`

Decisao recomendada:
- habilitar captura de raw body no bootstrap via `NestFactory.create(AppModule, { rawBody: true })`

Motivo:
- simplifica a integracao Nest + Stripe
- evita parser manual rota a rota

Alternativa aceitavel:
- parser raw apenas na rota `/api/v1/billing/webhook`

Mas o contrato recomenda `rawBody: true` como caminho mais limpo para o MVP.

### 3. Prefixo real da rota

Estado real:
- o app usa `app.setGlobalPrefix('api/v1')`

Contrato:
- a rota real externa do webhook sera `POST /api/v1/billing/webhook`
- qualquer configuracao no Stripe deve usar esse caminho completo

### 4. Endpoints do backend

Adicionar:
- `POST /billing/checkout`
- `POST /billing/portal`
- `POST /billing/webhook`

Permissao recomendada:
- `checkout` e `portal`: `org:update` ou nova permissao `billing:manage`
- `webhook`: `@Public()`

Decisao pragmatica:
- no MVP, reutilizar `org:update` para nao abrir mais uma rodada de RBAC desnecessaria

### 5. Mapeamento de plano e limites

O Stripe envia price IDs, mas o sistema precisa trabalhar com:
- `starter`
- `pro`
- `business`

Contrato:
- criar um mapper central `priceId -> { plan, limits }`

Exemplo de `limits`:

```ts
{
  leadsPerMonth: number;
  aiExecPerMonth: number;
  maxUsers: number;
}
```

Decisao:
- limites ficam centralizados no backend, nao vindos dinamicamente do Stripe metadata neste MVP

Motivo:
- reduz acoplamento e torna comportamento previsivel

### 6. Customer lifecycle

Contrato minimo:
- se a org ainda nao tem `stripeCustomerId`, criar customer no primeiro checkout
- `createCheckoutSession()` usa org e usuario autenticado para preencher `customer_email` / metadata
- `createPortalSession()` exige subscription ja existente

Metadata recomendada na sessao:
- `orgId`
- `slug`

### 7. Webhook handlers obrigatorios

Implementar:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Efeitos esperados:

`checkout.session.completed`
- garantir `stripeCustomerId`
- vincular `stripeSubId` quando disponivel

`customer.subscription.updated`
- atualizar `plan`
- atualizar `status`
- atualizar `currentPeriodEnd`
- atualizar `limits`

`customer.subscription.deleted`
- marcar subscription como `canceled`

`invoice.payment_failed`
- marcar como `past_due` quando aplicavel

### 8. Guard de limites

Criar:
- `apps/api/src/common/guards/plan-limits.guard.ts`

Responsabilidade:
- ler a subscription da org
- calcular uso corrente do mes
- comparar com `limits`
- bloquear com `402` quando exceder

Aplicacao pedida:
- `LeadsController.create`
- `AiActionsController` nos endpoints de execucao

Decisao tecnica:
- o guard precisa ser configuravel por recurso

Opcao recomendada:
- decorator auxiliar, por exemplo:
  - `@PlanLimit('leads')`
  - `@PlanLimit('aiExecutions')`

Sem isso, um guard unico nao sabe qual limite aplicar em cada endpoint.

### 9. Contagem de uso do mes

Contrato:
- leads: contar `Lead.createdAt` no mes corrente por `orgId`
- IA: contar `AiExecution.createdAt` no mes corrente por `orgId`
- usuarios: nao entra em guard de request agora, mas deve alimentar a tela de uso

Mes corrente:
- usar janela calendario do servidor

### 10. Resposta 402 padronizada

Estado real:
- `HttpExceptionFilter` nao mapeia `402`

Contrato:
- adicionar suporte a `402` com erro padronizado, por exemplo:
  - `PAYMENT_REQUIRED`

Payload recomendado:

```json
{
  "statusCode": 402,
  "error": "PAYMENT_REQUIRED",
  "message": "Limite do plano atingido",
  "code": "plan_limit_exceeded",
  "resource": "leads" | "aiExecutions"
}
```

Observacao:
- o filtro atual hoje so devolve `{ statusCode, error, message }`
- se o frontend precisar agir de forma rica, o contrato pode aceitar ampliar o shape para incluir `code` e `resource`

Recomendacao:
- enriquecer o response de 402 com `code`

### 11. Ingest publico

Estado real:
- [IngestController](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/ingest.controller.ts) cria lead diretamente no endpoint publico

Contrato:
- o mesmo limite de leads deve valer para ingest
- se o plano estourou, retornar `402`

Decisao pragmatica:
- neste bloco, aplicar a verificacao diretamente no `IngestController` ou extrair um service reutilizavel
- nao usar `PlanLimitsGuard` aqui, porque a rota e publica e nao passa por `TenantContext`

Recomendacao:
- extrair helper/service de contagem e limite para reuso entre guard autenticado e ingest publico

### 12. Frontend de billing

Criar:
- `apps/app/app/(app)/[slug]/settings/billing/page.tsx`
- `apps/app/components/modules/billing/PlanCard.tsx`
- `apps/app/components/modules/billing/UsageMeter.tsx`

Estado real:
- nao existe `settings/billing`
- Sidebar nao precisa de item proprio se billing ficar dentro de settings

Conteudo minimo da pagina:
- plano atual
- status atual
- uso do mes
- cards dos planos
- botao de upgrade
- botao de portal quando subscription existir

### 13. API frontend de billing

Criar:
- `apps/app/lib/api/billing.api.ts`
- hooks correspondentes, por exemplo:
  - `useBillingSummary`
  - `useCreateCheckoutSession`
  - `useCreatePortalSession`

Necessidade:
- a tela precisa de estado de plano/uso
- o backend precisa expor endpoint de leitura, mesmo que o prompt nao tenha listado explicitamente

Decisao de contrato:
- adicionar `GET /billing/summary`

Motivo:
- sem endpoint de leitura, a pagina de billing nao consegue renderizar plano atual nem uso do mes
- isso e um gap real do prompt original

Payload recomendado:

```ts
{
  plan: 'starter' | 'pro' | 'business' | null;
  status: string | null;
  currentPeriodEnd: string | null;
  limits: { leadsPerMonth: number; aiExecPerMonth: number; maxUsers: number } | null;
  usage: { leadsThisMonth: number; aiExecThisMonth: number; usersCount: number };
}
```

### 14. UX de limite excedido no frontend

Estado real:
- existe toast global
- nao existe modal global de erro de plano

Contrato:
- o interceptor global de `apiClient` deve detectar `402`
- ele deve abrir uma superficie mais forte que um toast simples

Decisao recomendada:
- criar um modal leve global de `plan limit` montado em `Providers`
- com CTA para `/{slug}/settings/billing`

Motivo:
- o requisito pede modal
- o `ToastProvider` atual nao e suficiente sozinho

Recomendacao minima:
- manter toast opcional + modal obrigatorio

### 15. Settings navigation

Estado real:
- `Sidebar` aponta apenas para `settings`, `settings/team`, `settings/integrations`

Contrato:
- nao e obrigatorio adicionar item novo no sidebar principal
- billing pode entrar dentro da area de settings

Opcao aceitavel:
- adicionar link interno na pagina de settings
- ou expandir navegacao secundaria de settings depois

### 16. Auditoria

Recomendacao de contrato:
- registrar eventos relevantes de billing em `AuditLog`

Exemplos:
- `billing.checkout_started`
- `billing.portal_opened`
- `billing.subscription_updated`
- `billing.limit_blocked`

Nao e o foco principal do bloco, mas melhora rastreabilidade operacional.

## Arquivos que a Claude deve tocar

Backend:
- `apps/api/package.json`
- `apps/api/.env.example`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/config/configuration.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/*` via `prisma migrate dev --name add-subscriptions`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/billing/billing.module.ts`
- `apps/api/src/modules/billing/billing.controller.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/src/common/guards/plan-limits.guard.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/modules/leads/leads.controller.ts`
- `apps/api/src/modules/ai-actions/ai-actions.controller.ts`
- `apps/api/src/modules/integrations/ingest.controller.ts`

Frontend:
- `apps/app/app/(app)/[slug]/settings/billing/page.tsx`
- `apps/app/components/modules/billing/PlanCard.tsx`
- `apps/app/components/modules/billing/UsageMeter.tsx`
- `apps/app/lib/api/billing.api.ts`
- `apps/app/lib/api/client.ts`
- `apps/app/lib/providers/index.tsx` e/ou nova infra leve de modal global

Documentacao:
- `docs/implementation/fase2-bloco10-billing.md`

## Riscos

- tentar implementar billing sem IDs reais de price no Stripe Dashboard
- esquecer `rawBody` e quebrar validacao de assinatura do webhook
- nao criar `GET /billing/summary` e deixar a tela sem fonte de dados
- usar apenas toast para `402` quando o requisito pede modal
- aplicar guard autenticado no ingest publico, onde nao existe `TenantContext`
- acoplar limites diretamente a metadata de Stripe cedo demais
- tratar plano cancelado como sem limites e bloquear tudo sem regra clara

## Sequencia minima recomendada para Claude

1. adicionar `stripe` e variaveis `STRIPE_*`
2. adicionar model `Subscription` e gerar migration
3. configurar `configuration.ts` + `env.validation.ts`
4. criar `BillingModule` com service/controller
5. adicionar suporte a raw body para webhook
6. implementar `checkout`, `portal`, `webhook` e `summary`
7. implementar mapper `priceId -> plan + limits`
8. criar `PlanLimitsGuard` + decorator auxiliar
9. aplicar o guard em `LeadsController` e `AiActionsController`
10. bloquear ingest com `402`
11. criar UI minima de billing em `settings`
12. adicionar modal global para `402`

## Definition of Done deste contrato

O bloco 10 pode ser considerado fechado quando:
- Stripe esta configurado no backend com env e SDK
- existe model `Subscription` persistida no banco
- checkout, portal e webhook funcionam com validacao de assinatura
- ha endpoint de leitura de billing para a UI
- limites de leads e IA sao aplicados com `402`
- ingest publico tambem respeita o limite do plano
- existe pagina minima de billing em `settings`
- o frontend mostra modal claro de upgrade quando recebe `402`
