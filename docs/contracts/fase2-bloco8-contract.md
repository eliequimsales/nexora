# Fase 2 - Bloco 8 Contract

## Objetivo

Preparar o contrato tecnico do bloco 8 para introduzir o `Template System v1` sem reinventar o fluxo atual de cadastro, onboarding ou organizacoes.

O bloco deve fechar:
- catalogo estatico de templates multi-nicho em `@reshit/shared`
- leitura autenticada desses templates no backend
- aplicacao explicita de template em uma organizacao existente
- base de frontend para consumo posterior no onboarding do bloco 9

Fora do escopo:
- persistencia propria para templates
- refactor completo do onboarding
- remocao do campo `organization.niche`
- reversao de template aplicado
- migracoes Prisma
- novas dependencias

## Auditoria do estado atual

### Ja existe no repositorio

Shared:
- [packages/shared/src/niche-configs/types.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/niche-configs/types.ts) define `PipelineStageConfig`, `AiPromptsConfig`, `LeadFieldConfig`, `NicheLabels` e `NicheConfig`.
- [packages/shared/src/niche-configs/real_estate.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/niche-configs/real_estate.ts) contem o unico nicho real hoje.
- [packages/shared/src/niche-configs/index.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/niche-configs/index.ts) expoe `getNicheConfig()` e `getSupportedNiches()`.
- [packages/shared/src/index.ts](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/index.ts) ainda exporta `niche-configs`, nao `templates`.

Backend:
- [auth.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/auth/auth.service.ts) usa `getNicheConfig(dto.niche)` no registro, grava `organization.niche`, `organization.aiPrompts` e cria `PipelineStage` default.
- [register.dto.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/auth/dto/register.dto.ts) valida `niche` com `getSupportedNiches()`.
- [organizations.controller.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/organizations.controller.ts) hoje so expoe `GET /organizations/me` e `PATCH /organizations/me`.
- [organizations.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/organizations.service.ts) hoje so tem `findOwn()` e `update()`.
- [organizations.module.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/organizations.module.ts) nao importa `AuditLogsModule`.
- `Workflow` e `PipelineStage` ja existem no schema Prisma e ja sao multi-tenant.

Frontend:
- [apps/app/types/domain/organizations.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/types/domain/organizations.ts) ja tem `OrgSettings`, mas nao tem `appliedTemplate`.
- [useOnboardingProgress.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/onboarding/useOnboardingProgress.ts) ainda faz leitura opportunista de `aiPrompts` no `org`.
- `templates` ainda nao existem em `types`, `api`, `hooks` ou `components`.

Dados e schema:
- [schema.prisma](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/prisma/schema.prisma) ja tem `Organization.settings` como `Json`, o que permite salvar `appliedTemplate` sem migration.
- `Organization.niche` continua obrigatorio e segue sendo usado no cadastro e no retorno de auth.

### Ainda nao existe

- `packages/shared/src/templates/`
- `TemplatesModule` no backend
- `applyTemplate()` em `OrganizationsService`
- endpoints `/templates` e `/organizations/current/apply-template`
- tipos e hooks de templates no frontend
- evento `organization.template_applied`

## Preparacao obrigatoria

### 1. Estrutura de template em shared

Criar nova arvore:
- `packages/shared/src/templates/types.ts`
- `packages/shared/src/templates/real_estate.ts`
- `packages/shared/src/templates/legal.ts`
- `packages/shared/src/templates/healthcare.ts`
- `packages/shared/src/templates/consulting.ts`
- `packages/shared/src/templates/index.ts`

Formato canonico:

```ts
{
  id: string;
  niche: string;
  name: string;
  description: string;
  aiPrompts: AiPromptsConfig;
  pipelineStages: PipelineStageConfig[];
  workflows: TemplateWorkflowDefinition[];
  icon?: string;
}
```

Decisao de contrato:
- `types.ts` deve estender os tipos atuais de `niche-configs`, nao duplicar shape manualmente.
- `workflows[]` deve ser tipado com o shape minimo necessario para `Workflow.create`, alinhado a:
  - `name`
  - `description?`
  - `triggerType`
  - `triggerConditions?`
  - `actionType`
  - `actionConfig?`
  - `isActive?`

### 2. Compatibilidade com o estado atual de auth

O estado real do registro ainda e baseado em `niche`, nao em `templateId`.

Contrato:
- neste bloco, `RegisterDto` continua recebendo `niche`
- `AuthService.register()` deixa de usar `getNicheConfig()` e passa a usar `getTemplate(dto.niche)` somente se `template.id === niche`
- `organization.niche` continua sendo gravado com `template.niche`

