# Bloco 5 — Módulo de Tarefas

## Objetivo

Implementar o módulo completo de Tarefas: backend CRUD isolado por tenant, frontend com componentes, página dedicada, integração na sidebar e ação de voz `create_task` conectada ao `LeadDetailModal`.

---

## Arquivos criados

### Backend

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/tasks/dto/create-task.dto.ts` | Validação de criação (title, leadId, assignedTo?, dueDate?) |
| `apps/api/src/modules/tasks/dto/update-task.dto.ts` | Validação de atualização parcial (title?, status?, dueDate?, assignedTo?) |
| `apps/api/src/modules/tasks/dto/task-response.dto.ts` | Interface `TaskResponseDto` + `mapTask()` com enriquecimento |
| `apps/api/src/modules/tasks/tasks.service.ts` | CRUD completo com isolamento por tenant |
| `apps/api/src/modules/tasks/tasks.controller.ts` | 5 endpoints REST com RBAC |
| `apps/api/src/modules/tasks/tasks.module.ts` | Módulo NestJS |

### Frontend

| Arquivo | Responsabilidade |
|---|---|
| `apps/app/types/domain/tasks.ts` | Tipos Task, CreateTaskPayload, UpdateTaskPayload, ListTasksParams |
| `apps/app/lib/api/tasks.api.ts` | Camada HTTP (list, get, create, update, remove) |
| `apps/app/lib/hooks/tasks/useTasksQuery.ts` | Query TanStack com TASKS_QUERY_KEY |
| `apps/app/lib/hooks/tasks/useCreateTask.ts` | Mutation com invalidateQueries + toast |
| `apps/app/lib/hooks/tasks/useUpdateTask.ts` | Mutation por taskId |
| `apps/app/lib/hooks/tasks/useCompleteTask.ts` | Convenience hook: update com `{status:'done'}` |
| `apps/app/components/modules/tasks/TaskRow.tsx` | Linha de tarefa com toggle, overdue, assignee |
| `apps/app/components/modules/tasks/TasksList.tsx` | Wrapper com estados loading/error/empty |
| `apps/app/components/modules/tasks/CreateTaskModal.tsx` | Modal de criação via lead context |
| `apps/app/components/modules/tasks/TaskDetailDrawer.tsx` | Drawer lateral: status, assignee, dueDate, delete |
| `apps/app/app/(app)/[slug]/tasks/page.tsx` | Página com 3 tabs: Minhas / Todas / Concluídas |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `packages/shared/src/rbac/permissions.ts` | Adicionado `tasks:read` e `tasks:manage` (ambos `member`) |
| `apps/app/types/index.ts` | Re-export de `./domain/tasks` |
| `apps/app/components/shell/Sidebar.tsx` | Item "Tarefas" adicionado entre Pipeline e Workflows |
| `apps/app/components/modules/leads/LeadDetailModal.tsx` | Hook `useCreateTask`, estado `showCreateTask`, case `create_task` no voice handler |
| `apps/api/src/app.module.ts` | Import de `TasksModule` |
| `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts` | Intent `create_task` e sugestão `task` com `availability: 'available'` |

---

## Endpoints

| Método | Path | Permissão | Descrição |
|---|---|---|---|
| POST | `/tasks` | `tasks:manage` | Criar tarefa |
| GET | `/tasks` | `tasks:read` | Listar tarefas (status, assignedTo, leadId, page, limit) |
| GET | `/tasks/:id` | `tasks:read` | Buscar tarefa por ID |
| PATCH | `/tasks/:id` | `tasks:manage` | Atualizar tarefa |
| DELETE | `/tasks/:id` | `tasks:manage` | Remover tarefa |

---

## Regras de negócio implementadas

- **Isolamento por tenant:** `assertSameTenant` valida `leadId` e `assignedTo` antes de criar/atualizar
- **Lifecycle de `completedAt`:** setado para `now()` quando `status → done`; zerado para `null` quando `status → pending`
- **ActivityLog:** evento `task_created` na criação; `task_done` ao concluir
- **EventEmitter:** `task.created` emitido com `{orgId, taskId, leadId, createdBy, assignedTo, status}`
- **MVP constraint:** `leadId` é obrigatório — tarefas só podem ser criadas a partir de um lead

---

## Voice action `create_task`

Conectado em `LeadDetailModal.tsx`. Extrai o título do transcript via regex (remove prefixos como "crie uma tarefa"), define dueDate como amanhã, chama `createTask.mutateAsync`.

Regex de extração:
```
/^(crie?|criar|adicione?|adicionar)\s*(uma\s*)?(tarefa\s*)?/i
```

Fallback: `'Tarefa criada por voz'` se o transcript estiver vazio após extração.

---

## O que testar

- [ ] Criar tarefa via `LeadDetailModal` (botão "Nova tarefa" ou voice)
- [ ] Tab "Minhas" filtra por usuário logado + status pending
- [ ] Tab "Concluídas" filtra por status done
- [ ] Toggle de status no `TaskDetailDrawer` (pendente ↔ concluída)
- [ ] `completedAt` aparece quando tarefa for concluída
- [ ] Overdue: data de prazo passada aparece em vermelho no `TaskRow`
- [ ] Delete com confirmação no drawer
- [ ] Assignee update auto-salva no drawer
- [ ] Voice "crie uma tarefa para amanhã" → cria tarefa com título e dueDate corretos
- [ ] Tenant isolation: tarefa de outro org não aparece
