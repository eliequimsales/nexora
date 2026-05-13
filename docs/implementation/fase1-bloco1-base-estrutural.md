# Fase 1 — Bloco 1: Base Estrutural

**Data:** 2026-04-21  
**Status:** Concluído e revisado  
**Localização do projeto:** `C:/Users/eli/Downloads/Documents/saas-platform/`

---

## 1. O que foi construído

### Monorepo (raiz)

Estrutura base com pnpm workspaces, TypeScript compartilhado e infraestrutura local.

| Arquivo | O que faz |
|---------|-----------|
| `package.json` | Workspace root com scripts globais. Sem dependências de produto. |
| `pnpm-workspace.yaml` | Define `apps/*` e `packages/*` como workspaces pnpm. |
| `tsconfig.base.json` | TypeScript base com `paths` para `@saas/shared`. |
| `.gitignore` | Exclui `node_modules`, `.env`, `dist`, `.next`, logs. |
| `.nvmrc` | Fixa Node.js 20 LTS. |
| `docker-compose.yml` | PostgreSQL 16 + Redis 7-alpine + pgAdmin (profile opcional). |
| `.env.example` | Todas as variáveis documentadas com tipo, exemplo e instrução. |

### `packages/shared`

Código TypeScript compartilhado entre `apps/api` e futuramente `apps/web`. Sem build step — importado direto pelo source via `tsconfig paths`.

| Arquivo | O que faz |
|---------|-----------|
| `src/constants/job-names.ts` | Constantes das filas BullMQ (`lead.created`, `lead.follow_up`). |
| `src/types/ai.types.ts` | Types de classificação de IA, resultado LLM e payload de job. |
| `src/niche-configs/types.ts` | Interfaces `NicheConfig`, `PipelineStageConfig`, `AiPromptsConfig`, etc. |
| `src/niche-configs/real_estate.ts` | Config completa do nicho imobiliária: 6 stages, 4 campos, 3 prompts de IA reais. |
| `src/niche-configs/index.ts` | `getNicheConfig(niche)` e `getSupportedNiches()`. |
| `src/index.ts` | Barrel file — único ponto de importação do pacote. |

### `apps/api`

Aplicação NestJS com infraestrutura base configurada.

| Arquivo | O que faz |
|---------|-----------|
| `src/main.ts` | Bootstrap: prefixo `/api/v1`, ValidationPipe, filtro HTTP global, CORS via env. |
| `src/app.module.ts` | Módulo raiz: ConfigModule, EventEmitter2, ThrottlerModule, DatabaseModule. |
| `src/config/env.validation.ts` | Schema Joi — app falha na inicialização se env obrigatória estiver ausente. |
| `src/config/configuration.ts` | Factory tipada de configuração. Fonte única de valores de runtime. |
| `src/common/tenant/tenant-context.ts` | Interface `TenantContext { userId, orgId, role }` — readonly. |
| `src/common/tenant/assert-same-tenant.ts` | Lança `NotFoundException` se `entityOrgId !== ctxOrgId`. |
| `src/common/decorators/public.decorator.ts` | `@Public()` — marca rota como pública (bypass do JWT guard). |
| `src/common/decorators/current-user.decorator.ts` | `@CurrentUser()` — injeta `TenantContext` no parâmetro do controller. |
| `src/common/decorators/roles.decorator.ts` | `@Roles('admin')` — metadata para o RolesGuard. |
| `src/common/filters/http-exception.filter.ts` | Formato padrão de erro. Mapeia erros Prisma (P2002→409, P2025→404). |
| `src/database/prisma.service.ts` | `PrismaClient` com lifecycle hooks de connect/disconnect. |
| `src/database/database.module.ts` | Módulo global que exporta `PrismaService`. |
| `prisma/schema.prisma` | 7 models completos: organizations, users, pipeline_stages, leads, tasks, activity_log, ai_executions. |

---

## 2. Por que foi construído assim

### Monorepo com pnpm workspaces (sem Turborepo)
**Decisão:** pnpm workspaces puro, sem Turborepo.  
**Motivo:** O MVP tem 1 dev. Turborepo resolve problemas de build paralelo em times grandes — overhead desnecessário agora. Pode ser adicionado depois sem reescrever nada.

### `packages/shared` sem compilação para dist
**Decisão:** Importado direto do source TypeScript via `tsconfig paths`.  
**Motivo:** Elimina o passo de build do shared em dev. O compilador da API resolve diretamente. Em produção, o build da API compila o shared junto. Simples, sem step extra.

### Enums como `VARCHAR` no banco (não enum do PostgreSQL)
**Decisão:** `status String @db.VarChar(20)` com comentários de valores válidos.  
**Motivo:** Adicionar valor a um enum PostgreSQL requer `ALTER TYPE` — bloqueante em produção. Com `VARCHAR`, basta adicionar o novo valor na aplicação. Validação fica no DTO, não no banco.

### `assertSameTenant` lança `NotFoundException`, não `ForbiddenException`
**Decisão:** Sempre 404 para cross-tenant.  
**Motivo:** `403 Forbidden` revela que o recurso existe mas o usuário não tem acesso — information disclosure. `404 Not Found` não confirma nem nega a existência de recursos de outros tenants.

### Joi para validação de env vars
**Decisão:** Schema Joi no `ConfigModule`.  
**Motivo:** A aplicação falha imediatamente no bootstrap com mensagem clara se uma variável obrigatória estiver ausente. Sem Joi, o erro aparece só quando o código que usa a variável é executado — difícil de debugar.

