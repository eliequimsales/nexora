# Bloco 13 — Testes + Polish

## Objetivo

Cobertura de testes nos módulos críticos e limpeza de bugs residuais identificados durante a Fase 2.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/leads/leads.service.spec.ts` | Regressão C1: stageId/assignedTo de outro tenant lança BadRequestException |
| `apps/api/src/modules/workflows/workflow.engine.spec.ts` | Regressão H10: move_stage cross-tenant falha; M9: loop prevention (dedupe) |
| `apps/api/src/modules/proposals/proposals.service.spec.ts` | Fluxo `respond`: expirado, duplicado, accept/reject + transição de status |
| `apps/api/src/modules/integrations/integration-crypto.service.spec.ts` | Roundtrip encrypt/decrypt + guard de chave padrão em produção |
| `apps/api/test/proposal-flow.e2e-spec.ts` | E2E: ingest → classify → create proposal → send → accept → lead closed_won |
| `apps/api/prisma/manual/add_partial_indexes_and_constraints.sql` | I1/I2: partial indexes + CHECK constraints SQL raw |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/api/src/modules/auth/auth.service.spec.ts` | Testes de login corrigidos: passam `slug`; novo teste "slug errado → 401"; novo teste "org suspensa → 401" |
| `apps/app/components/modules/leads/LeadsList.tsx` | L1: removido import `Spinner` não utilizado |
| `apps/api/prisma/schema.prisma` | L2: comentário `triggerType` em `AiExecution` corrigido para `manual \| workflow:<id>`; L4: `@@index([orgId, triggerType, isActive])` adicionado ao modelo `Workflow`; campo `triggerType` aumentado para `@db.VarChar(100)` |
| `apps/api/src/modules/ai-actions/ai-actions.controller.ts` | L3: `NotFoundException` movido para import estático no topo |
| `apps/app/app/(app)/[slug]/layout.tsx` | L5: `CopilotButton` movido para layout global |
| `apps/app/app/(app)/[slug]/leads/page.tsx` | L5: import e uso de `CopilotButton` removidos (agora no layout) |
| `apps/app/lib/hooks/analytics/useAiInsight.ts` | L6: assinatura correta (sem parâmetro supérfluo) |
| `apps/app/app/(app)/[slug]/analytics/page.tsx` | L6: `handleGenerateInsight` passa `{ period }`; `errorMessage` desestruturado e passado para `AiInsightCard` |
| `apps/app/components/modules/analytics/AiInsightCard.tsx` | L6: prop `errorMessage?: string \| null` adicionada; exibida no estado de erro |

---

## Testes unitários

### 1. `leads.service.spec.ts` — C1 regression

Cenários cobertos:
- `update` com `pipelineStageId` de outro tenant → `BadRequestException`
- `update` com `pipelineStageId` inexistente → `BadRequestException`
- `update` com `assignedTo` de outro tenant → `BadRequestException`
- `update` com `assignedTo` inexistente → `BadRequestException`
- `update` feliz com stageId e assignedTo válidos → sucesso

### 2. `workflow.engine.spec.ts` — H10 + M9

Cenários cobertos:
- `move_stage` com `targetStageId` de outro org → `logExecution('failed', ...)`
- `move_stage` com `targetStageId` inexistente → `logExecution('failed', ...)`
- `move_stage` com `targetStageId` do mesmo org → `logExecution('success', ...)` + `lead.update`
- Execução recente encontrada → `logExecution('skipped', { reason: 'duplicate_recent_execution' })`
- Sem execução recente → processa normalmente
- Condição `toStatus` não satisfeita → `logExecution('skipped', { reason: 'condition_not_met' })`

### 3. `proposals.service.spec.ts`

Cenários cobertos:
- `respond` com token desconhecido → `NotFoundException`
- `respond` em proposta `accepted` (já respondida) → `BadRequestException`
- `respond` em proposta expirada → marca `status='expired'` + `BadRequestException`
- `respond('accept')` válido → `$transaction([proposal.update, lead.update])` + evento `proposal.accepted`
- `respond('reject')` válido → `$transaction([proposal.update])` apenas + evento `proposal.rejected`
- `respond('accept')` em proposta `viewed` → aceita normalmente
- `send` em proposta já `sent` → `BadRequestException`

### 4. `integration-crypto.service.spec.ts`

Cenários cobertos:
- `decrypt(encrypt(text)) === text`
- Mesma entrada produz ciphertexts diferentes (IV aleatório)
- Roundtrip de string vazia
- Roundtrip de string com caracteres especiais
- Formato `iv:authTag:cipherHex` (3 partes, IV = 24 hex chars)
- Chave padrão em `NODE_ENV=production` → `throw Error` no startup
- Chave padrão em `NODE_ENV=test` → sem erro

