# Fase 2 - Bloco 13 Contract

## Objetivo

Adicionar a primeira cobertura de testes realmente util nos modulos criticos e limpar bugs residuais de baixo risco, sem reabrir arquitetura e sem misturar neste bloco mudancas estruturais grandes que dependem de migration ou redesign de RBAC.

## Auditoria do estado atual real

### Estado de testes

Hoje o backend tem cobertura muito pequena:

- existe `apps/api/src/modules/auth/auth.service.spec.ts`
- os e2e atuais sao basicamente:
  - `apps/api/test/auth.e2e-spec.ts`
  - `apps/api/test/tenant-isolation.e2e-spec.ts`

Nao existem hoje, no repo atual:

- `leads.service.spec.ts`
- `workflow.engine.spec.ts`
- `proposals.service.spec.ts`
- `integration-crypto.service.spec.ts`
- `proposal-flow.e2e-spec.ts`

Conclusao:

o bloco 13 e, na pratica, a criacao da primeira malha seria de testes criticos.

### Estado funcional dos pontos a cobrir

- `LeadsService.update()` ja valida `pipelineStageId` e `assignedTo` por tenant
- `WorkflowEngine` ja contem:
  - validacao de `targetStageId` contra tenant
  - dedupe por 60s via `hasRecentExecution()`
- `ProposalsService.respond()` ja trata:
  - token inexistente
  - proposta ja respondida/invalida
  - proposta expirada
  - `accept` atualiza lead para `closed_won`
- `IntegrationCryptoService` ja faz:
  - encrypt/decrypt roundtrip
  - throw em producao quando a key default esta em uso
- `AuthService.login()` ja autentica por `slug + email + password`

Conclusao:

os testes pedidos fazem sentido como regressao real do estado atual.

## Escopo de testes backend

### T1 - `leads.service.spec.ts`

Criar spec unitaria para `LeadsService.update()` cobrindo regressao de C1.

Cenarios obrigatorios:

- `pipelineStageId` invalido ou de outro tenant -> `BadRequestException`
- `assignedTo` invalido ou de outro tenant -> `BadRequestException`
- opcionalmente, caso valido preserva fluxo nominal

Contrato:

- mockar `PrismaService`
- mockar `EventEmitter2`
- focar em validacao e nao em detalhes secundarios de paginacao/listagem

### T2 - `workflow.engine.spec.ts`

Criar spec unitaria para `WorkflowEngine`.

Cenarios obrigatorios:

- `move_stage` com `targetStageId` de outro tenant falha e gera execucao `failed`
- dedupe de M9:
  - se houver `WorkflowExecution` recente para mesmo `leadId + workflowId`, registrar `skipped`
  - `result.reason = 'duplicate_recent_execution'`

Contrato:

- testar `processTrigger(...)` ou o caminho publico equivalente, nao metodos privados isolados
- mockar `WorkflowsService`, `PrismaService`, `AiActionsService` e fila quando necessario
- o foco do teste e comportamento do engine, nao infraestrutura BullMQ

### T3 - `proposals.service.spec.ts`

Criar spec unitaria para `ProposalsService.respond()`.

Cenarios obrigatorios:

- token expirado -> proposta vira `expired` e a chamada falha
- token duplicado/invalido para proposta fora de `sent|viewed` -> falha correta
- token valido + `accept` -> proposta vira `accepted` e lead vira `closed_won`
- token valido + `reject` -> proposta vira `rejected` sem fechar lead como ganho

Observacao de contrato:

- o texto do prompt fala em `duplicado`; no estado real do servico, o caso relevante e proposta ja respondida ou nao respondivel
- o teste deve seguir o comportamento real do servico

### T4 - `integrations/integration-crypto.service.spec.ts`

Criar spec unitaria para `IntegrationCryptoService`.

Cenarios obrigatorios:

- `encrypt()` + `decrypt()` fazem roundtrip correto
- em `production`, usando a key default, o servico falha na inicializacao

Contrato:

- mockar `ConfigService`
- nao testar cifra byte a byte; testar contrato funcional

### T5 - `auth.service.spec.ts`

Adicionar teste de login por slug em `AuthService`.

Cenario obrigatorio:

- `login({ slug, email, password })` usa a org pelo slug e autentica corretamente