Motivo:
- evita abrir onboarding/cadastro no mesmo bloco
- preserva o fluxo atual enquanto a camada de templates nasce

Recomendacao pragmatica:
- manter `getSupportedNiches()` como alias temporario sobre os templates suportados
- ou trocar `RegisterDto` para `getSupportedTemplateIds()` apenas se todos os ids iniciais coincidirem com os niches atuais

### 3. Migracao de `niche-configs` para `templates`

Estado real:
- `real_estate` hoje vive em `niche-configs`
- docs antigas e `seed.ts` ainda referenciam `niche-configs`

Contrato:
- migrar o dado real de `real_estate` para `templates/real_estate.ts`
- substituir imports de `getNicheConfig()` por `getTemplate()` onde houver uso ativo
- permitir shim temporario em `niche-configs/index.ts` apenas se necessario para reduzir quebra interna neste bloco

### 4. Versionamento do template aplicado

`Organization.settings.appliedTemplate` deve salvar:

```ts
{
  id: string;
  appliedAt: string;
  version: string;
}
```

Decisao de contrato:
- `version` pode ser string estatica por template neste MVP, por exemplo `v1`
- nao criar model proprio nem tabela de versions

## Decisoes de contrato

### 1. TemplatesModule no backend

Criar:
- `apps/api/src/modules/templates/templates.service.ts`
- `apps/api/src/modules/templates/templates.controller.ts`
- `apps/api/src/modules/templates/templates.module.ts`

Responsabilidade:
- ler templates de `@reshit/shared`
- expor:
  - `GET /templates`
  - `GET /templates/:id`

Persistencia:
- nenhuma

Permissao:
- `member` e suficiente

Contrato de rota:
- `GET /templates` pode ser protegido por auth normal e RBAC `org:read`
- rota publica so vale se houver necessidade direta no onboarding antes do login, o que nao e requisito deste bloco

### 2. `OrganizationsService.applyTemplate(orgId, templateId)`

Criar novo metodo no service:
- `applyTemplate(ctx, templateId)` ou `applyTemplate(orgId, templateId, actorCtx)`

Fluxo obrigatorio:
1. validar se o template existe em `@reshit/shared`
2. buscar organizacao atual
3. contar leads da organizacao
4. executar transaction
5. sobrescrever `organization.aiPrompts`
6. atualizar `organization.settings.appliedTemplate`
7. ajustar pipeline conforme regra de leads
8. criar workflows default do template
9. gravar audit log
10. emitir `organization.template_applied`
11. retornar org atualizada

### 3. Regra de pipeline ao aplicar template

Regra pedida pelo usuario:
- se org ja tem leads, aplicar template so adiciona, nao apaga pipeline atual
- se nao tem leads, substitui

Contrato detalhado:

Se `leadCount === 0`:
- remover `PipelineStage` atual da org
- recriar stages do template

Se `leadCount > 0`:
- nao deletar stages existentes
- adicionar apenas stages faltantes do template

Definicao de "faltante" no MVP:
- comparar por `name`

### 4. Regra de workflows ao aplicar template

O template inclui `workflows[]` default.

Contrato:
- criar workflows default para a org durante a transaction
- nao deletar workflows atuais
- evitar duplicacao obvia ao reaplicar o mesmo template

Definicao minima de dedupe:
- comparar por `name + triggerType + actionType`

### 5. Audit log obrigatorio

Como a aplicacao do template nao e reversivel no MVP, precisa gravar audit.

Implicacao estrutural:
- `OrganizationsModule` deve importar `AuditLogsModule`
- `OrganizationsService` deve receber `AuditLogService`

Acao de audit recomendada:
- `organization.template_applied`

Metadata minima:
- `templateId`
- `templateVersion`
- `leadCountAtApply`
- `pipelineMode: "replace" | "append"`
- `workflowsCreated`

### 6. Endpoint de aplicacao

Adicionar em `organizations.controller.ts`:
- `POST /organizations/current/apply-template`

Payload:

```ts
{ "templateId": "real_estate" }
```

Recomendacao:
- criar DTO proprio, por exemplo `apply-template.dto.ts`

### 7. Evento `organization.template_applied`

Emitir ao final da aplicacao:
- `organization.template_applied`

Payload minimo:
- `orgId`
- `templateId`
- `templateVersion`
- `leadCount`

### 8. OrgResponse e frontend

Como `appliedTemplate` fica em `Organization.settings`, nao e necessario novo campo top-level no DTO.

Contrato:
- atualizar os tipos frontend para refletir:
  - `settings.appliedTemplate?: { id: string; appliedAt: string; version: string }`

### 9. Frontend base de templates

