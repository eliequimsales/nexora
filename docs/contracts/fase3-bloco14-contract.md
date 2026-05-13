# Fase 3 - Bloco 14 Contract

## Objetivo

Fechar melhorias residuais de produto pós-Fase 2 sem reabrir arquitetura: H5, M1, M2, M8, M10 e M11.

Antes de tocar essas melhorias, Claude deve passar por um gate curto de validação pós-Bloco13, porque a auditoria Codex encontrou o Bloco 13 presente no disco, mas ainda não verificável por comando.

## Auditoria pós-Bloco13

Arquivos prometidos no Bloco 13 existem:

- `apps/api/src/modules/leads/leads.service.spec.ts`
- `apps/api/src/modules/workflows/workflow.engine.spec.ts`
- `apps/api/src/modules/proposals/proposals.service.spec.ts`
- `apps/api/src/modules/integrations/integration-crypto.service.spec.ts`
- `apps/api/test/proposal-flow.e2e-spec.ts`
- `docs/implementation/fase2-bloco13-testes-polish.md`

Comandos executados por Codex:

- `pnpm.cmd --filter api test --runInBand`
- `pnpm.cmd --filter api typecheck`
- `pnpm.cmd --filter app typecheck`

Estado observado:

- `api test` falha por compilação antes de rodar toda a suite.
- `integration-crypto.service.spec.ts` e `auth.service.spec.ts` passam.
- `leads.service.spec.ts` falha por `CTX.role` inferido como `string` e uso de matcher inexistente `toHaveBeenCalledOnce`.
- `workflow.engine.spec.ts` e `proposals.service.spec.ts` batem em Prisma Client desatualizado: delegates como `workflowExecution` e `proposal` não existem no client atual.
- `api typecheck` segue falhando principalmente por Prisma Client desatualizado, `stripe` ausente em `node_modules`, DTOs com `strictPropertyInitialization` e callbacks com `any` implícito.
- `app typecheck` ainda falha em `CopilotDrawer.tsx` por `useBatchAiAction` sem import e em `useUpdateProfile.ts` por `OrgUser` sem `orgId` sendo salvo como `AuthUser`.
- `apps/api/node_modules/stripe` não existe no estado verificado.
- `apps/api/node_modules/.prisma/client/index.d.ts` não existe no estado verificado.

## Gate obrigatório antes das melhorias

Claude deve corrigir ou estabilizar estes pontos antes de iniciar H5/M1/M2/M8/M10/M11:

- `apps/api/src/modules/leads/leads.service.spec.ts`
  - Tipar `CTX` como `TenantContext` ou usar `role: 'admin' as const`.
  - Substituir `toHaveBeenCalledOnce()` por matcher Jest suportado, como `toHaveBeenCalledTimes(1)`.
- Ambiente API:
  - Rodar instalação/generate se possível: `pnpm.cmd install` e `pnpm.cmd --filter api prisma generate`.
  - Confirmar que `stripe` fica resolvido em `apps/api/node_modules`.
  - Confirmar que Prisma Client gerado expõe `proposal`, `workflow`, `workflowExecution`, `subscription`, `integrationConfig`, `integrationLog`, `outboundWebhook`.
- `apps/app/components/modules/copilot/CopilotDrawer.tsx`
  - Corrigir referência a `useBatchAiAction`; preferencialmente alinhar com M1 e remover duplicação de batch local.
- `apps/app/lib/hooks/users/useUpdateProfile.ts`
  - Preservar `orgId` ao atualizar o usuário no auth store, sem alterar contrato de API.

Definition of done do gate:

- `pnpm.cmd --filter api test --runInBand` não falha por erro de compilação dos specs do Bloco 13.
- `pnpm.cmd --filter app typecheck` não falha nos dois erros já listados.
- Se `api typecheck` ainda falhar por DTOs strict ou tipos implícitos antigos, registrar causa objetiva no doc de implementação do Bloco 14.

## Escopo exato do Bloco 14

### H5 - Validar slug da URL contra auth store

Problema: o shell autenticado usa dados do token, mas a URL pode exibir slug divergente.

Arquivos:

- `apps/app/app/(app)/[slug]/layout.tsx`
- `apps/app/components/shell/OrgSlugGuard.tsx` (novo, client component)

Contrato:

- Manter `layout.tsx` simples; não converter o shell inteiro em client se não for necessário.
- Criar um guard client que receba `slug` por prop, leia `org.slug` do auth store e faça `router.replace('/${org.slug}/leads')` quando divergir.
- Evitar redirect enquanto auth ainda está carregando.

### M1 - Batch classify com concurrency control

Problema: batch de IA roda sequencialmente, lento para muitos leads.

Arquivos:

- `apps/app/lib/hooks/copilot/useBatchAiAction.ts`
- `apps/app/components/modules/copilot/CopilotDrawer.tsx`