Observacao:

- este teste amplia spec existente; nao precisa criar arquivo novo

## Escopo e2e

### E1 - `proposal-flow.e2e-spec.ts`

Criar e2e de fluxo critico de proposta.

Fluxo real recomendado:

1. registrar org e usuario
2. ingerir lead via `POST /ingest/:formToken`
3. classificar lead explicitamente pelo endpoint de IA autenticado
4. criar proposta
5. enviar proposta
6. aceitar via rota publica `POST /proposals/p/:token/accept`
7. verificar lead `closed_won`

Decisao de contrato:

- nao depender de workflow assincrono para classificar no e2e
- chamar classificacao de forma explicita para reduzir flakiness
- usar o fluxo publico real de proposals, que hoje e `proposals/p/:token/...`

## Escopo de polish

### Entra neste bloco

- `L1`: remover import nao usado de `Spinner` em `LeadsList`
- `L2`: corrigir comentario de `AiExecution.triggerType` no schema
- `L3`: substituir import dinamico de `NotFoundException` em `ai-actions.controller.ts` por import estatico
- `L5`: mover `CopilotButton` para o layout global do app autenticado

### Ja esta resolvido no estado atual

- `L6`: `useAiInsight` ja expoe `errorMessage`

Conclusao:

- `L6` nao gera trabalho real neste bloco

### Fica como avaliacao, nao implementacao obrigatoria

- `L7`: split de `proposals:manage` em `create/send/close`

Racional:

- isso ja deixa de ser polish e vira decisao de RBAC/contrato
- pode gerar impacto transversal em backend, frontend e permissao compartilhada

## Itens estruturais que nao devem contaminar o bloco de testes

### Entram apenas como preparacao/nota

- `L4`: `@@index([orgId, triggerType, isActive])` em `Workflow` -> depende de migration
- `I1`, `I2`: partial indexes e `CHECK constraints` via SQL raw -> dependem de migration dedicada

Decisao de contrato:

- registrar estes itens como follow-up estrutural
- nao misturar com a entrega principal de testes/polish
- se forem feitos, devem entrar em migration separada e revisavel

## Arquivos que a Claude deve tocar

### Testes unitarios backend

- `apps/api/src/modules/leads/leads.service.spec.ts`
- `apps/api/src/modules/workflows/workflow.engine.spec.ts`
- `apps/api/src/modules/proposals/proposals.service.spec.ts`
- `apps/api/src/modules/integrations/integration-crypto.service.spec.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`

### Testes e2e

- `apps/api/test/proposal-flow.e2e-spec.ts`

### Polish

- `apps/app/components/modules/leads/LeadsList.tsx`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/ai-actions/ai-actions.controller.ts`
- `apps/app/app/(app)/[slug]/leads/page.tsx`
- `apps/app/app/(app)/[slug]/layout.tsx`

### Fora do escopo principal, se apenas documentado

- migrations futuras para `L4`, `I1`, `I2`

## Riscos

- tentar cobrir tudo com e2e e deixar a suite lenta e fragil
- acoplar o e2e a workflows assincronos e gerar flakiness
- misturar migration estrutural no mesmo fechamento de testes
- transformar `L7` em refactor de RBAC sem decisao previa
- mover `CopilotButton` para um ponto que quebre a hierarquia visual global

## Sequencia minima recomendada para a Claude

1. adicionar testes unitarios de `LeadsService`
2. adicionar testes unitarios de `WorkflowEngine`
3. adicionar testes unitarios de `ProposalsService`
4. adicionar testes unitarios de `IntegrationCryptoService`
5. ampliar `auth.service.spec.ts` com slug login
6. adicionar `proposal-flow.e2e-spec.ts`
7. aplicar `L1`, `L2`, `L3`, `L5`
8. deixar `L4`, `L7`, `I1`, `I2` apenas registrados como follow-up estrutural

## Definition of Done deste contrato

- existe cobertura unitaria para os casos criticos de leads, workflows, proposals e crypto
- `AuthService` cobre login por slug
- existe um e2e de ponta a ponta do fluxo de proposta aceita
- bugs residuais de baixo risco entram corrigidos
- itens de migration e RBAC mais profundos nao contaminam a entrega principal