### 5. `auth.service.spec.ts` — adições

- `login` agora passa `slug` em todos os casos
- `login` com `slug` errado (org não encontrada) → `UnauthorizedException`
- `login` com org `suspended` → `UnauthorizedException`
- Mock corrigido: usa `organization.findUnique` + `user.findUnique` em vez de `user.findFirst`

---

## E2E — `proposal-flow.e2e-spec.ts`

Fluxo completo em 10 passos sequenciais (estado compartilhado via `beforeAll`):

1. Register org + captura `accessToken`, `orgSlug`, `formToken`
2. Ingest lead via `POST /ingest/:formToken`
3. Classify lead via `POST /ai-actions/classify/:leadId` (mock LLM)
4. Create proposal via `POST /proposals`
5. Send proposal via `POST /proposals/:id/send` → status `sent` + token
6. Tentar enviar novamente → 400
7. Accept via `POST /public/proposals/:token/respond` (sem auth)
8. Tentar aceitar novamente → 400
9. `GET /leads/:leadId` → status `closed_won`
10. `GET /proposals/:id` → status `accepted`

---

## Polish

### L1 — Spinner removido
`LeadsList.tsx` usava skeleton divs inline; `Spinner` importado nunca foi chamado.

### L2 — Comentário AiExecution.triggerType
`triggerType` armazena `'manual'` (ação do usuário via controller) ou `'workflow:<workflowId>'` (execução via engine). O comentário antigo era legado de um design anterior.

### L3 — Import estático de NotFoundException
`ai-actions.controller.ts` usava `const { NotFoundException } = await import('@nestjs/common')` dentro do handler — dynamic import desnecessário para módulo sempre carregado.

### L4 — Index composto em Workflow
Adicionado `@@index([orgId, triggerType, isActive])`. O engine faz `findMany({ where: { orgId, triggerType, isActive: true } })` — o index composto suporta essa query diretamente. Requer `pnpm prisma migrate dev`.

### L5 — CopilotButton no layout global
O botão estava apenas na página de leads. Movendo para `[slug]/layout.tsx` ele aparece em todas as páginas da org (leads, pipeline, analytics, workflows, etc.) sem repetição de import.

### L6 — errorMessage em useAiInsight / AiInsightCard
- `handleGenerateInsight` chamava `generate(summary, period)` mas o hook só aceita `params?: AnalyticsParams` — corrigido para `generate({ period })`.
- `AiInsightCard` agora recebe `errorMessage?: string | null` e exibe a mensagem real em vez do fallback genérico.

### L7 — Split de `proposals:manage` (avaliação)

Avaliação: manter `proposals:manage` como permissão única por enquanto.

Razão: o MVP não tem papéis suficientemente granulares para justificar split. Uma implementação futura pode criar `proposals:create`, `proposals:send` e `proposals:close` quando houver papel de "vendedor sem fechamento" nos planos enterprise.

**Decisão**: não dividir no Bloco 13. Registrar como tech debt em `06_Decisoes/decisoes-tecnicas.md`.

---

## I1/I2 — Migration SQL manual

Arquivo: `apps/api/prisma/manual/add_partial_indexes_and_constraints.sql`

**I1 — Partial indexes:**
- `idx_workflows_active_trigger`: indexa apenas `is_active = true` (queries do engine filtram por isso)
- `idx_ai_executions_retryable`: indexa apenas `pending | failed` (retry jobs)
- `idx_workflow_executions_pending`: indexa apenas `pending`

**I2 — CHECK constraints:**
- `leads.status` — enum explícito
- `proposals.status` — enum explícito
- `ai_executions.status` — enum explícito
- `workflow_executions.status` — enum explícito
- `subscriptions.plan` — enum explícito

Aplicação: `psql $DATABASE_URL -f apps/api/prisma/manual/add_partial_indexes_and_constraints.sql`

---

## O que testar

- [ ] `pnpm --filter api test leads.service.spec` — 5 testes passando
- [ ] `pnpm --filter api test workflow.engine.spec` — 6 testes passando
- [ ] `pnpm --filter api test proposals.service.spec` — 7 testes passando
- [ ] `pnpm --filter api test integration-crypto.service.spec` — 6 testes passando
- [ ] `pnpm --filter api test auth.service.spec` — todos passando (testes de login corrigidos)
- [ ] E2E: `pnpm --filter api test:e2e proposal-flow` — 10 passos OK (requer DB + mock LLM)
- [ ] `CopilotButton` visível em todas as páginas da org (não só leads)
- [ ] `AiInsightCard` mostra mensagem de erro real quando geração falha
- [ ] Schema: verificar `@@index([orgId, triggerType, isActive])` gerado pelo Prisma
