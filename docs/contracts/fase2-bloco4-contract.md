# Fase 2 — Bloco 4 Contract

## Objetivo

Preparar o contrato tecnico do bloco 4 sem tocar codigo de aplicacao.

Escopo real do bloco:
- verificar e preservar os fixes ja implementados de `H10`, `H1` e `H2`
- fechar `M7` sem duplicacao de RBAC entre backend e frontend
- fechar `M9` sem migration nem modulo novo
- fechar `M12` com o menor ajuste de contrato possivel entre backend e UI

Fora do escopo:
- criar modulos novos
- alterar schema Prisma
- criar migrations
- adicionar dependencias
- replanejar arquitetura

## Auditoria do estado atual

### Ja implementado no repo

`H10`
- [workflow.engine.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/workflows/workflow.engine.ts) ja busca `PipelineStage` por `targetStageId` e valida `stage.orgId === event.orgId` antes de atualizar o lead.

`H1`
- [register.dto.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/auth/dto/register.dto.ts) ja aplica `@MaxLength(72)` em `password`.

`H2`
- [auth.controller.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/auth/auth.controller.ts) ja aplica `@Throttle({ default: { ttl: 60_000, limit: 5 } })` em `register` e `login`.

### Ainda aberto de verdade

`M7`
- ha duplicacao real entre:
  - [apps/api/src/common/rbac/permissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/common/rbac/permissions.ts)
  - [apps/app/lib/rbac/permissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/rbac/permissions.ts)

`M9`
- o engine ainda nao faz deduplicacao por `workflowId + leadId` nos ultimos 60s antes de executar.

`M12`
- o engine ainda nao normaliza `prompt nao configurado` para um motivo canonico.
- a UI de workflows nao consegue detectar isso hoje porque:
  - a listagem atual traz apenas metricas agregadas
  - [WorkflowWithStatsDto](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/workflows/dto/workflow-response.dto.ts) nao inclui resumo da ultima execucao
  - [WorkflowRow.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/workflows/WorkflowRow.tsx) nao recebe nem renderiza informacao de falha recente

## Decisoes de contrato

### 1. H10, H1, H2

Esses itens devem ser tratados como `ja implementados`.

Contrato:
- Claude nao deve reimplementar esses pontos
- Claude deve apenas:
  - confirmar que continuam corretos
  - documentar no bloco
  - cobrir com testes se o bloco incluir testes

### 2. M7 — RBAC compartilhado

Objetivo:
- eliminar a duplicacao do mapa `PERMISSIONS`

Contrato:
- mover para `packages/shared/src/rbac/permissions.ts` os artefatos puros:
  - `Role`
  - `Permission`
  - `PERMISSIONS`
  - `ROLE_HIERARCHY`
  - `hasPermission`
- exportar isso em `packages/shared/src/index.ts`
- manter no backend apenas o que depende de Nest:
  - `REQUIRE_PERMISSION_KEY`
  - `RequirePermission`
- backend passa a importar `PERMISSIONS` e `Role` de `@reshit/shared`
- frontend passa a importar `Permission`, `PERMISSIONS`, `ROLE_HIERARCHY` e `hasPermission` de `@reshit/shared`

Observacao:
- o frontend nao usa `useCan`; usa [usePermissions.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/auth/usePermissions.ts)
- o contrato do prompt original deve ser interpretado como `frontend permission checks`, nao literalmente `useCan`

### 3. M9 — deduplicacao de execucao recente

Objetivo:
- impedir repeticao imediata do mesmo workflow no mesmo lead

Contrato:
- implementar no `WorkflowEngine`, antes de `executeAction`, uma checagem por execucao recente com:
  - `orgId`
  - `workflowId`
  - `leadId`
  - janela de 60 segundos
- se encontrar execucao recente:
  - nao executar a action
  - gravar `status = 'skipped'`
  - gravar motivo canonico sem migration

Decisao de persistencia:
- como o schema atual nao possui campo `errorReason`, usar `WorkflowExecution.result`
- padrao:
  - `status: 'skipped'`
  - `result: { reason: 'duplicate_recent_execution' }`
  - `errorMessage: null`

Motivo:
- evita migration
- preserva o motivo de maquina de forma estavel
- segue o padrao ja usado hoje para `condition_not_met`

### 4. M12 — prompt nao configurado

Objetivo:
- tornar falha de prompt ausente observavel no engine e acionavel na UI