Contrato:

- Adicionar opção `concurrency?: number`, default entre 3 e 5.
- Processar em chunks com `Promise.allSettled`.
- Manter contadores `processed`, `total`, `failed`.
- Atualizar `CopilotDrawer.tsx` para usar o hook ou remover o caminho duplicado local.

### M2 - Sugestões do Copilot não podem se sobrepor

Problema: lead sem classificação pode aparecer em `unclassified_leads` e `stale_no_followup`.

Arquivo:

- `apps/api/src/modules/copilot/copilot.service.ts`

Contrato:

- Na query de `staleNoFollowup`, adicionar `aiClassification: { not: null }`.
- Não alterar a semântica de `hot_no_response`.
- Se criar teste, manter unitário e focado no where gerado ou no retorno agregado.

### M8 - Validação de datas em analytics

Problema: `from` e `to` inválidos chegam até `new Date(...)` e podem virar erro Prisma pouco claro.

Arquivos:

- `apps/api/src/modules/analytics/dto/analytics-period.dto.ts` (novo)
- `apps/api/src/modules/analytics/analytics.controller.ts`
- Opcional: `apps/api/src/modules/analytics/analytics.service.ts`, só se precisar ajustar `parsePeriod`.

Contrato:

- Criar DTO com `@IsOptional()` e `@IsDateString()` para `from` e `to`.
- Aplicar DTO nos endpoints `summary`, `proposals`, `ai` e `ai-summary`.
- Manter compatibilidade com `period`.

### M10 - Tasks de sistema sem falso criador admin

Problema: workflow `create_task` escolhe arbitrariamente o primeiro admin ativo como `createdBy`.

Arquivos:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/workflows/workflow.engine.ts`
- `apps/api/src/modules/tasks/tasks.service.ts`
- `apps/api/src/modules/tasks/dto/task-response.dto.ts`
- `apps/app/types/domain/tasks.ts`
- `apps/app/components/modules/tasks/TaskDetailDrawer.tsx`
- `apps/api/prisma/migrations/*/migration.sql` se migration for gerada

Contrato:

- Tornar `Task.createdBy` nullable no schema.
- Tornar relação `creator` opcional no Prisma.
- Em `WorkflowEngine`, criar task de sistema com `createdBy: null`.
- Em `TasksService`, tratar `creator` opcional no `include` e mapear `createdByName` como `"Sistema"` quando `createdBy` for `null`.
- Frontend deve aceitar `createdBy: string | null` e exibir `"Sistema"` sem quebrar UI.
- Isso requer migration de schema; se o banco local não estiver disponível, registrar que a migration ficou pendente para Bloco 16.

### M11 - `max_tokens` configurável por chamada LLM

Problema: `LlmService.call()` usa `max_tokens: 1024` fixo.

Arquivos:

- `apps/api/src/modules/ai-actions/llm.service.ts`
- Opcional: `apps/api/src/modules/analytics/analytics.service.ts`

Contrato:

- Alterar assinatura para `call(prompt: string, options?: { maxTokens?: number })`.
- Default continua 1024.
- No provider Claude, usar `options?.maxTokens ?? 1024`.
- Se analytics precisar de resposta maior, passar `maxTokens` explicitamente no resumo de IA.
- Não alterar `AiActionsService` além da compatibilidade de assinatura.

## Fora de escopo

- V2/V3 de voz: fica para Bloco 15.
- Migrations manuais I1/I2 e setup de produção: fica para Bloco 16.
- Split de `proposals:manage`: não implementar no MVP; decisão registrada como tech debt.
- Redesign de roles/RBAC.
- Novos módulos.
- Mudanças visuais grandes.

## Riscos

- Começar H5/M1/M2/M8/M10/M11 antes de estabilizar o gate pós-Bloco13 mascara falhas de teste do bloco anterior.
- M10 toca schema e pode exigir migration; não misturar com SQL manual I1/I2.
- H5 em `layout.tsx` deve respeitar a fronteira server/client; o guard precisa ser client.
- M1 pode duplicar lógica se `CopilotDrawer.tsx` continuar com batch local paralelo ao hook.
- Prisma Client desatualizado pode gerar falsos negativos em testes e typecheck.

## Definition of Done

- Gate pós-Bloco13 registrado e sem falhas de compilação nos specs novos.
- H5, M1, M2, M8, M10 e M11 implementados conforme escopo.
- `pnpm.cmd --filter app typecheck` executado.
- `pnpm.cmd --filter api test --runInBand` executado.
- `pnpm.cmd --filter api typecheck` executado ou falhas residuais documentadas com causa objetiva.
- Criar `docs/implementation/fase3-bloco14-melhorias-produto.md`.
- Atualizar `AGORA.md`, `SESSAO_ATUAL.md`, `HANDOFF_CODEX.md` e `LOG_CONTINUO.md`.
