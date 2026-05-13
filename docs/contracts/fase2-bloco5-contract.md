# Fase 2 — Bloco 5 Contract

## Objetivo

Preparar o contrato tecnico do bloco 5 para entregar o modulo completo de `Tasks` no estado atual real do projeto, sem reinventar arquitetura e sem abrir escopo de notificacoes, email ou workers.

O bloco deve fechar:
- CRUD backend de tasks
- UI frontend dedicada de tasks
- integracao minima com lead e voice layer
- permissao compartilhada no RBAC

Fora do escopo:
- notifications
- email
- BullMQ
- tasks sem `leadId`
- automacoes novas alem do evento `task.created`

## Auditoria do estado atual

### Ja existe no repositório

Schema Prisma:
- [schema.prisma](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/prisma/schema.prisma) ja possui `model Task` com:
  - `id`
  - `orgId`
  - `leadId`
  - `createdBy`
  - `assignedTo`
  - `title`
  - `status`
  - `dueDate`
  - `completedAt`
  - `createdAt`
  - `updatedAt`

Workflow engine:
- [workflow.engine.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/workflows/workflow.engine.ts) ja cria task na action `create_task` via `prisma.task.create`.
- ja grava `activityLog` do tipo `task_created`.

Voice layer:
- [useVoiceActionController.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/voice-actions/useVoiceActionController.ts) ja reconhece a intent `create_task`.
- hoje a intent esta marcada como `planned` e nao executa mutacao real.

Infra estrutural pronta para reuso:
- `EventEmitterModule` global em [app.module.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/app.module.ts)
- helper de paginacao em [pagination.helper.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/common/helpers/pagination.helper.ts)
- RBAC compartilhado em [packages/shared/src/rbac/permissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/rbac/permissions.ts)
- query de usuarios pronta para popular `assignedTo`:
  - [users.api.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/api/users.api.ts)
  - [useUsersQuery.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/users/useUsersQuery.ts)
- shell com sidebar pronta em [Sidebar.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/shell/Sidebar.tsx)

### Nao existe ainda

Backend:
- `src/modules/tasks/` nao existe
- nao ha endpoints `/tasks`
- `task.created` ainda nao e emitido por um modulo proprio

Frontend:
- `types/domain/tasks.ts` nao existe
- `lib/api/tasks.api.ts` nao existe
- `lib/hooks/tasks/` nao existe
- `components/modules/tasks/` nao existe
- `app/(app)/[slug]/tasks/page.tsx` nao existe
- item `Tarefas` nao existe na sidebar
- `LeadDetailModal` ainda nao conecta `create_task`

## Decisoes de contrato

### 1. Nao abrir migration

O model `Task` ja existe. Este bloco nao deve criar migration nem alterar schema Prisma.

### 2. Regra de ownership

No MVP:
- toda task precisa de `leadId`
- toda task precisa de `createdBy`
- `assignedTo` e opcional

Origem:
- criacao manual: `createdBy = ctx.userId`
- criacao por workflow: manter comportamento atual do engine neste bloco

### 3. Regras de validacao

Backend deve validar:
- `leadId` pertence ao mesmo `orgId` do usuario autenticado
- `assignedTo`, quando presente, pertence ao mesmo `orgId`
- `assignedTo`, quando presente, idealmente deve estar `active`
- `status` permitido no MVP: `pending | done`

### 4. Regras de transicao de status

Contrato de update:
- quando `status` muda para `done`:
  - `completedAt = now()`
- quando `status` volta para `pending`:
  - `completedAt = null`

Isso deve valer tanto para `PATCH /tasks/:id` quanto para qualquer helper de conclusao no frontend.

### 5. Evento de dominio

Toda criacao manual por `POST /tasks` deve emitir:
- `task.created`

Payload minimo recomendado:
- `orgId`
- `taskId`
- `leadId`
- `createdBy`
- `assignedTo`
- `status`

Observacao:
- este bloco nao precisa criar listener novo para `task.created`
- o evento entra para preparar blocos futuros

### 6. Activity log

Como o sistema ja usa `ActivityLog` por lead, tasks devem refletir no historico do lead.

