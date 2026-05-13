# Bloco 14 — Melhorias de produto (Fase 3)

## Objetivo

Fechar 6 melhorias residuais identificadas durante a Fase 2: validação de datas, concorrência no batch, overlap de sugestões, createdBy nullable em tasks, max_tokens configurável e validação de slug na URL.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/analytics/dto/analytics-period.dto.ts` | M8: DTO com `@IsDateString` para `from`/`to` e `@IsIn` para `period` |
| `apps/app/components/shell/SlugGuard.tsx` | H5: client component que redireciona se URL slug diverge do auth store |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/api/src/modules/ai-actions/llm.service.ts` | M11: `call(prompt, maxTokens = 1024)` — parâmetro opcional com default 1024 |
| `apps/api/src/modules/analytics/analytics.service.ts` | M8: `parsePeriod` valida datas com `isNaN` + verifica `from <= to`; importa `BadRequestException` |
| `apps/api/src/modules/analytics/analytics.controller.ts` | M8: todos os handlers usam `@Query() params: AnalyticsPeriodDto` |
| `apps/api/src/modules/copilot/copilot.service.ts` | M2: query `stale_no_followup` adiciona `aiClassification: { not: null }` |
| `apps/app/lib/hooks/copilot/useBatchAiAction.ts` | M1: loop sequencial → chunks de 4 com `Promise.allSettled`; constante `CHUNK_SIZE = 4` |
| `apps/api/prisma/schema.prisma` | M10: `Task.createdBy String?` (nullable); relação `creator User?` (opcional) |
| `apps/api/src/modules/workflows/workflow.engine.ts` | M10: `create_task` remove `findFirst` de admin; passa `createdBy: null` |
| `apps/api/src/modules/tasks/dto/task-response.dto.ts` | M10: `createdBy` e `createdByName` `string | null` |
| `apps/api/src/modules/tasks/tasks.service.ts` | M10: todos os callers de `mapTask` usam `creator?.name ?? null` |
| `apps/app/types/domain/tasks.ts` | M10: `createdBy` e `createdByName` `string | null` |
| `apps/app/components/modules/tasks/TaskDetailDrawer.tsx` | M10: exibe `createdByName ?? 'sistema'` |
| `apps/app/app/(app)/[slug]/layout.tsx` | H5: recebe `params: { slug }` e renderiza `<SlugGuard slug={params.slug} />` |

---

## Detalhes por item

### M11 — LlmService maxTokens

`LlmService.call()` aceita `maxTokens?: number` com default 1024. Compatível com todos os callers existentes — nenhum caller precisou ser alterado. Callers que precisarem de mais tokens (ex: analytics AI summary) podem passar `maxTokens: 2048`.

### M8 — Analytics date validation

`AnalyticsPeriodDto` com `@IsDateString` para `from`/`to` e `@IsIn(['7d','30d','90d'])` para `period`. O controller usa `@Query() params: AnalyticsPeriodDto` em todos os 4 endpoints com período. O ValidationPipe global do NestJS retorna 400 automaticamente para valores inválidos antes de entrar no handler. `parsePeriod()` também valida `from <= to` e lança 400 explícito.

### M2 — Copilot suggestions overlap

`stale_no_followup` agora inclui `aiClassification: { not: null }`. Lead sem classificação já aparece em `unclassified_leads` — excluí-los de `stale_no_followup` elimina duplicidade no painel de sugestões.

### M1 — Batch classify concurrency

Substituiu loop `for` sequencial por `for` em chunks de 4 com `Promise.allSettled`. Para 50 leads: ~13 rodadas de 4 chamadas paralelas em vez de 50 seriais. `Promise.allSettled` garante que uma falha não cancela o chunk inteiro — comportamento de `failed++` preservado.

### M10 — Task.createdBy nullable

Schema: `createdBy String? @map("created_by")` + relação `creator User?` (opcional). Migration necessária: `pnpm prisma migrate dev --name make-task-created-by-nullable`. O WorkflowEngine não busca mais admin ativo para `create_task` — passa `createdBy: null`. UI exibe `'sistema'` quando `createdByName` é null.

### H5 — Slug URL guard

`SlugGuard` é um Client Component que usa `useAuthStore` e `useRouter`. Quando `org.slug !== params.slug` redireciona para `/${org.slug}/leads`. Aguarda `isLoading = false` antes de comparar para evitar redirect prematuro durante hidratação. O layout continua sendo Server Component — nenhuma conversão necessária.

---

## O que testar

- [ ] `GET /analytics/summary?from=ontem` → 400 com mensagem de validação
- [ ] `GET /analytics/summary?from=2024-01-01&to=2023-12-01` → 400 (`"from" deve ser anterior a "to"`)
- [ ] `GET /analytics/summary?period=7d` → 200 (período relativo não afetado)
- [ ] Copilot: lead sem classificação criado há 4 dias → só aparece em `unclassified_leads`, não em `stale_no_followup`
- [ ] Batch classify: abrir DevTools Network, acionar batch em 8+ leads → requisições em grupos de 4
- [ ] Criar task via workflow (mock) → `createdByName` = null no banco → UI exibe "sistema"
- [ ] Criar task via UI normal → `createdByName` = nome do usuário
- [ ] Acessar `/org-errada/leads` logado como org-certa → redireciona para `/org-certa/leads`
- [ ] Acessar `/org-certa/leads` logado como org-certa → sem redirect
- [ ] `LlmService.call(prompt, 2048)` → envia `max_tokens: 2048` para a API

---

## Nota sobre migration

`Task.createdBy` foi tornado nullable no schema. É necessário rodar:
```bash
pnpm.cmd --filter api prisma migrate dev --name make-task-created-by-nullable
```
Registros existentes no banco com `createdBy` preenchido continuam válidos — a migration apenas remove a constraint NOT NULL da coluna.
