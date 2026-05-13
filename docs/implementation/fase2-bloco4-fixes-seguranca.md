# Fase 2 — Bloco 4: Fixes de Segurança e Estabilidade

> Contrato: [`docs/contracts/fase2-bloco4-contract.md`](../contracts/fase2-bloco4-contract.md)
> Escopo aprovado: verificar H10/H1/H2, implementar M7/M9/M12.

## Objetivo

Fechar 6 melhorias pendentes sem inflar escopo: zero migrations, zero dependências novas, zero módulos novos.

## Decisões de contrato

1. **H10/H1/H2** estavam implementados. Não reimplementar — apenas verificar.
2. **M7** — mapa `PERMISSIONS` passa a viver em `packages/shared`. Backend mantém só o decorator Nest.
3. **M9** — dedupe por `orgId + workflowId + leadId` em janela de 60s, sem novo campo no schema. Motivo canônico vive em `result.reason`.
4. **M12** — erro `ai_prompt_not_configured` detectado por tipo (`BadRequestException`) + prefixo de mensagem, persistido em `result.errorReason`.
5. **DTO** enriquecido via campos opcionais em `WorkflowWithStatsDto`. UI usa os novos campos para decidir CTA.

## Arquivos alterados

### Backend
- `packages/shared/src/rbac/permissions.ts` — **novo**. Fonte única de verdade para RBAC.
- `packages/shared/src/index.ts` — re-exporta `./rbac/permissions`.
- `apps/api/src/common/rbac/permissions.ts` — reduzido ao decorator Nest (`RequirePermission`, `REQUIRE_PERMISSION_KEY`), importa `PERMISSIONS` do shared.
- `apps/api/src/common/guards/roles.guard.ts` — importa `PERMISSIONS`, `ROLE_HIERARCHY`, `Role` do shared. Remove `ROLE_HIERARCHY` local.
- `apps/api/src/modules/workflows/workflow.engine.ts`
  - Import `BadRequestException` do `@nestjs/common`.
  - Constante `DEDUPE_WINDOW_MS = 60_000`.
  - `hasRecentExecution(orgId, workflowId, leadId)` — retorna `true` se há execução na janela de 60s.
  - `resolveErrorReason(err)` — mapeia `BadRequestException` com mensagem `Prompt "... não configurado` para `ai_prompt_not_configured`.
  - `dispatch()` agora verifica dedupe antes do try/catch de `executeAction` e injeta `errorReason` em `result` quando aplicável.
- `apps/api/src/modules/workflows/workflows.service.ts`
  - `findAll()` passa a buscar a última execução por workflow via `$queryRaw` com `DISTINCT ON` do Postgres e injeta `latestExecution*` no retorno.
- `apps/api/src/modules/workflows/dto/workflow-response.dto.ts`
  - `WorkflowWithStatsDto` ganha campos opcionais: `latestExecutionStatus`, `latestExecutionErrorMessage`, `latestExecutionResult`, `latestExecutionAt`.

### Frontend
- `apps/app/lib/rbac/permissions.ts` — reduzido a re-export de `@reshit/shared` (zero duplicação).
- `apps/app/types/domain/workflows.ts` — `WorkflowExecutionStatus` exportado; `WorkflowWithStats` ganha os mesmos `latestExecution*` opcionais.
- `apps/app/components/modules/workflows/WorkflowRow.tsx`
  - Helper `isPromptMissing(workflow)` — retorna `true` quando `latestExecutionStatus === 'failed'` e `latestExecutionResult.errorReason === 'ai_prompt_not_configured'`.
  - Renderiza `<Link href={'/{slug}/settings'}>Configurar IA</Link>` abaixo da linha de trigger → action quando o helper retorna true. `e.stopPropagation()` no link para não disparar o `onClick` da row.

## Verificação H10 / H1 / H2 (já implementados)

| Item | Onde está | Estado |
|------|-----------|--------|
| H10 | `workflow.engine.ts` linhas ~137-143 (action `move_stage`) | valida `stage.orgId === event.orgId` antes do update — correto |
| H1 | `auth/dto/register.dto.ts` linha 23 | `@MaxLength(72)` em `password` — correto |
| H2 | `auth.controller.ts` linhas 41 e 54 | `@Throttle({ default: { ttl: 60_000, limit: 5 } })` em `register` e `login` — correto |

Não houve nova implementação para esses itens.

## Detalhes de implementação

### M7 — RBAC shared

O mapa `PERMISSIONS` do backend era mais completo que o do frontend (frontend estava faltando `leads:update`, `pipeline:read`, `integrations:read`, `integrations:manage`). Consolidei usando o conjunto do backend como fonte única.

