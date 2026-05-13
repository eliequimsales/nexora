# Fase 2 — Bloco 7 Contract

## Objetivo

Preparar o contrato tecnico do bloco 7 para migrar execucao inline de workflows e entrega direta de webhooks para filas BullMQ reais com retry, agendamento e separacao minima de responsabilidade.

O bloco deve fechar:
- infraestrutura de filas BullMQ sobre Redis ja existente
- processamento assincrono de workflows
- retry assincrono de webhooks
- agendamento diario de jobs operacionais

Fora do escopo:
- worker separado em outro processo
- DLQ persistida em tabela propria
- painel admin obrigatorio
- nova role `owner`
- frontend novo alem do badge opcional de fila

## Auditoria do estado atual

### Ja existe no repositório

Infra:
- Redis ja existe em [docker-compose.yml](/C:/Users/eli/Downloads/Documents/saas-platform/docker-compose.yml) com healthcheck e porta `6379`.
- `REDIS_URL` ja existe em [configuration.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/config/configuration.ts) e [env.validation.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/config/env.validation.ts).
- [RedisService](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/common/redis/redis.service.ts) ja conecta via `ioredis`.

Dependencias:
- `@nestjs/bullmq`
- `bullmq`
- `@nestjs/schedule`
- `ioredis`

Workflows:
- [workflow.engine.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/workflows/workflow.engine.ts) ainda executa inline via `@OnEvent(...) -> dispatch(...)`.
- dedupe e erro canonico ja foram implementados no engine.

Webhooks:
- [webhook-dispatcher.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/webhook-dispatcher.service.ts) ainda faz `fetch` direto e grava `integrationLog`.

Dados uteis para follow-up agendado:
- [copilot.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/copilot/copilot.service.ts) ja usa a heuristica de `createdAt < 3 dias` e `followUpCount = 0`.
- `ActivityLog` ja existe e pode ser usado como sinal de atividade.

### Ainda nao existe

- `src/workers/` nao existe
- `BullModule.forRoot()` nao esta configurado no `AppModule`
- nao ha filas registradas
- nao ha processors
- `ScheduleModule.forRoot()` nao esta registrado no `AppModule`
- nao ha endpoint `/admin/queue-stats`
- nao ha bull-board instalada

## Preparação obrigatória

### Redis

Confirmacao tecnica:
- Redis esta disponivel na stack via `docker-compose`
- nao ha necessidade de nova infra

Pre-requisito operacional:
- `docker compose up -d redis` ou `docker compose up -d`
- validar `redis-cli ping` ou healthcheck `healthy`

### Design das filas

Filas canônicas do bloco:
- `workflows`
- `webhooks`
- `scheduled-jobs`

Objetivo de cada fila:
- `workflows`: processar triggers de workflow fora do thread do evento HTTP
- `webhooks`: entregar webhooks outbound com retry controlado
- `scheduled-jobs`: executar jobs disparados por cron, como follow-up de leads parados

### DLQ

Nao criar DLQ separada agora.

Contrato:
- usar o proprio estado `failed` da BullMQ como DLQ logica no MVP
- manter o historico de falha em:
  - logs do worker
  - `WorkflowExecution` para workflows
  - `IntegrationLog` para webhooks

Opcao futura:
- fila dedicada `*.dlq` fica para bloco posterior, se observabilidade exigir

Motivo:
- menor escopo
- BullMQ ja preserva jobs falhos
- o sistema ja tem tabelas proprias para rastreabilidade operacional

### Backoff

Backoff validado para o bloco:
- retry exponencial com base de `60000 ms`

Sequencia efetiva aproximada:
- tentativa inicial
- retry 1: 1 min
- retry 2: 2 min
- retry 3: 4 min

Observacao importante:
- isso nao implementa literalmente `1min, 5min, 30min`
- se o usuario quiser exatamente `1, 5, 30`, seria necessario backoff custom

Recomendacao do contrato:
- manter `exponential, delay: 60000` no bloco 7
- registrar no doc que `1/5/30` fica como opcao futura se a operacao pedir

## Decisoes de contrato

### 1. Estrutura de workers

Criar:
- `apps/api/src/workers/queue.module.ts`
- `apps/api/src/workers/workflow.processor.ts`
- `apps/api/src/workers/webhook.processor.ts`
- `apps/api/src/workers/scheduled.processor.ts`

Registrar no:
- `apps/api/src/app.module.ts`

Tambem sera necessario registrar:
- `BullModule.forRoot(...)`
- `ScheduleModule.forRoot()`

### 2. Reuso de Redis