Criar:
- `apps/app/types/domain/templates.ts`
- `apps/app/lib/api/templates.api.ts`
- `apps/app/lib/hooks/templates/useTemplatesQuery.ts`
- `apps/app/lib/hooks/templates/useApplyTemplate.ts`
- `apps/app/components/modules/templates/TemplateCard.tsx`
- `apps/app/components/modules/templates/TemplateGrid.tsx`

Escopo:
- listagem
- selecao
- apply mutation

Fora do escopo:
- wiring completo no onboarding
- wizard
- preview rico de prompts/workflows

### 10. Reaproveitamento no onboarding

Prompt pede apenas preparar para o bloco 9.

Contrato:
- `TemplateGrid` deve ser desenhado para reuso em onboarding
- nao mexer no `OnboardingChecklist` neste bloco

### 11. Seed e docs antigas

Estado real:
- `apps/api/prisma/seed.ts` e docs antigas ainda falam em `niche-configs`

Contrato:
- atualizar `seed.ts` para refletir que os dados estaticos agora vivem em `templates`
- markdown historico nao e bloqueante

### 12. `packages/shared/package.json`

Estado real:
- descricao ainda diz `niche configs`

Contrato:
- ajuste documental recomendavel para `templates`

## Arquivos que a Claude deve tocar

Shared:
- `packages/shared/src/templates/types.ts`
- `packages/shared/src/templates/real_estate.ts`
- `packages/shared/src/templates/legal.ts`
- `packages/shared/src/templates/healthcare.ts`
- `packages/shared/src/templates/consulting.ts`
- `packages/shared/src/templates/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/niche-configs/index.ts` se houver shim temporario
- `packages/shared/package.json`

Backend:
- `apps/api/src/modules/templates/templates.service.ts`
- `apps/api/src/modules/templates/templates.controller.ts`
- `apps/api/src/modules/templates/templates.module.ts`
- `apps/api/src/modules/organizations/organizations.service.ts`
- `apps/api/src/modules/organizations/organizations.controller.ts`
- `apps/api/src/modules/organizations/organizations.module.ts`
- `apps/api/src/modules/organizations/dto/apply-template.dto.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/dto/register.dto.ts` se o validador deixar de depender de `getSupportedNiches()`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`

Frontend:
- `apps/app/types/domain/templates.ts`
- `apps/app/types/domain/organizations.ts`
- `apps/app/lib/api/templates.api.ts`
- `apps/app/lib/hooks/templates/useTemplatesQuery.ts`
- `apps/app/lib/hooks/templates/useApplyTemplate.ts`
- `apps/app/components/modules/templates/TemplateCard.tsx`
- `apps/app/components/modules/templates/TemplateGrid.tsx`

Documentacao:
- `docs/implementation/fase2-bloco8-template-system.md`

## Riscos

- misturar bloco 8 com redesign de onboarding inflaria escopo
- trocar `register` inteiro para `templateId` neste bloco aumentaria risco sem necessidade
- reaplicar template sem dedupe de workflow criaria automacoes duplicadas
- usar comparacao por `position` para append de pipeline quebraria orgs com pipeline customizado
- remover `organization.niche` neste bloco exigiria schema e efeito cascata em auth/frontend
- abrir `/templates` como publico sem necessidade aumenta superficie desnecessaria
- confundir templates de negocio com templates de notificacao introduz ambiguidade de nomenclatura

## Sequencia minima recomendada para Claude

1. criar `packages/shared/src/templates/` e migrar `real_estate`
2. exportar `getTemplate()` e `listTemplates()` em `@reshit/shared`
3. adaptar `auth.service.ts` e, se necessario, `register.dto.ts` para consumir templates sem quebrar o cadastro atual
4. criar `TemplatesModule` backend com `GET /templates` e `GET /templates/:id`
5. adicionar `applyTemplate` em `OrganizationsService` com transaction + audit + evento
6. expor `POST /organizations/current/apply-template`
7. criar tipos/api/hooks/componentes base no frontend
8. atualizar `seed.ts` e documentar o bloco

## Definition of Done deste contrato

O bloco 8 pode ser considerado fechado quando:
- `@reshit/shared` passa a expor templates multi-nicho reais
- `AuthService` deixa de depender de `getNicheConfig()` no caminho ativo
- backend expoe leitura de templates sem persistencia propria
- organizacao consegue aplicar template com transaction, audit e evento
- regra de pipeline respeita `replace sem leads` e `append com leads`
- `settings.appliedTemplate` fica gravado sem migration nova
- frontend ja consegue listar templates e disparar apply
- onboarding ainda nao foi refeito, mas a base para o bloco 9 esta pronta