O arquivo `apps/app/lib/rbac/permissions.ts` foi mantido como ponto de import preservado — agora só re-exporta do shared. Isso evita churn em `usePermissions.ts` e `CanDo.tsx`, que continuam importando de `@/lib/rbac/permissions`.

O backend guarda apenas o decorator Nest (`RequirePermission`, `REQUIRE_PERMISSION_KEY`) porque `SetMetadata` depende de Nest e não deve vazar para o pacote compartilhado.

### M9 — Dedupe de execução recente

A janela de 60s aplica somente quando as condições do trigger batem (`conditionCheck` já passou). O dedupe roda antes do `try/catch` de `executeAction`, então uma execução duplicada não chega a tocar `AiActionsService` ou Prisma write paths.

Chave: `(orgId, workflowId, leadId)` + `executedAt >= now - 60s`. O índice `[leadId, executedAt(sort: Desc)]` no `WorkflowExecution` atende a busca.

Persistência:
```json
{
  "status": "skipped",
  "result": { "reason": "duplicate_recent_execution" },
  "errorMessage": null
}
```

### M12 — Erro canônico `ai_prompt_not_configured`

Detecção: `err instanceof BadRequestException` **E** `err.message` começa com `Prompt "` e contém `não configurado`. O casamento por prefixo/substring é intencional: a origem do throw é única (`AiActionsService.execute()` linha 50) e a mensagem é controlada por nós, então é estável.

Persistência:
```json
{
  "status": "failed",
  "result": { "errorReason": "ai_prompt_not_configured" },
  "errorMessage": "Prompt \"classify\" não configurado para este org. Configure em Configurações → IA."
}
```

### Enrich `GET /workflows`

A última execução por workflow é buscada em uma query única usando `DISTINCT ON (workflow_id)` do Postgres. Não é N+1 — mesma ida ao banco que a contagem agregada.

Nomes em snake_case na raw query porque o schema usa `@map(...)` (`workflow_id`, `error_message`, `executed_at`).

### CTA "Configurar IA" na UI

Renderiza apenas quando o workflow falhou por prompt ausente na última execução. O link vai para `/[slug]/settings` — ponto canônico onde `aiPrompts` são editados. `e.stopPropagation()` garante que clicar no link não dispara o `onClick` da row (que eventualmente abrirá um detalhamento).

## Testes sugeridos

### Unit
- `workflow.engine.spec.ts`
  - dedupe: segundo trigger para o mesmo `(orgId, workflowId, leadId)` dentro de 60s persiste `status='skipped'` + `result.reason='duplicate_recent_execution'` e não chama `executeAction`.
  - dedupe: após 61s, segundo trigger executa normalmente.
  - errorReason: `BadRequestException` com mensagem de prompt ausente → `status='failed'` + `result.errorReason='ai_prompt_not_configured'`.
  - errorReason: qualquer outra exception → `status='failed'` + `result={}` + `errorMessage` preservado.
  - H10 smoke: `move_stage` com `targetStageId` de outro org → exception + execution `failed`.

### Integration
- `GET /workflows` retorna `latestExecutionStatus`, `latestExecutionResult`, etc. quando há execuções; retorna sem esses campos quando não há.
- RBAC: `@RequirePermission('workflows:manage')` em endpoint bloqueia `member` e aceita `admin` — exercita o mapa vindo de `@reshit/shared`.

### E2E UI
- Workflow com `latestExecutionResult.errorReason === 'ai_prompt_not_configured'` renderiza link "Configurar IA" apontando para `/{slug}/settings`.
- Toggle do workflow (switch) continua funcionando independente do CTA.

## Fora de escopo (mantido para blocos futuros)

- Criar coluna `errorReason` no `WorkflowExecution` — hoje convive bem em `result`.
- Endpoint dedicado de execuções por workflow para UI em tempo real.
- Normalizar outras falhas recorrentes (`lead_not_found`, etc) com motivos canônicos.
- Dedupe cross-trigger (mesmo lead, workflows diferentes).

## Definition of Done — estado final

- [x] Mapa `PERMISSIONS` não duplicado (fonte única em `@reshit/shared`).
- [x] Dedupe `duplicate_recent_execution` em janela de 60s.
- [x] Motivo canônico `ai_prompt_not_configured` estável em `result.errorReason`.
- [x] UI consegue renderizar "Configurar IA" usando campos do `GET /workflows` sem endpoint novo.
- [x] H10, H1, H2 verificados no estado final.
