# Bloco 8 — Template System v1

## Objetivo

Criar um sistema de templates de nicho que permite aplicar configurações pré-definidas (pipeline, workflows, prompts de IA) a uma organização com uma única requisição.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/templates/types.ts` | Tipos `TemplateDefinition`, `TemplateWorkflowDef` |
| `packages/shared/src/templates/real_estate.template.ts` | Template imobiliário v1 (stages + workflows + aiPrompts) |
| `packages/shared/src/templates/index.ts` | `listTemplates()`, `getTemplate(id)` |
| `apps/api/src/modules/templates/templates.service.ts` | `list()`, `getById(id)` — sem persistência |
| `apps/api/src/modules/templates/templates.controller.ts` | `GET /templates`, `GET /templates/:id` |
| `apps/api/src/modules/templates/templates.module.ts` | Módulo NestJS |
| `apps/api/src/modules/organizations/dto/apply-template.dto.ts` | DTO para `POST /organizations/current/apply-template` |
| `apps/app/types/domain/templates.ts` | Tipos frontend: `Template`, `TemplatePipelineStage`, `TemplateWorkflow`, `ApplyTemplatePayload` |
| `apps/app/lib/api/templates.api.ts` | `list`, `getById`, `apply` |
| `apps/app/lib/hooks/templates/useTemplatesQuery.ts` | Query com `staleTime: Infinity` (templates são estáticos) |
| `apps/app/lib/hooks/templates/useApplyTemplate.ts` | Mutation com invalidação de pipeline, workflows e org |
| `apps/app/components/modules/templates/TemplateCard.tsx` | Card com confirmação inline de 2 passos |
| `apps/app/components/modules/templates/TemplateGrid.tsx` | Grid responsivo com skeleton e estado de "já aplicado" |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `packages/shared/src/index.ts` | Exporta `templates/index` e `TemplateWorkflowDef` |
| `apps/api/src/modules/organizations/organizations.service.ts` | `applyTemplate()` adicionado; injeção de `AuditLogService` e `EventEmitter2` |
| `apps/api/src/modules/organizations/organizations.controller.ts` | `POST /organizations/current/apply-template` adicionado |
| `apps/api/src/modules/organizations/organizations.module.ts` | `AuditLogsModule` adicionado aos imports |
| `apps/api/src/app.module.ts` | `TemplatesModule` registrado |
| `apps/app/types/domain/organizations.ts` | `AppliedTemplateInfo` + campo `appliedTemplate?` em `OrgSettings` |
| `apps/app/types/index.ts` | Re-exporta `./domain/templates` |

---

## Template real_estate_v1

### Pipeline (6 estágios)
| Posição | Nome | Cor | Tipo |
|---|---|---|---|
| 1 | Novo Lead | #6B7280 | active (default) |
| 2 | Em Contato | #3B82F6 | active |
| 3 | Visita Agendada | #8B5CF6 | active |
| 4 | Proposta Enviada | #F59E0B | active |
| 5 | Fechado | #10B981 | won |
| 6 | Perdido | #EF4444 | lost |

### Workflows (3 automações)
| Trigger | Ação | Finalidade |
|---|---|---|
| `lead_created` | `ai_classify` | Classifica todo novo lead |
| `lead_classified` | `ai_respond` | Responde leads hot/warm |
| `lead_stage_changed` | `create_task` | Cria tarefa ao mover para "Em Contato" |

### aiPrompts
Reaproveitados de `realEstateConfig` — classify, respond, followUp com variáveis `{{name}}`, `{{property_type}}`, etc.

---

## Fluxo de applyTemplate

```
POST /organizations/current/apply-template
  { templateId: "real_estate_v1" }

OrganizationsService.applyTemplate(ctx, templateId):
  1. getTemplate(templateId) → NotFoundException se não existir
  2. org = prisma.organization.findUnique({ include: { _count: { leads } } })
  3. hasLeads = _count.leads > 0

  $transaction:
    if !hasLeads:
      deleteMany(pipelineStage where orgId)  ← substitui pipeline
    else:
      positionOffset = lastStage.position    ← adiciona ao final

    createMany(pipelineStage)    ← stages do template com offset aplicado
    createMany(workflow)         ← workflows do template
    update(organization):
      aiPrompts = template.aiPrompts
      settings.appliedTemplate = { id, appliedAt, version }

  auditLog.record('organization.template_applied')
  eventEmitter.emit('organization.template_applied')
  return mapOrg(updated)
```

---

## Regra de aplicação: substitui vs. adiciona

| Condição | Comportamento |
|---|---|
| Org **sem leads** | Pipeline existente é apagado; stages do template substituem. `isDefault` preservado conforme template. |
| Org **com leads** | Stages do template são adicionados ao final (positionOffset = última posição atual). `isDefault` fica `false` para não quebrar leads sem estágio. |

Em ambos os casos: `aiPrompts` é sempre sobrescrito e novos workflows são sempre criados.

---

## Endpoints

### `GET /templates`
- Guard: `@RequirePermission('org:read')` (member pode ver)
- Resposta: array de `TemplateDefinition`

### `GET /templates/:id`
- Guard: `@RequirePermission('org:read')`
- 404 se template não existir

### `POST /organizations/current/apply-template`
- Guard: `@RequirePermission('org:update')` (admin only)
- Body: `{ templateId: string }`
- Resposta: `OrgResponseDto` atualizado
- Não é reversível — grava auditLog

---

## Decisões de design

- **Templates no shared, não no banco** — templates são código, não dados de usuário. Versionamento via git. Sem migration necessária.
- **Confirmação de 2 passos no TemplateCard** — primeiro clique mostra aviso "não pode ser desfeito"; segundo clique executa. Sem modal extra para minimizar atrito no onboarding.
- **`staleTime: Infinity` no useTemplatesQuery** — lista de templates nunca muda em runtime. Sem refetch desnecessário.
- **Invalidação de 3 queries no useApplyTemplate** — `pipeline`, `workflows` e `org` são todos afetados; invalidar os 3 garante UI consistente sem reload manual.
- **Posição com offset** — em vez de renumerar stages existentes (operação custosa), os novos stages do template recebem `position + lastPosition`. Evita colisão de `@@unique([orgId, position])`.
- **`actorEmail: 'system'`** para audit quando `actorId` é null — padrão já existente no `AuditLogService`.

---

## O que testar

- [ ] `GET /templates` retorna lista com pelo menos `real_estate_v1`
- [ ] `GET /templates/real_estate_v1` retorna objeto completo com stages, workflows, aiPrompts
- [ ] `GET /templates/inexistente` retorna 404
- [ ] `POST /organizations/current/apply-template` por admin: cria stages + workflows + sobrescreve aiPrompts
- [ ] `settings.appliedTemplate` gravado com `id`, `appliedAt`, `version` corretos
- [ ] Org **sem leads**: stages anteriores são deletados, novos stages do template criados
- [ ] Org **com leads**: stages anteriores preservados, novos stages adicionados com offset de posição
- [ ] Segundo apply do mesmo template: cria novos stages e workflows adicionais (comportamento append)
- [ ] Evento `organization.template_applied` emitido
- [ ] AuditLog registrado com action `organization.template_applied`
- [ ] `TemplateCard` mostra botão "Confirmar" após primeiro clique
- [ ] `TemplateGrid` mostra badge "Aplicado" quando `settings.appliedTemplate.id` bate com o template
- [ ] `useApplyTemplate` invalida queries `pipeline`, `workflows`, `org`
