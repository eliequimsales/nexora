# Nexora — Deploy Guide

Production deployment guide for the Nexora SaaS platform.

## Architecture

```
[Browser] -> CDN -> [Next.js App :3000] --REST--> [NestJS API :3001] -> [Postgres + Redis]
                                                                          |
                                                                          v
                                                              [BullMQ workers]
```

## Recommended platforms

For a tiny ops surface, deploy to **Railway** (one-click monorepo) or **Render**. Both support:
- Auto-build from Dockerfile per service
- Managed Postgres + Redis add-ons
- Free SSL + custom domains
- Env vars in the UI

Fly.io is also a strong choice if you want regional control.

## Services to deploy

| Service        | Image / build target                | Port | Notes                           |
|----------------|-------------------------------------|------|---------------------------------|
| `nexora-api`   | `apps/api/Dockerfile`               | 3001 | NestJS REST + queue workers     |
| `nexora-app`   | `apps/app/Dockerfile`               | 3000 | Next.js standalone server       |
| `postgres`     | Managed (Railway/Render addon)      | 5432 | PG 16+                          |
| `redis`        | Managed (Railway/Render addon)      | 6379 | For BullMQ + rate limit         |

## Required environment variables

### Common
- `NODE_ENV=production`

### API (`nexora-api`)
- `DATABASE_URL` — Postgres connection string (`postgresql://user:pass@host:5432/db?schema=public`)
- `REDIS_URL` — Redis connection string (`redis://default:pass@host:6379`)
- `JWT_SECRET` — 32+ random bytes (`openssl rand -hex 32`)
- `INTEGRATION_ENCRYPTION_KEY` — 32 bytes hex for encrypting tenant API keys
- `LLM_PROVIDER` — `anthropic` (production) or `mock` (CI/staging)
- `ANTHROPIC_API_KEY` — required when `LLM_PROVIDER=anthropic`
- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` (from Stripe webhook endpoint)
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PREMIUM` — Stripe price IDs
- `RESEND_API_KEY` — global default email provider key (tenants can override)
- `APP_URL` — public URL of the Next.js app (used for CORS + Stripe redirect URLs)
- `PORT=3001`

### App (`nexora-app`)
- `NEXT_PUBLIC_API_URL` — public URL of the API (must be set at **build time**)
- `PORT=3000`

## CORS configuration

The API reads `APP_URL` and adds it to allowed origins. Set `APP_URL` to the production app URL (e.g. `https://app.nexora.com.br`). For staging, set it to your staging app URL.

## Database migrations

`apps/api/Dockerfile` runs `prisma migrate deploy` on container startup. This is **non-destructive** — it only applies pending migrations. The very first deploy will create the schema from scratch.

Do **not** run `prisma migrate dev` in production — it can prompt for destructive resets.

## First-time setup checklist

1. Provision Postgres + Redis on your platform of choice.
2. Set the env vars listed above (do not commit them — use the platform UI).
3. Push to the branch the platform tracks. The Dockerfiles handle the rest.
4. Once the API is up, verify `GET /healthz` returns 200.
5. Open the App URL → click "Criar conta" → register a test org → verify the trial subscription is created (`status=trialing`, 7 days).
6. Configure Stripe webhook to `https://api.<your-domain>/billing/webhook` and copy the `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

## Smoke test in production

After deploy, run this minimum sequence:

1. **Register** a new org at `/register?niche=barbearia`
2. **Onboarding wizard** completes (4 Nexora steps)
3. **Dashboard** shows Nexora KPI cards (0 values is fine)
4. **Clientes → Inativos** loads without error (empty list is fine)
5. **Settings → Nexora** loads and saves a config change
6. **Analytics** page loads (empty trends are fine)
7. **Billing** page lists 3 plans; "Assinar" button redirects to Stripe checkout

If all 7 pass, the deploy is healthy.

## Rolling back

Both Railway and Render support one-click rollback to the previous successful deploy. Use it. Avoid `prisma migrate reset` in production — it drops data.

## Monitoring

Minimum viable monitoring stack:
- `pino` logs already enabled (NestJS) — pipe to platform logs UI
- Add `@sentry/nestjs` and `@sentry/nextjs` for exception tracking (post-MVP)
- Set up uptime ping (UptimeRobot, BetterStack) to `/healthz` every 1 min