Contrato:
- BullMQ deve usar a mesma origem de configuracao do Redis atual (`config.redis.url`)
- nao precisa reutilizar a instancia de `RedisService` diretamente
- `BullModule.forRootAsync()` com `ConfigService` e o caminho mais simples e alinhado com Nest

Motivo:
- evita acoplamento manual entre `RedisService` e BullMQ
- segue padrao do ecossistema Nest + BullMQ

### 3. Queue names e payloads

Recomendacao:
- centralizar nomes de fila e jobs em shared ou em `src/workers/constants`
- [packages/shared/src/constants/job-names.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/constants/job-names.ts) ja existe, mas hoje cobre apenas `lead.created` e `lead.follow_up`

Contrato minimo:
- ou expandir `job-names.ts`
- ou criar constants locais de workers

Payloads canônicos:

`workflows`
- `jobName`: `workflow.trigger`
- payload:
  - `triggerType`
  - `event`

`webhooks`
- `jobName`: `webhook.dispatch`
- payload:
  - `orgId`
  - `eventType`
  - `data`

`scheduled-jobs`
- `jobName`: `lead.follow_up.scan` e/ou `lead.follow_up.execute`
- payload:
  - `orgId?`
  - `leadId?`
  - `daysWithoutActivity`

### 4. WorkflowEngine precisa deixar de ser só listener inline

Prompt pede:
- `workflow.processor.ts` consome fila `workflows`, chama `WorkflowEngine.execute`

Estado real:
- `WorkflowEngine` nao expoe metodo publico de execucao por trigger
- `dispatch()` e privado

Contrato:
- expor um metodo publico no engine, por exemplo:
  - `processTrigger(triggerType, event)`
ou
  - `execute(triggerType, event)`

Esse metodo deve encapsular a logica hoje existente em `dispatch()`.

Os listeners `@OnEvent(...)` passam a:
- montar o payload
- enfileirar job na fila `workflows`
- nao executar action inline

### 5. Scope da migração para fila de workflows

Prompt menciona explicitamente `@OnEvent('lead.created')`, mas o estado real do engine tem 4 listeners:
- `lead.created`
- `lead.status_changed`
- `lead.stage_changed`
- `lead.classified`

Contrato recomendado:
- migrar os 4 listeners para a fila `workflows` no mesmo bloco

Motivo:
- manter metade inline e metade assíncrona aumenta inconsistência operacional
- a infraestrutura de queue já estará pronta

### 6. Webhook dispatcher e H9

Estado atual:
- `WebhookDispatcherService` faz `fetch` direto
- grava `IntegrationLog` uma vez por tentativa direta

Contrato:
- listeners de webhook deixam de chamar `dispatch()` com `fetch`
- passam a enfileirar jobs na fila `webhooks`

Processor:
- `webhook.processor.ts` faz a entrega real
- retry:
  - `attempts: 3`
  - `backoff: { type: 'exponential', delay: 60000 }`

Log:
- cada tentativa deve resultar em `IntegrationLog` com:
  - `status`
  - `httpStatus`
  - `errorMsg`
  - `attempts = job.attemptsMade + 1`

Recomendacao:
- manter uma linha por tentativa, nao tentar fazer update in-place

Motivo:
- schema atual ja e append-friendly
- facilita diagnostico de retries reais

### 7. Scheduled jobs

Prompt pede:
- cron diario que varre leads sem atividade ha X dias

Contrato:
- registrar `ScheduleModule.forRoot()`
- criar um cron diario no `scheduled.processor.ts` ou em provider dedicado no modulo de workers

Heuristica MVP recomendada:
- `followUpCount = 0`
- `createdAt < now - 3 dias`
- `archivedAt = null`

Opcionalmente mais robusto:
- cruzar com ultima `ActivityLog`

Recomendacao pragmatica:
- reaproveitar a heuristica ja usada por `CopilotService`
- nao fazer query pesada de ultima atividade neste bloco

Acao do job:
- enfileirar job em `scheduled-jobs`
- processor dispara `AiActionsService.execute('ai_follow_up', leadId, orgId, 'scheduler:follow_up')`

### 8. Painel admin com bull-board

Prompt marca como opcional.

Estado real importante:
- backend so conhece roles `admin | member`
- `owner` nao existe em:
  - [packages/shared/src/rbac/permissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/rbac/permissions.ts)
  - [tenant-context.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/common/tenant/tenant-context.ts)

Contrato:
- nao expandir o sistema de roles neste bloco
- se bull-board entrar agora, proteger com `admin`
- alternativa aceitavel: deixar bull-board fora deste bloco e entregar apenas `GET /admin/queue-stats`

