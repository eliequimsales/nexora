# Fase 2 - Bloco 11 Contract

## Objetivo

Fechar apenas os intents de voz reconhecidos mas ainda incompletos no estado real atual do app, sem reinventar a camada de voz e sem reimplementar o que ja existe.

Bloco 11 cobre:

- V1: refinamento de `create_task`
- V2: consolidacao de `create_note`
- V3: implementacao real de `ask_copilot`
- UX: estados de feedback mais claros durante execucao

## Auditoria do estado atual real

### `create_task`

Ja existe conexao funcional no frontend:

- o parser reconhece `create_task` em `useVoiceActionController.ts`
- `LeadDetailModal.tsx` ja executa `createTask.mutateAsync(...)`
- a intent hoje esta em modo `confirm`

Gap real:

- extracao de titulo e prazo ainda e simplificada demais
- o handler sempre assume vencimento para amanha
- a UI ainda nao mostra mensagens especificas da acao

Conclusao de contrato:

`create_task` nao e greenfield neste bloco. O trabalho real e endurecer parser, payload e feedback.

### `create_note`

Ja existe conexao funcional ponta a ponta:

- o parser reconhece `create_note`
- `LeadDetailModal.tsx` ja chama `useCreateNote(leadId)`
- o frontend usa `POST /activity-logs/notes`
- o backend ja persiste a nota via `ActivityLogService.createNote(...)`

Divergencia entre prompt e estado real:

- o prompt pede `POST /leads/:id/notes`
- o sistema atual ja usa `POST /activity-logs/notes`
- o prompt pede `type='note_manual'`
- o backend atual grava `type='manual_note'`

Conclusao de contrato:

nao criar endpoint novo nem renomear tipo neste bloco. O caminho canonico permanece o que ja existe, salvo se houver motivo transversal para padronizacao futura.

### `ask_copilot`

Nao esta realmente fechado:

- o parser reconhece `ask_copilot`
- a UI marca a intent como disponivel
- `LeadDetailModal.tsx` hoje usa `ai_respond` como proxy
- backend de `copilot` nao tem `POST /copilot/ask`
- `CopilotService` nao possui metodo de pergunta contextual via LLM

Conclusao de contrato:

o trabalho novo real do bloco 11 esta em `ask_copilot`.

## Decisoes de contrato

### V1 - `create_task`

Escopo deste bloco:

- manter o uso do modulo de tarefas ja existente do Bloco 5
- preservar execucao no contexto do lead atual
- melhorar a extracao de `title` e `dueDays`
- manter confirmacao antes da criacao

Contrato funcional:

- continuar usando `useCreateTask`
- payload minimo continua exigindo `leadId`
- parser deve extrair:
  - titulo livre sem o verbo de comando
  - prazo relativo quando presente, com foco inicial em:
    - `amanha` -> `dueDays = 1`
    - `hoje` -> `dueDays = 0`
    - `sem prazo` -> `dueDays = null`
- se nao houver titulo suficiente:
  - fallback para um titulo padrao seguro

Exemplo esperado:

- `lembra de ligar amanha` -> titulo limpo `ligar`, `dueDays = 1`
- `crie uma tarefa sem prazo para revisar proposta` -> titulo `revisar proposta`, `dueDays = null`

Fora deste bloco:

- NLP amplo
- horarios exatos
- atribuicao por voz
- tarefas fora do lead atual

### V2 - `create_note`

Escopo deste bloco:

- consolidar a intent em cima da rota e hook ja existentes
- evitar churn de contrato backend sem ganho real

Contrato funcional:

- manter `useCreateNote(leadId)` como hook oficial
- manter `POST /activity-logs/notes` como endpoint oficial
- manter persistencia via `ActivityLogService.createNote(...)`
- conectar o fluxo de voz explicitamente a esse caminho canonico

Decisao de nomenclatura:

- neste bloco, `manual_note` continua como valor persistido atual
- nao introduzir `POST /leads/:id/notes`
- nao renomear para `note_manual`