Contrato:
- criacao manual gera `activityLog` tipo `task_created`
- marcar como done gera `activityLog` tipo `task_done`

Se houver retorno de `done -> pending`, nao abrir tipo novo agora; manter simples no MVP.

### 7. Permissoes

Adicionar no mapa compartilhado:
- `tasks:read` => `member`
- `tasks:manage` => `member`

Motivo:
- tarefas sao operacionais e precisam ser manipuladas por membros do time no MVP

### 8. Endpoints

Backend deve expor:
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`

Contrato detalhado:

`GET /tasks`
- paginado
- filtros:
  - `status`
  - `assignedTo`
  - `leadId`
  - `page`
  - `limit`
- default sugerido:
  - `page=1`
  - `limit=20`
- ordenacao recomendada:
  - `status asc`
  - `dueDate asc nulls last`
  - `createdAt desc`

`GET /tasks/:id`
- retorna task do mesmo tenant

`POST /tasks`
- requer `leadId`
- aceita:
  - `title`
  - `leadId`
  - `assignedTo?`
  - `dueDate?`
- define `status = pending`
- define `createdBy = ctx.userId`

`PATCH /tasks/:id`
- aceita:
  - `status`
  - `dueDate`
  - `assignedTo`
  - opcionalmente `title`, se Claude julgar util manter consistencia de edicao

`DELETE /tasks/:id`
- remove task do mesmo tenant

### 9. Shape de resposta

Para evitar N+1 e reduzir adaptacao na UI, a resposta de task deve vir enriquecida.

Payload recomendado:
- campos base da task
- `leadName`
- `assignedUserName`
- `createdByName`

Motivo:
- lista dedicada de tasks precisa renderizar contexto sem fazer fetch adicional por linha

### 10. Estrutura do modulo backend

Criar:
- `apps/api/src/modules/tasks/tasks.module.ts`
- `apps/api/src/modules/tasks/tasks.controller.ts`
- `apps/api/src/modules/tasks/tasks.service.ts`
- `apps/api/src/modules/tasks/dto/create-task.dto.ts`
- `apps/api/src/modules/tasks/dto/update-task.dto.ts`
- `apps/api/src/modules/tasks/dto/task-response.dto.ts`

Registrar em:
- [app.module.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/app.module.ts)

Dependencias recomendadas do modulo:
- `PrismaService`
- `EventEmitter2`
- `ActivityLogService`

Nao criar submodulos extras.

### 11. Frontend

Criar:
- `apps/app/types/domain/tasks.ts`
- `apps/app/lib/api/tasks.api.ts`
- `apps/app/lib/hooks/tasks/useTasksQuery.ts`
- `apps/app/lib/hooks/tasks/useCreateTask.ts`
- `apps/app/lib/hooks/tasks/useUpdateTask.ts`
- `apps/app/lib/hooks/tasks/useCompleteTask.ts`
- `apps/app/components/modules/tasks/TasksList.tsx`
- `apps/app/components/modules/tasks/TaskRow.tsx`
- `apps/app/components/modules/tasks/CreateTaskModal.tsx`
- `apps/app/components/modules/tasks/TaskDetailDrawer.tsx`
- `apps/app/app/(app)/[slug]/tasks/page.tsx`

Tambem ajustar:
- `apps/app/types/index.ts`
- `apps/app/components/shell/Sidebar.tsx`
- `apps/app/components/modules/leads/LeadDetailModal.tsx`
- `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts`

### 12. Contrato de filtros da pagina `/tasks`

Pagina dedicada deve suportar pelo menos 3 visoes:
- `minhas`
- `todas`
- `concluidas`

Traducao para query:
- `minhas` => `assignedTo=currentUser.id` + `status=pending`
- `todas` => sem filtro de assignee
- `concluidas` => `status=done`

Nao abrir filtros complexos de prazo neste bloco, mesmo que o backend possa aceitar depois.

### 13. Integracao com voz

Neste bloco a voz deve conectar apenas `create_task`.

Contrato:
- manter a interpretacao no [useVoiceActionController.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/voice-actions/useVoiceActionController.ts)
- mudar `availability` de `planned` para funcional quando o modulo estiver pronto
- executar a task a partir do contexto do lead atual

Payload minimo derivado da intent:
- `leadId = lead.id`
- `title` derivado do transcript ou fallback simples
- `dueDate` ou `dueDaysFromNow` convertido localmente antes do POST

Decisao de escopo:
- nao introduzir NLP mais sofisticado neste bloco
- basta suportar o caso simples `crie uma tarefa para amanha`

### 14. Reuso recomendado

Para evitar retrabalho:
- usar `PaginatedResult<T>` ja existente
- seguir padrao de hooks do frontend ja usado em proposals e users
- usar `useUsersQuery()` para popular assignee select
- usar `LeadDetailModal` como ponto de integracao de voz, nao criar composer novo

## Pre-requisitos

Nao ha pre-requisito de:
- dependencia nova
- env novo
- migration

Pre-requisitos tecnicos:
- `packages/shared/src/rbac/permissions.ts` deve receber as novas permissions
- `packages/shared/src/index.ts` deve continuar exportando esse contrato compartilhado
- `apps/api` precisa registrar o novo `TasksModule` no `AppModule`
- `apps/app/types/index.ts` precisa exportar `domain/tasks`

## Arquivos que a Claude deve tocar

Backend:
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/tasks/tasks.module.ts`
- `apps/api/src/modules/tasks/tasks.controller.ts`
- `apps/api/src/modules/tasks/tasks.service.ts`
- `apps/api/src/modules/tasks/dto/create-task.dto.ts`
- `apps/api/src/modules/tasks/dto/update-task.dto.ts`
- `apps/api/src/modules/tasks/dto/task-response.dto.ts`
- `packages/shared/src/rbac/permissions.ts`
- `packages/shared/src/index.ts` se necessario para export

