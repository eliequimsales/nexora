# Fase 3 — Bloco 16: Setup de Produção e Ambiente

**Data:** 2026-04-24
**Status:** FECHADO documental; gate operacional executado em 2026-04-25

## Escopo

Documentação de operações e configuração de ambiente — sem alterações em código de produto.

## Entregáveis

| Arquivo | Descrição |
|---------|-----------|
| `apps/api/.env.example` | Todas as variáveis da API documentadas com comentários |
| `apps/app/.env.example` | Variável `NEXT_PUBLIC_API_URL` do frontend |
| `docs/ops/setup-local.md` | Guia completo de setup do zero: Docker, migrations, dev servers |
| `docs/ops/deploy-checklist.md` | Checklist de produção: env vars, banco, build, segurança, Stripe |

## Variáveis de ambiente documentadas (API)

Todas extraídas de `apps/api/src/config/env.validation.ts`:

- `NODE_ENV`, `PORT`, `APP_URL`
- `DATABASE_URL` — PostgreSQL com SSL em produção
- `REDIS_URL` — BullMQ e cache
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`
- `LLM_PROVIDER`, `LLM_MODEL`, `CLAUDE_API_KEY`
- `ALLOWED_ORIGINS` — CORS
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- `INTEGRATION_ENCRYPTION_KEY` — 64-char hex para criptografia de integrações

## Notas

- `stripe` já está em `package.json` e foi instalado/linkado via `pnpm install`
- `@anthropic-ai/sdk` já instalado
- Migrations são aplicadas via `pnpm --filter api exec prisma migrate dev` (dev) ou `migrate deploy` (produção)
- SQL manual fica em `apps/api/prisma/manual/add_partial_indexes_and_constraints.sql`; nao colocar em `apps/api/prisma/migrations/manual`, porque o Prisma interpreta a pasta como migration pendente.
- Docker Compose já existia com Postgres + Redis + pgAdmin (profile tools)
- Execucao local validada em 2026-04-25: Docker Desktop instalado, `postgres`/`redis` healthy, migration `20260425125451_fase4_gate` aplicada, SQL manual aplicado, testes/typechecks limpos, API em `3001` e app em `3000`.
