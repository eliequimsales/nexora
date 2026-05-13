# Fase 2 - Bloco 12 Contract

## Objetivo

Completar apenas a UI de `CreateWorkflowModal` e a superficie da pagina de `Workflows` para expor todas as capacidades que o engine backend ja suporta, sem reabrir arquitetura, sem criar modulo novo e sem expandir o escopo para fora de `Workflows`.

## Auditoria do estado atual real

### Estado do backend

O backend ja esta adiantado em relacao ao frontend:

- `apps/api/src/modules/workflows/dto/create-workflow.dto.ts` ja inclui `ai_follow_up`
- o engine ja suporta `move_stage` com `targetStageId`
- o engine ja suporta `lead_stage_changed` com filtros `fromStageId` e `toStageId`

Conclusao:

o gap principal do bloco 12 esta no frontend.

### Estado do frontend de Workflows

`apps/app/types/domain/workflows.ts` ainda nao acompanha o backend:

- `ActionType` ainda nao inclui `ai_follow_up`
- `ACTION_LABELS` ainda nao inclui `ai_follow_up`

`apps/app/components/modules/workflows/CreateWorkflowModal.tsx` ainda esta incompleto:

- o enum local do schema ainda nao inclui `ai_follow_up`
- `move_stage` ainda nao coleta `targetStageId`
- `lead_stage_changed` ainda nao coleta `fromStageId` e `toStageId`

`apps/app/app/(app)/[slug]/workflows/page.tsx` ainda nao trata falta de `aiPrompts`.

### Estado de `useOrg()`

No estado atual do app:

- `useOrg()` le a org do auth store
- `apps/app/types/domain/organizations.ts` nao inclui `aiPrompts` em `OrgResponse`
- o proprio onboarding ja usa cast manual para ler `aiPrompts`

Conclusao:

o prompt do bloco pede usar `useOrg()`, mas isso nao fecha bem com a tipagem atual. O contrato deve assumir um ajuste minimo de contrato de dados, nao um cast silencioso espalhado na UI.

## Decisoes de contrato

### W1 - `ai_follow_up`

Escopo:

- adicionar `ai_follow_up` no frontend de `Workflows`
- manter alinhamento com o backend ja existente

Contrato:

- adicionar `ai_follow_up` em `ActionType` de `apps/app/types/domain/workflows.ts`
- adicionar `ai_follow_up` em `ACTION_LABELS`
- adicionar `ai_follow_up` no enum do schema local de `CreateWorkflowModal.tsx`

Nota de auditoria:

- no backend, `CreateWorkflowDto` ja contem `ai_follow_up`
- portanto nao ha trabalho real adicional no backend deste bloco, salvo confirmar que nao houve regressao

### W2 - `move_stage` com `targetStageId`

Escopo:

- quando `actionType === 'move_stage'`, a UI precisa permitir escolher o estagio de destino

Contrato:

- renderizar select de estagios quando `actionType === 'move_stage'`
- popular o select a partir da infraestrutura ja existente de pipeline
- persistir em `actionConfig.targetStageId`

Fonte de dados recomendada:

- reaproveitar `pipelineApi.board()` ou hook equivalente ja existente
- evitar endpoint novo so para este bloco

Comportamento:

- se nao houver estagios carregados, mostrar estado vazio explicito
- nao enviar `move_stage` sem `targetStageId`

### W3 - `lead_stage_changed` com `fromStageId` e `toStageId`

Escopo:

- quando `triggerType === 'lead_stage_changed'`, a UI precisa permitir filtros opcionais de origem e destino

Contrato:

- renderizar dois selects opcionais:
  - `fromStageId`
  - `toStageId`
- popular ambos com a mesma fonte de estagios do pipeline
- gravar em `triggerConditions`

Comportamento:

- ambos sao opcionais
- sem valor significa `qualquer estagio`
- a UI deve deixar isso explicito para nao parecer obrigatorio

### W4 - guard de `aiPrompts` na pagina `/workflows`

Objetivo:

- alertar que workflows de classificacao dependem de prompts configurados

Banner esperado:

- mensagem amarela no topo da pagina
- texto:
  - `Configure os prompts de IA para que workflows de classificação funcionem`
- CTA para `settings`

Decisao de contrato:

- o requisito funcional continua valido
- mas nao usar cast local espalhado como solucao final

Contrato de dados minimo necessario:

- `useOrg()` so pode ser fonte limpa para W4 se `org.aiPrompts` existir no contrato tipado da org
- portanto este bloco depende de um ajuste minimo de tipagem/shape entre backend e frontend para expor `aiPrompts` em `/organizations/me`

Se esse ajuste minimo nao entrar junto:

- usar fallback temporario controlado e centralizado, nao cast ad hoc em varios pontos

Regra de UX:

- o banner deve aparecer apenas quando `aiPrompts` estiver ausente ou vazio
- o CTA deve apontar direto para settings da org

## Arquivos que a Claude deve tocar

### Frontend

- `apps/app/types/domain/workflows.ts`
- `apps/app/components/modules/workflows/CreateWorkflowModal.tsx`
- `apps/app/app/(app)/[slug]/workflows/page.tsx`
- infraestrutura de hook/api de pipeline usada para listar estagios

### Backend, apenas se faltar contrato de dados para W4

- `apps/api/src/modules/organizations/dto/org-response.dto.ts`
- `apps/api/src/modules/organizations/organizations.service.ts`
- `apps/app/types/domain/organizations.ts`

Observacao:

- este bloco continua sendo primariamente frontend
- o ajuste backend acima so e aceitavel se for estritamente necessario para que `useOrg()` reflita `aiPrompts` de forma limpa

## Riscos

- manter o backend suportando mais do que a UI permite configurar
- implementar W4 com cast local e perpetuar drift de contrato
- criar endpoint novo de estagios sem necessidade
- permitir `move_stage` sem `targetStageId`
- esconder filtros opcionais de `lead_stage_changed` de forma pouco clara

## Sequencia minima recomendada para a Claude

1. alinhar `ActionType` e `ACTION_LABELS` com `ai_follow_up`
2. completar o schema local de `CreateWorkflowModal`
3. conectar fonte de estagios para `move_stage`
4. conectar `fromStageId` e `toStageId` para `lead_stage_changed`
5. implementar banner W4 na pagina de `Workflows`
6. se necessario, fazer o ajuste minimo no contrato de org para expor `aiPrompts`

## Definition of Done deste contrato

- o frontend de `Workflows` expõe `ai_follow_up`
- `move_stage` nao pode mais ser criado sem estagio de destino
- `lead_stage_changed` pode ser filtrado por origem e destino
- a pagina de `Workflows` alerta quando `aiPrompts` nao estiver configurado
- nao ha endpoint novo desnecessario nem reabertura de arquitetura