Racional:

- o prompt diverge do repo atual
- abrir novo endpoint aqui so cria duplicacao de superficie

### V3 - `ask_copilot`

Escopo deste bloco:

- substituir o proxy atual para `ai_respond`
- criar uma capacidade real de pergunta contextual sobre o lead atual

Contrato backend:

- criar `POST /copilot/ask`
- request minimo:
  - `leadId`
  - `question`
- response:
  - `answer`

Comportamento do backend:

- buscar o lead no contexto da org
- montar contexto minimo com:
  - dados principais do lead
  - classificacao/status/stage quando houver
  - historico recente util
- chamar `LlmService.call(...)`
- retornar resposta curta e operacional

Guardrails:

- nao disparar `ai_respond`
- nao enviar mensagem para cliente
- nao mutar lead
- apenas responder

Contrato frontend:

- criar hook dedicado `useAskCopilot`
- reconectar a intent `ask_copilot` para este hook
- remover o acoplamento atual com `respond.mutateAsync()`

Renderizacao da resposta:

- usar superficie existente no contexto do lead
- pode ser modal simples, drawer curto ou painel expandido
- nao usar apenas toast pequeno para resposta longa

### UX - feedback de execucao

Escopo deste bloco:

- adicionar microcopy especifica da acao no fluxo de voz

Contrato de UX:

- manter os estados globais atuais (`listening`, `ready`, `executing`, `success`, `error`)
- permitir mensagem contextual por intent

Exemplos esperados:

- `Entendi, criando tarefa`
- `Tarefa criada`
- `Entendi, registrando nota`
- `Nota registrada`
- `Consultando o Copilot`
- `Resposta pronta`

Regra:

- a mensagem principal deve refletir a acao executada
- o resultado final deve aparecer no contexto da tela, nao so no status textual

## Arquivos que a Claude deve tocar

### Frontend

- `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts`
- `apps/app/components/modules/voice-actions/VoiceActionPanel.tsx`
- `apps/app/components/modules/leads/LeadDetailModal.tsx`
- `apps/app/lib/hooks/activity-logs/useCreateNote.ts` se precisar apenas de ajuste leve
- `apps/app/lib/hooks/tasks/useCreateTask.ts` apenas se o contrato atual impedir o payload esperado
- novo hook de copilot, em linha com o padrao atual de hooks

### Backend

- `apps/api/src/modules/copilot/copilot.controller.ts`
- `apps/api/src/modules/copilot/copilot.service.ts`
- arquivos DTO do modulo `copilot`, se necessario
- `apps/api/src/modules/audit-logs/activity-log.controller.ts` apenas se surgir ajuste estritamente necessario
- `apps/api/src/modules/audit-logs/activity-log.service.ts` apenas se surgir ajuste estritamente necessario

## Riscos

- tentar recriar `create_task` e `create_note` do zero e gerar regressao
- abrir endpoint novo de nota sem necessidade
- manter `ask_copilot` como proxy e deixar a UX parecer mais pronta do que esta
- colocar resposta longa em toast pequeno e degradar a leitura
- inflar parser de voz alem do necessario neste bloco

## Sequencia minima recomendada para a Claude

1. Ajustar parser de `create_task` para titulo e `dueDays`
2. Consolidar o fluxo de `create_note` sobre o endpoint/hook ja canonicos
3. Criar `POST /copilot/ask` no backend
4. Criar hook frontend dedicado para `ask_copilot`
5. Trocar o proxy atual por execucao real
6. Adicionar microcopy contextual de execucao e sucesso

## Definition of Done deste contrato

- `create_task` continua no contexto do lead e passa a extrair melhor titulo e prazo
- `create_note` fica explicitamente fechado sobre a infraestrutura ja existente
- `ask_copilot` deixa de usar `ai_respond` como proxy
- a UI da voz mostra mensagens de acao mais claras
- nenhuma nova arquitetura paralela e criada para notas ou tarefas