Recomendacao:
- tratar bull-board como opcional de verdade
- nao adicionar `@bull-board/api` e `@bull-board/express` por default neste bloco

Motivo:
- evita abrir frente de dependencias e auth para role inexistente

### 9. Queue stats endpoint

Frontend opcional pede:
- badge discreto com `X jobs na fila`

Contrato minimo backend:
- criar endpoint leve, por exemplo `GET /admin/queue-stats`
- retorno agregado:
  - `workflows`
  - `webhooks`
  - `scheduledJobs`
  - `totalWaiting`
  - `totalDelayed`
  - `totalFailed`

Guard:
- usar `admin` no estado atual real

Frontend:
- opcional
- se entrar, deve ser discreto no dashboard atual
- se nao entrar, nao bloqueia o fechamento do backend do bloco 7

### 10. Registro no AppModule

Estado atual:
- `AppModule` ainda nao importa `ScheduleModule`
- nao configura `BullModule`

Contrato:
- adicionar `ScheduleModule.forRoot()`
- adicionar `BullModule.forRootAsync(...)`
- importar `QueueModule`

### 11. Retry e rastreabilidade

`workflows`
- sem retry agressivo por default no contrato
- recomendacao: `attempts: 1` ou retry muito conservador

Motivo:
- engine ja tem dedupe e escreve `WorkflowExecution`
- retry automatico cego pode duplicar efeitos se a action nao for totalmente idempotente

`webhooks`
- retry exponencial com 3 tentativas

`scheduled-jobs`
- retry baixo, ex.: `attempts: 2`

### 12. Testabilidade

Contrato de testes do bloco:
- unit/integration:
  - listeners antigos agora chamam `queue.add`
  - processor de workflow chama engine publico
  - processor de webhook grava retries com attempts corretos
  - cron enfileira jobs esperados

E2E sugerido:
- criar lead
- verificar job de workflow enfileirado
- processar job
- verificar `AiExecution` ou `WorkflowExecution`

## Arquivos que a Claude deve tocar

Infra e wiring:
- `apps/api/src/app.module.ts`
- `apps/api/src/workers/queue.module.ts`
- `apps/api/src/workers/workflow.processor.ts`
- `apps/api/src/workers/webhook.processor.ts`
- `apps/api/src/workers/scheduled.processor.ts`

Workflows:
- `apps/api/src/modules/workflows/workflow.engine.ts`

Integrations:
- `apps/api/src/modules/integrations/webhook-dispatcher.service.ts`

Opcional de stats/admin:
- `apps/api/src/modules/dashboard/*` se optar por anexar stats ali
- ou novo controller/provider administrativo enxuto, sem modulo separado grande

Shared constants:
- `packages/shared/src/constants/job-names.ts`
- `packages/shared/src/index.ts` se export mudar

Frontend opcional:
- `apps/app/app/(app)/[slug]/dashboard/page.tsx`
- hooks/api do dashboard ou novo `admin.api.ts` se Claude optar por endpoint dedicado

Documentacao:
- `docs/implementation/fase2-bloco7-bullmq-workers.md`

## Riscos

- usar role `owner` quebraria o backend atual; ela nao existe no dominio real
- retry automatico para workflows pode duplicar efeitos se aplicado sem cuidado
- criar DLQ dedicada agora inflaria escopo sem ganho proporcional
- migrar apenas `lead.created` para fila e manter os outros triggers inline criaria comportamento inconsistente
- query pesada de ultima atividade para todos os leads no cron pode ser cara; melhor usar heuristica simples neste bloco
- bull-board adiciona dependencias e superficie de auth extra; deve continuar opcional de verdade

## Sequencia minima recomendada para Claude

1. configurar `BullModule.forRootAsync` e `ScheduleModule.forRoot`
2. criar `src/workers/` com as 3 filas
3. expor metodo publico de execucao no `WorkflowEngine`
4. migrar listeners de workflow para enfileiramento
5. migrar `WebhookDispatcherService` para enfileiramento
6. implementar processors
7. adicionar cron diario de follow-up
8. opcionalmente expor `queue-stats`
9. documentar o bloco

## Definition of Done deste contrato

O bloco 7 pode ser considerado fechado quando:
- workflows deixam de executar inline nos listeners e passam a enfileirar
- webhooks deixam de fazer `fetch` direto e passam a retryar por BullMQ
- existe fila `scheduled-jobs` com cron diario funcional
- Redis e BullMQ estao configurados no app
- retries de webhook ficam rastreaveis em `IntegrationLog`
- qualquer superficie admin opcional respeita `admin`, nao `owner`