Contrato do backend:
- capturar `BadRequestException` originada de `AiActionsService.execute()` quando a causa for prompt ausente
- nao criar novo campo no banco
- persistir:
  - `status: 'failed'`
  - `result: { errorReason: 'ai_prompt_not_configured' }`
  - `errorMessage: <mensagem humana atual>`

Contrato da API:
- enriquecer o payload de `GET /workflows` em vez de criar endpoint novo
- adicionar ao `WorkflowWithStatsDto` um resumo opcional da ultima execucao, por exemplo:
  - `latestExecutionStatus?: 'success' | 'failed' | 'skipped'`
  - `latestExecutionErrorMessage?: string | null`
  - `latestExecutionResult?: Record<string, unknown>`

Motivo:
- a UI precisa decidir se renderiza `Configurar IA`
- consultar `/workflows/:id/executions` por linha seria desperdicio
- enriquecer a listagem existente e o menor ajuste util

Contrato da UI:
- [WorkflowRow.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/workflows/WorkflowRow.tsx) deve renderizar CTA `Configurar IA` apenas quando:
  - `latestExecutionStatus === 'failed'`
  - `latestExecutionResult.errorReason === 'ai_prompt_not_configured'`
- o CTA deve ir para `/[slug]/settings` ou rota equivalente de configuracoes

## Pre-requisitos

Nao ha pre-requisito de:
- dependency install
- env novo
- migration
- schema change

Pre-requisitos tecnicos deste bloco:
- `packages/shared` precisa receber novo arquivo `src/rbac/permissions.ts`
- `packages/shared/src/index.ts` precisa exportar o contrato novo
- `GET /workflows` pode ser alterado sem quebrar consumidores atuais, desde que os novos campos sejam opcionais

## Arquivos que a Claude deve tocar

RBAC compartilhado:
- `packages/shared/src/rbac/permissions.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/common/rbac/permissions.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/app/lib/rbac/permissions.ts` ou remover/substituir o uso local
- `apps/app/lib/hooks/auth/usePermissions.ts`
- `apps/app/components/shared/CanDo/CanDo.tsx` apenas se o tipo importado mudar

Workflow dedupe e erro canonico:
- `apps/api/src/modules/workflows/workflow.engine.ts`
- `apps/api/src/modules/workflows/workflows.service.ts` apenas se precisar helper especifico

Payload da lista de workflows para M12:
- `apps/api/src/modules/workflows/workflow-response.dto.ts`
- `apps/api/src/modules/workflows/workflows.service.ts`
- `apps/app/types/domain/workflows.ts`
- `apps/app/lib/api/workflows.api.ts` se o tipo mudar
- `apps/app/components/modules/workflows/WorkflowRow.tsx`
- `apps/app/app/(app)/[slug]/workflows/page.tsx` apenas se o CTA ou o estado vazio exigir wiring adicional

Documentacao:
- `docs/implementation/fase2-bloco4-fixes-seguranca.md`

## Riscos

- mover `RequirePermission` para o pacote shared seria erro; isso depende de Nest e deve continuar no backend
- criar `errorReason` no schema neste bloco inflaria escopo desnecessariamente
- usar `errorMessage` sozinho para M12 e M9 deixa a UI dependente de texto humano instavel
- buscar execucoes por workflow na UI, uma linha por vez, degrada a pagina sem necessidade
- alterar nomes de permissao no shared quebraria backend e frontend ao mesmo tempo; o mapa deve ser movido, nao redesenhado

## Sequencia minima recomendada para Claude

1. Tratar `H10`, `H1` e `H2` como verificados, nao como trabalho novo
2. Extrair RBAC compartilhado para `packages/shared`
3. Implementar `M9` com motivo canonico em `result.reason`
4. Implementar `M12` no engine com motivo canonico em `result.errorReason`
5. Enriquecer `GET /workflows` com resumo da ultima execucao
6. Renderizar `Configurar IA` na lista
7. Documentar o bloco

## Definition of Done deste contrato

O bloco 4 pode ser considerado fechado quando:
- nao existir mais duplicacao do mapa `PERMISSIONS`
- o mesmo workflow no mesmo lead puder ser pulado por 60s com `duplicate_recent_execution`
- falha de prompt ausente gerar `ai_prompt_not_configured` de forma estavel
- a UI de workflows conseguir renderizar `Configurar IA` sem endpoint novo
- `H10`, `H1` e `H2` permanecerem verificados no estado final