Frontend:
- `apps/app/types/domain/tasks.ts`
- `apps/app/types/index.ts`
- `apps/app/lib/api/tasks.api.ts`
- `apps/app/lib/hooks/tasks/useTasksQuery.ts`
- `apps/app/lib/hooks/tasks/useCreateTask.ts`
- `apps/app/lib/hooks/tasks/useUpdateTask.ts`
- `apps/app/lib/hooks/tasks/useCompleteTask.ts`
- `apps/app/components/modules/tasks/TasksList.tsx`
- `apps/app/components/modules/tasks/TaskRow.tsx`
- `apps/app/components/modules/tasks/CreateTaskModal.tsx`
- `apps/app/components/modules/tasks/TaskDetailDrawer.tsx`
- `apps/app/app/(app)/[slug]/tasks/page.tsx`
- `apps/app/components/shell/Sidebar.tsx`
- `apps/app/components/modules/leads/LeadDetailModal.tsx`
- `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts`

Documentacao:
- `docs/implementation/fase2-bloco5-tasks-module.md`

## Riscos

- criar task sem validar `leadId` e `assignedTo` por tenant repetiria erro de isolamento ja corrigido em leads
- expor `tasks:manage` como `admin` reduziria utilidade operacional do modulo no MVP
- tentar resolver NLP de task por voz neste bloco inflaria escopo desnecessariamente
- nao enriquecer a resposta com `leadName` e nomes de usuario empurra N+1 para a UI
- misturar task manual com notifications neste bloco atrasaria fechamento sem ganho imediato

## Sequencia minima recomendada para Claude

1. Adicionar permissions de tasks no shared RBAC
2. Implementar modulo backend de tasks com DTOs, service e controller
3. Registrar `TasksModule` no `AppModule`
4. Garantir validacoes de tenant, `task.created`, `completedAt` e activity log
5. Criar types/api/hooks no frontend
6. Criar pagina `/tasks` com filtros minimos
7. Adicionar item `Tarefas` no sidebar
8. Conectar `create_task` na voz via `LeadDetailModal`
9. Documentar o bloco

## Definition of Done deste contrato

O bloco 5 pode ser considerado fechado quando:
- existe CRUD de tasks no backend
- tasks respeitam tenant e exigem `leadId`
- criacao manual emite `task.created`
- transicao para `done` grava `completedAt`
- existe pagina `/tasks` funcional
- existe navegacao para `Tarefas` no sidebar
- a intent `create_task` deixa de ser `planned` e vira mutacao real no contexto do lead