### `configuration.ts` como factory function
**Decisão:** `() => ({ ... })` em vez de objeto direto.  
**Motivo:** Valores lidos no momento do bootstrap, não no import do módulo. Permite o NestJS injetar o `ConfigService` com tipagem, sem precisar de `process.env.X` espalhado nos módulos.

### Índices parciais documentados como SQL raw
**Decisão:** Comentários `// NOTE:` no schema Prisma para constraints não suportadas.  
**Motivo:** Prisma não suporta `PARTIAL INDEX WHERE` nem `PARTIAL UNIQUE WHERE`. A alternativa é SQL raw na migration — documentado para não ser esquecido no `prisma migrate dev`.

---

## 3. Arquivos principais envolvidos

```
saas-platform/
├── packages/shared/src/
│   ├── niche-configs/real_estate.ts   ← prompts de IA e stages do funil
│   ├── constants/job-names.ts         ← nomes das filas BullMQ
│   └── index.ts                       ← ponto único de importação
│
└── apps/api/src/
    ├── main.ts                         ← bootstrap da aplicação
    ├── app.module.ts                   ← módulo raiz
    ├── config/
    │   ├── env.validation.ts           ← schema Joi (falha rápida)
    │   └── configuration.ts            ← factory tipada de config
    ├── common/
    │   ├── tenant/
    │   │   ├── tenant-context.ts       ← interface do contexto multi-tenant
    │   │   └── assert-same-tenant.ts   ← guard de isolamento entre orgs
    │   ├── decorators/
    │   │   ├── public.decorator.ts
    │   │   ├── current-user.decorator.ts
    │   │   └── roles.decorator.ts
    │   └── filters/
    │       └── http-exception.filter.ts
    ├── database/
    │   ├── prisma.service.ts
    │   └── database.module.ts
    └── prisma/
        └── schema.prisma               ← 7 models, índices, relações
```

---

## 4. Como isso se conecta ao restante do sistema

```
┌─────────────────────────────────────────────────┐
│              packages/shared                     │
│  NicheConfig → usado em:                         │
│    - auth/register (criar pipeline_stages)       │
│    - ai-engine (prompts por nicho)               │
│  JOB_NAMES → usado em:                          │
│    - queue/queue.service.ts (publicar jobs)      │
│    - ai-engine/processors/* (consumir jobs)      │
└──────────────────┬──────────────────────────────┘
                   │ @saas/shared
┌──────────────────▼──────────────────────────────┐
│                 apps/api                         │
│                                                  │
│  env.validation.ts ← falha se env inválida       │
│  configuration.ts ← fonte única de config        │
│         ↓                                        │
│  app.module.ts ← registra tudo globalmente       │
│         ↓                                        │
│  DatabaseModule (global) ← PrismaService         │
│    ↓ injetado em todo módulo de domínio          │
│  modules/auth, leads, pipeline, tasks, ...       │
│                                                  │
│  TenantContext ← extraído do JWT pelo JwtGuard   │
│    ↓ passado para todo service como 1° parâmetro │
│  assertSameTenant ← chamado antes de toda query  │
│    cross-tenant                                  │
│                                                  │
│  HttpExceptionFilter ← aplicado globalmente      │
│    garante formato { statusCode, error, message }│
└─────────────────────────────────────────────────┘
```

### Dependências diretas deste bloco

| Bloco seguinte | Usa o que foi criado aqui |
|----------------|--------------------------|
| Auth (T-14 a T-22) | `TenantContext`, `@Public()`, `DatabaseModule`, `configuration.ts` |
| Organizations | `assertSameTenant`, `@Roles()`, `@CurrentUser()` |
| Leads | `assertSameTenant`, `PrismaService`, `JOB_NAMES` |
| AI Engine | `getNicheConfig()`, `JOB_NAMES`, `LLMResult`, `ClassifyResult` |
| Todos os módulos | `HttpExceptionFilter`, `PaginationDto` (próximo bloco) |

---

## 5. O que ainda falta

### Imediato (Bloco 2-A — próximo)
- [ ] `docker compose up -d` — subir postgres + redis
- [ ] `prisma migrate dev --name init` — criar tabelas no banco
- [ ] SQL raw na migration para constraints não suportadas pelo Prisma:
  - `PARTIAL UNIQUE (org_id) WHERE is_default = true` em `pipeline_stages`
  - Índices `WHERE archived_at IS NULL` em `leads`
  - `CHECK (ai_score >= 0 AND ai_score <= 100)` em `leads`
  - `CHECK (length(content) <= 10000)` em `activity_log`
- [ ] `PaginationDto` + helpers de paginação (`common/helpers/`)
- [ ] `RolesGuard` (`common/guards/roles.guard.ts`)

### Bloco 3 — Auth
- [ ] `RedisService` com get/set/del/exists prefixados por env
- [ ] `JwtStrategy` + `JwtAuthGuard` (guard global via `APP_GUARD`)
- [ ] `TokenService` — geração e rotação de refresh tokens
- [ ] `POST /auth/register` — cria org + stages + user em transação
- [ ] `POST /auth/login`
- [ ] `POST /auth/refresh`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] Testes unitários e e2e do módulo Auth
- [ ] Teste de isolamento multi-tenant

### Blocos 4–12 (módulos de domínio)
- Organizations, Users, Pipeline, Leads, Tasks, Activity, AI Engine, Dashboard

### Não entra na Fase 1
- `apps/web` — Next.js frontend (Fase 2)
- Reset de senha, convites, CSV import (Fase 3)
- Billing, webhooks, analytics (Fase 4)
