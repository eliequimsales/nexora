# Fundação B'reshit — Documentação Técnica v1

> **Status:** Implementada e revisada  
> **Data:** 2026-04-22  
> **Revisão arquitetural:** Concluída — pendências críticas identificadas (ver seção 7)

---

## 1. O que foi implementado

A fundação cobre toda a infraestrutura necessária para um SaaS multi-tenant com autenticação, controle de acesso, CRM base e interface operacional. Nenhum módulo de produto avançado foi iniciado — a fundação é intencionalmente genérica e extensível.

**Camadas implementadas:**
- Infraestrutura de autenticação e sessão
- Multi-tenancy com isolamento por `orgId`
- RBAC com permissões semânticas
- Módulos de domínio: Organizations, Users, Leads, Pipeline
- Dashboard operacional
- App Shell com navegação e layout responsivo
- UI primitiva reutilizável

---

## 2. Módulos concluídos

### Backend (NestJS)

| Módulo | Status | Endpoints |
|--------|--------|-----------|
| Auth | ✅ Completo | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Organizations | ✅ Completo | `GET /organizations/me`, `PATCH /organizations/me` |
| Users | ✅ Completo | `GET /users/me`, `PATCH /users/me`, `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `POST /users/invite` |
| Dashboard | ✅ Completo | `GET /dashboard/summary`, `GET /dashboard/activity` |
| Leads | ✅ Completo | `POST /leads`, `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id`, `DELETE /leads/:id` |
| Pipeline | ✅ Completo | `GET /pipeline/board`, `PATCH /pipeline/stages/:id` |

### Frontend (Next.js 14 App Router)

| Área | Status | Telas |
|------|--------|-------|
| Auth | ✅ Completo | `/login` |
| App Shell | ✅ Completo | Sidebar, TopBar, UserDropdown |
| Dashboard | ✅ Completo | `/[slug]/dashboard` |
| Leads | ✅ Completo | `/[slug]/leads` |
| Pipeline | ✅ Completo | `/[slug]/pipeline` |
| Settings | 🔲 Placeholder | `/[slug]/settings` |
| Workflows | 🔲 Placeholder | `/[slug]/workflows` |

---

## 3. Arquitetura

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL |
| Cache / Sessão | Redis |
| Autenticação | JWT (access) + httpOnly cookie (refresh) |
| Monorepo | pnpm workspaces |
| State (frontend) | Zustand (auth) + TanStack Query v5 (server state) |
| Formulários | react-hook-form + zod |
| UI | CVA (class-variance-authority) + Tailwind |

### Estrutura de pastas

```
saas-platform/
├── apps/
│   ├── api/                         # NestJS backend
│   │   ├── prisma/schema.prisma     # Modelo de dados completo
│   │   └── src/
│   │       ├── app.module.ts        # Raiz — registra guards globais
│   │       ├── common/
│   │       │   ├── decorators/      # @CurrentUser()
│   │       │   ├── guards/          # RolesGuard
│   │       │   ├── helpers/         # pagination.helper.ts
│   │       │   ├── rbac/            # permissions.ts — fonte única de verdade RBAC
│   │       │   ├── redis/           # RedisService
│   │       │   └── tenant/          # TenantContext, assertSameTenant()
│   │       └── modules/
│   │           ├── auth/            # Auth + Token service
│   │           ├── organizations/
│   │           ├── users/
│   │           ├── dashboard/
│   │           ├── leads/
│   │           └── pipeline/
│   └── app/                         # Next.js frontend
│       ├── app/
│       │   ├── (auth)/login/
│       │   └── (app)/[slug]/
│       │       ├── dashboard/
│       │       ├── leads/
│       │       └── pipeline/
│       ├── components/
│       │   ├── modules/             # Componentes por domínio
│       │   ├── shell/               # Sidebar, TopBar, UserDropdown
│       │   └── ui/                  # Primitivas: Button, Input, Badge, Avatar, Spinner
│       ├── lib/
│       │   ├── api/                 # Clientes HTTP por módulo
│       │   ├── hooks/               # Hooks TanStack Query por módulo
│       │   ├── rbac/                # Espelho frontend do PERMISSIONS map
│       │   └── stores/              # Zustand: auth.store.ts
│       └── types/domain/            # Tipos TypeScript por módulo
└── packages/shared/                 # Código compartilhado (niche configs)
```

### Modelo de dados (entidades principais)

```
Organization  ─── 1:N ──→  User
Organization  ─── 1:N ──→  PipelineStage
Organization  ─── 1:N ──→  Lead
Lead          ─── N:1 ──→  PipelineStage
Lead          ─── N:1 ──→  User (assignedTo)
Lead          ─── 1:N ──→  Task
Lead          ─── 1:N ──→  ActivityLog
Lead          ─── 1:N ──→  AiExecution
```

---

## 4. Decisões técnicas tomadas

### Auth: dual-token com refresh rotativo

Access token JWT (curto prazo, em memória no Zustand) + refresh token httpOnly cookie. O refresh token é armazenado no Redis como `sha256(tokenId)` com TTL de 7 dias. Cada refresh gera um novo par de tokens (rotação total). Um "dedup lock" no cliente axios impede múltiplos refreshes simultâneos (race condition resolvido).

**Por quê:** Maior segurança que session cookie puro; elimina o problema de roubo de token via XSS (access token só existe em memória JS, não em localStorage).

---

### Multi-tenancy: shared schema com orgId em todas as tabelas

Todas as entidades têm `orgId`. O `TenantContext` é extraído do JWT verificado pelo `JwtStrategy` e injetado via `@CurrentUser()` em todos os controllers. Nunca vem do body da requisição.

**Por quê:** Mais simples de operar que schema-per-tenant; adequado para MVP e crescimento até 10k+ orgs.

```typescript
// TenantContext — propagado a todos os services
interface TenantContext {
  userId: string;
  orgId: string;
  role: 'admin' | 'member';
  tokenId: string;
}
```

---

### RBAC: permissões semânticas mapeadas a roles mínimas

Um único mapa `PERMISSIONS` no backend define qual role mínima cada permissão exige. O `RolesGuard` resolve a role a partir da permissão declarada em `@RequirePermission('permission:name')`.

```typescript
// apps/api/src/common/rbac/permissions.ts
const PERMISSIONS = {
  'org:read': 'member',     'org:update': 'admin',
  'users:list': 'member',   'users:update': 'admin',   'users:invite': 'admin',
  'leads:read': 'member',   'leads:create': 'member',  'leads:update': 'member',  'leads:delete': 'admin',
  'pipeline:read': 'member','pipeline:manage': 'admin',
  'settings:read': 'member','settings:update': 'admin',
}
```

**Por quê:** Desacopla o código de autorização da hierarquia de roles. Adicionar uma nova role (ex: `owner`, `viewer`) não exige alterar controllers — só o mapa.

---

### Guards globais via APP_GUARD

`JwtAuthGuard` e `RolesGuard` são registrados via `APP_GUARD` no `AppModule`, não via `app.useGlobalGuards()`. Isso garante que o `Reflector` é injetado corretamente via DI.

**Por quê:** `useGlobalGuards()` cria o guard fora do contexto NestJS — o `Reflector` não funciona, quebrando toda a leitura de metadados de decorators.

---

### assertSameTenant — NotFoundException ao invés de ForbiddenException

```typescript
// Lança 404, não 403
export function assertSameTenant(entityOrgId: string, ctxOrgId: string): void {
  if (entityOrgId !== ctxOrgId) throw new NotFoundException();
}
```

**Por quê:** Um `403` confirma que o recurso existe. Um `404` não revela a existência de recursos de outros tenants — previne enumeração.

---

### Optimistic update no Kanban

`useMoveLead` implementa optimistic update com rollback automático via `onMutate` / `onError` do TanStack Query. O card se move visualmente antes da confirmação do servidor; se falhar, o estado anterior é restaurado.

---

### Settings de org: merge em vez de replace

`OrganizationsService.update()` faz `{ ...currentSettings, ...dto.settings }` em vez de substituir o objeto inteiro. Patches parciais não sobrescrevem campos não incluídos.

---

### Rota GET /users/me antes de GET /users/:id

Controllers NestJS resolvem rotas na ordem em que são declaradas. Se `GET /:id` viesse antes de `GET /me`, a string "me" seria tratada como UUID e falharia no `ParseUUIDPipe`.

---

## 5. Arquivos principais

### Backend

| Arquivo | Responsabilidade |
|---------|-----------------|
| `prisma/schema.prisma` | Modelo de dados completo com todos os índices |
| `src/app.module.ts` | Raiz do módulo, guards globais |
| `src/common/rbac/permissions.ts` | Fonte única de verdade de autorização |
| `src/common/tenant/tenant-context.ts` | Interface `TenantContext` |
| `src/common/tenant/assert-same-tenant.ts` | Proteção cross-tenant |
| `src/common/helpers/pagination.helper.ts` | `parsePagination()`, `buildPaginatedResult()` |
| `src/modules/auth/auth.service.ts` | Registro, login, refresh, logout |
| `src/modules/auth/token.service.ts` | Geração e validação de tokens JWT + Redis |
| `src/modules/auth/strategies/jwt.strategy.ts` | Extração do `TenantContext` do JWT |
| `src/modules/leads/leads.service.ts` | CRUD de leads + ActivityLog |
| `src/modules/pipeline/pipeline.service.ts` | Board com leads embutidos |
| `src/modules/dashboard/dashboard.service.ts` | 9 queries paralelas de KPIs |

### Frontend

| Arquivo | Responsabilidade |
|---------|-----------------|
| `middleware.ts` | Proteção de rotas no edge (cookie check) |
| `app/(app)/layout.tsx` | Auth guard client-side com redirect |
| `app/(app)/[slug]/layout.tsx` | App shell (Sidebar + TopBar) |
| `lib/stores/auth.store.ts` | Estado de autenticação global (Zustand) |
| `lib/api/client.ts` | Axios com interceptor de refresh automático |
| `lib/rbac/permissions.ts` | Espelho do PERMISSIONS map para o frontend |
| `components/shared/CanDo/CanDo.tsx` | Renderização condicional por permissão |
| `components/shell/Sidebar.tsx` | Navegação principal com active state |
| `components/modules/pipeline/KanbanBoard.tsx` | Drag-and-drop HTML5 nativo |
| `lib/hooks/pipeline/useMoveLead.ts` | Mutation com optimistic update |

---

## 6. Testes recomendados

### Críticos (implementar antes de qualquer deploy)

**Auth:**
- [ ] Registro cria org, user e stages iniciais em uma única transação
- [ ] Login com credenciais inválidas retorna 401 (nunca 404 ou 500)
- [ ] Refresh token rotaciona par completo; token antigo é invalidado
- [ ] Uso do refresh token expirado retorna 401
- [ ] Tentativa de reuso de refresh token já consumido retorna 401

**Multi-tenancy:**
- [ ] Usuário da org A não consegue ler leads da org B via `GET /leads/:id`
- [ ] Usuário da org A não consegue criar lead com `pipelineStageId` da org B *(IDOR crítico — ver pendências)*
- [ ] `assertSameTenant` retorna 404 (não 403) para recursos cross-tenant

**RBAC:**
- [ ] `member` não consegue acessar rotas com `@RequirePermission('org:update')`
- [ ] `admin` consegue acessar todas as rotas
- [ ] Rota pública (`@Public()`) não requer token

**Leads:**
- [ ] Criação registra ActivityLog `lead_created`
- [ ] Mudança de status registra ActivityLog `stage_changed`
- [ ] Arquivamento (DELETE) seta `archivedAt` e não deleta o registro

**Pipeline:**
- [ ] Board retorna estágios ordenados por `position`
- [ ] Lead arquivado (`archivedAt != null`) não aparece no board

### Recomendados (antes da v1 pública)

- [ ] Rate limit aplicado nas rotas de auth (login, register, refresh)
- [ ] Pesquisa de leads com `search` retorna resultados case-insensitive
- [ ] Paginação de leads retorna `totalPages` correto
- [ ] Optimistic update do Kanban faz rollback quando API falha

---

## 7. Pendências

### Críticas — bloqueiam produção

| # | Problema | Localização | Impacto |
|---|---------|------------|---------|
| C1 | **IDOR:** `pipelineStageId` e `assignedTo` aceitos sem validar se pertencem ao mesmo org | `leads.service.ts` — `create()` linha 24, `update()` linhas 85-86 | Escrita cross-tenant no banco |
| C2 | **Login não-determinístico:** `findFirst({ where: { email } })` sem filtro de orgId — mesmo email em duas orgs retorna usuário aleatório | `auth.service.ts` linha 95 | Usuário pode logar no contexto da org errada |
| C3 | **Board sem paginação:** `getBoard()` carrega todos os leads sem limite | `pipeline.service.ts` linha 18 | OOM / timeout em orgs com volume |

### Alta severidade

| # | Problema | Localização |
|---|---------|------------|
| H1 | `password` sem `@MaxLength(72)` — bcrypt trunca silenciosamente, vetor de DoS | `auth/dto/register.dto.ts` |
| H2 | Auth endpoints sem throttle dedicado — compartilham budget global de 100 req/min | `auth.controller.ts` |
| H3 | Partial indexes `WHERE archived_at IS NULL` documentados no schema mas não aplicados | `prisma/schema.prisma` linhas 122-123 |
| H4 | Frontend `permissions.ts` desatualizado — `leads:update` existe no backend mas não no frontend | `app/lib/rbac/permissions.ts` |
| H5 | `[slug]` na URL não validado contra `org.slug` do auth store | `app/(app)/[slug]/layout.tsx` |

### Média severidade

| # | Problema |
|---|---------|
| M1 | `PATCH /users/me` anotado com `@RequirePermission('users:read')` — deveria ser write |
| M2 | Role `'owner'` no frontend `hasRole()` não existe no backend |
| M3 | `org.settings` é JSON livre sem schema — superfície de ataque quando Workflows gravarem config aqui |
| M4 | Dashboard sem cache Redis — 9 queries por poll de 30s por org |
| M5 | `useOrg()` / `useTenant()` lançam erro em vez de retornar null durante hidratação |

### Técnica

| # | Problema |
|---|---------|
| T1 | `dashboard:read` inexistente — reutiliza `leads:read` semanticamente errado |
| T2 | `where: any` em `LeadsService.findAll` — deveria ser `Prisma.LeadWhereInput` |
| T3 | `formToken` exposto no response de auth — deveria ser endpoint admin-only |
| T4 | Drag-and-drop HTML5 sem suporte a touch (mobile) |

---

## 8. Próximos módulos ideais

A fundação está preparada para receber os módulos abaixo. A ordem respeita as dependências entre eles.

### Fase 2 — Correções obrigatórias (antes de tudo)

Corrigir C1, C2, C3, H1–H5 da seção 7. Estimativa: 1 sessão focada.

### Fase 3 — Produto

| Módulo | Depende de | Valor |
|--------|-----------|-------|
| **Workflows** | Leads, Pipeline | Automação de ações quando lead muda de estágio |
| **AI Actions** | Workflows, `aiPrompts` da org | Classificação e resposta automática via LLM |
| **Tasks** | Leads (FK já existe) | Tarefas vinculadas a leads com due date |
| **Lead Detail** | Leads, ActivityLog, Tasks | Página individual do lead com histórico completo |
| **Settings** | Organizations, Users | Configuração de prompts IA, niche data, integrações |
| **Analytics** | Leads, Pipeline, AiExecution | Métricas de funil, taxa de conversão, uso de IA |
| **Templates** | Workflows, AI Actions | Configurações pré-prontas por nicho |
| **Notificações** | EventEmitter (já registrado) | Alertas em tempo real para ações críticas |

### Sequência recomendada

```
Correções (C1-C3, H1-H5)
    ↓
Tasks + Lead Detail     ← alta densidade de valor, baixa complexidade
    ↓
Workflows               ← base para IA e automações
    ↓
AI Actions              ← consome workflows + aiPrompts da org
    ↓
Settings completo       ← configura prompts e integrações
    ↓
Analytics               ← consome dados já existentes
    ↓
Templates por nicho     ← empacota tudo para onboarding rápido
```

---

## Referências rápidas

| Necessidade | Onde olhar |
|------------|-----------|
| Adicionar nova permissão | `api/src/common/rbac/permissions.ts` + `app/lib/rbac/permissions.ts` |
| Criar novo módulo backend | Copiar estrutura de `leads/` — service, controller, DTOs, module |
| Criar novo hook de query | Copiar `useLeadsQuery.ts` — queryKey, queryFn, staleTime |
| Acessar contexto do tenant em controller | `@CurrentUser() ctx: TenantContext` |
| Validar pertencimento ao tenant em service | `assertSameTenant(entity.orgId, ctx.orgId)` |
| Adicionar rota pública (sem auth) | Decorar com `@Public()` |
| Renderização condicional por permissão | `<CanDo permission="x:y">` |
