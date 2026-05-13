# Fase 4 - Bloco 18: Billing End-to-End

**Data:** 2026-04-25
**Status:** FECHADO

## O que foi feito

### B1 - Upgrade modal global
`PlanLimitModal` ja existia com store `usePlanLimitStore` e interceptor 402 em `client.ts`.

- Registro global consolidado em `apps/app/lib/providers/index.tsx`
- Revisao final removeu a duplicata de `apps/app/app/(app)/[slug]/layout.tsx`

### B2 - Billing page completa
A pagina de billing cobre o ciclo completo de upgrade e retorno do Stripe.

- Leitura de `?success=1` e `?canceled=1` via `useSearchParams`
- Botao "Cancelar plano" com `confirm()` que abre o portal Stripe

### B3 - Webhook Stripe
`main.ts` ja tinha `rawBody: true` e os handlers principais ja existiam.

- `onSubscriptionDeleted` agora rebaixa para free
- Reset de `plan`, `stripeSubId` e `limits`

### B4 - Banner de uso no dashboard
- `UsageBanner` adicionado em `dashboard/page.tsx`
- Banner amarelo quando qualquer metrica chega a 80% do limite
- Link direto para `/${slug}/settings/billing`

### Env
`apps/app/.env.example` documenta os price IDs do Stripe e a revisao final removeu a duplicata de `NEXT_PUBLIC_API_URL`.

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `apps/app/lib/providers/index.tsx` | Mantem a instancia global unica de `PlanLimitModal` |
| `apps/app/app/(app)/[slug]/layout.tsx` | Remove a duplicata de `PlanLimitModal` |
| `apps/app/app/(app)/[slug]/settings/billing/page.tsx` | Success/canceled params + cancel button |
| `apps/app/app/(app)/[slug]/dashboard/page.tsx` | Banner de uso >= 80% |
| `apps/api/src/modules/billing/billing.service.ts` | Reset para free em `onSubscriptionDeleted` |
| `apps/app/.env.example` | Price IDs do Stripe + limpeza de chave duplicada |

## Fluxo final de billing

1. Usuario acessa `/settings/billing` e ve plano atual, uso e CTAs.
2. Clica em "Assinar" e vai para `POST /billing/checkout`.
3. Stripe redireciona para `/settings/billing?success=1` ou `?canceled=1`.
4. Webhooks atualizam a assinatura no banco.
5. Quando bate limite, o interceptor 402 abre `PlanLimitModal`.
6. Quando o uso chega a 80%, o dashboard mostra banner de upgrade.
7. Cancelamento acontece via portal Stripe e o webhook rebaixa a org para free.
