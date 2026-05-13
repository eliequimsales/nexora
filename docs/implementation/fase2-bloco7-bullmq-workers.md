# Bloco 7 — BullMQ Workers

## Objetivo

Migrar execução inline de workflows e entrega direta de webhooks para filas BullMQ com retry, e adicionar agendamento diário de follow-up via cron.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/workers/queue.module.ts` | Registra as 3 filas BullMQ, declara processors e controller de stats |
| `apps/api/src/workers/workflow.processor.ts` | Consome fila `workflows`, chama `WorkflowEngine.processTrigger` |
| `apps/api/src/workers/webhook.processor.ts` | Consome fila `webhooks`, entrega webhooks com retry |
| `apps/api/src/workers/scheduled.processor.ts` | Cron diário + processa jobs de follow-up |
| `apps/api/src/workers/queue-stats.controller.ts` | `GET /admin/queue-stats` — contagens por fila (guard: `org:update` = admin) |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `packages/shared/src/constants/job-names.ts` | Adicionados: `WORKFLOW_TRIGGER`, `WEBHOOK_DISPATCH`, `FOLLOW_UP_SCAN`, `FOLLOW_UP_EXECUTE`, `QUEUE_NAMES` |
| `apps/api/src/modules/workflows/workflows.module.ts` | `BullModule.registerQueue('workflows')`; `WorkflowEngine` exportado |
| `apps/api/src/modules/integrations/integrations.module.ts` | `BullModule.registerQueue('webhooks')`; `WebhookDispatcherService` exportado |
| `apps/api/src/modules/workflows/workflow.engine.ts` | Listeners enfileiram em vez de executar inline; `processTrigger()` público |
| `apps/api/src/modules/integrations/webhook-dispatcher.service.ts` | Listeners enfileiram; `deliverOne()` e `findActiveWebhooks()` públicos para o processor |
| `apps/api/src/app.module.ts` | `BullModule.forRootAsync`, `ScheduleModule.forRoot`, `QueueModule` adicionados |

---

## Filas

| Fila | Job | Retry | Responsável |
|---|---|---|---|
| `workflows` | `workflow.trigger` | 1 tentativa (sem retry automático — engine tem dedupe) | `WorkflowProcessor` |
| `webhooks` | `webhook.dispatch` | 3 tentativas, exponential 60s | `WebhookProcessor` |
| `scheduled-jobs` | `lead.follow_up.execute` | 2 tentativas, exponential 30s | `ScheduledProcessor` |

---

## Fluxo de workflow (antes → depois)

**Antes:**
```
@OnEvent('lead.created') → dispatch() inline → AI action / DB mutation
```

**Depois:**
```
@OnEvent('lead.created') → workflowsQueue.add('workflow.trigger', { triggerType, event })
                         → WorkflowProcessor.process() → WorkflowEngine.processTrigger()
```

`processTrigger(triggerType, event)` é o método público que encapsula a lógica de `dispatch()` com `buildConditionChecker()` interno baseado no `triggerType`.

Os 4 listeners migrados: `lead_created`, `lead_status_changed`, `lead_stage_changed`, `lead_classified`.

---

## Fluxo de webhook (antes → depois)

**Antes:**
```
@OnEvent('...') → dispatch() → fetch() direto → integrationLog (1 linha por tentativa)
```

**Depois:**
```
@OnEvent('...') → webhooksQueue.add('webhook.dispatch', { orgId, eventType, data }, retry)
               → WebhookProcessor.process() → dispatcher.deliverOne() por webhook
               → integrationLog com attempts = job.attemptsMade + 1
```

---

## Cron de follow-up

`ScheduledProcessor` roda `@Cron(CronExpression.EVERY_DAY_AT_9AM)`.

Heurística MVP (reutilizada do CopilotService):
- `followUpCount = 0`
- `createdAt < now - 3 dias`
- `archivedAt = null`
- `status NOT IN ['closed_won', 'closed_lost', 'disqualified']`

Para cada lead elegível, enfileira `lead.follow_up.execute` em `scheduled-jobs`.
O processor chama `AiActionsService.execute('ai_follow_up', leadId, orgId, 'scheduler:follow_up')`.

---

## Configuração BullMQ

```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => {
    const redisUrl = new URL(config.get('redis.url'));
    return { connection: { host, port, password, db, maxRetriesPerRequest: null } };
  },
})
```

Reutiliza o mesmo `REDIS_URL` já presente no ambiente. Não introduz variável nova.

---

## `GET /admin/queue-stats`

Rota: `GET /admin/queue-stats`
Guard: `@RequirePermission('org:update')` (admin)

Resposta:
```json
{
  "workflows": { "waiting": 0, "delayed": 0, "failed": 0 },
  "webhooks": { "waiting": 2, "delayed": 0, "failed": 1 },
  "scheduledJobs": { "waiting": 0, "delayed": 0, "failed": 0 },
  "totalWaiting": 2,
  "totalDelayed": 0,
  "totalFailed": 1
}
```

---

## Decisões de design

- **Sem retry para `workflows`** — engine tem dedupe e escreve `WorkflowExecution`. Retry automático cego poderia duplicar efeitos.
- **DLQ = estado `failed` do BullMQ** — sem tabela nova. Rastreabilidade via `WorkflowExecution` e `IntegrationLog`.
- **`bull-board` não incluída** — evita dependências extras e surface de auth para role inexistente (`owner`).
- **Backoff exponencial com base 60s** para webhooks: ~1min, ~2min, ~4min.
- **Um job por evento de webhook** — todos os webhooks do org para aquele evento são entregues no mesmo job. Falha parcial relança o job inteiro (comportamento simples e aceitável para MVP).

---

## O que testar

- [ ] `@OnEvent('lead.created')` no engine chama `workflowsQueue.add` (não executa inline)
- [ ] `WorkflowProcessor.process()` chama `workflowEngine.processTrigger(triggerType, event)`
- [ ] `@OnEvent('lead.created')` no dispatcher chama `webhooksQueue.add` (não faz fetch direto)
- [ ] `WebhookProcessor.process()` chama `deliverOne` para cada webhook ativo
- [ ] Falha em `deliverOne` causa job retry com `attempts + 1` no log
- [ ] Cron `scanLeadsForFollowUp` enfileira jobs apenas para leads com `followUpCount = 0` e `createdAt < 3 dias`
- [ ] `ScheduledProcessor.process()` chama `aiActionsService.execute('ai_follow_up', ...)`
- [ ] `GET /admin/queue-stats` retorna contagens corretas (acessível por admin, negado para member)
- [ ] **E2E:** criar lead → verificar job `workflow.trigger` enfileirado → processar → verificar `WorkflowExecution` criado
