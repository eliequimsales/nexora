# Bloco 11 — Voice Intents V1/V2/V3

## Objetivo

Conectar os três intents de voz que estavam reconhecidos mas não executados: `create_task` (V1), `create_note` (V2) e `ask_copilot` (V3). Adicionar extração semântica de dados no parser e feedback de estado contextual na UI.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/copilot/dto/ask-copilot.dto.ts` | DTO para POST /copilot/ask |
| `apps/app/lib/hooks/copilot/useAskCopilot.ts` | Mutation para POST /copilot/ask |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/app/types/domain/voice-actions.ts` | `VoiceActionIntent` ganhou `taskTitle?`, `taskDueDays?` |
| `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts` | Parser melhorado para `create_task` (extrai dueDays + título limpo); helpers `extractDueDays`, `extractTaskTitle`, `dueDaysLabel`; parser `ask_copilot` removeu proxy `aiActionType: 'ai_respond'`; palavras-chave de task ampliadas ("lembrar", "lembre") |
| `apps/app/components/modules/voice-actions/VoiceActionPanel.tsx` | `EXECUTING_LABELS` por intent type; Badge usa label contextual durante `status='executing'` |
| `apps/app/components/modules/leads/LeadDetailModal.tsx` | `create_task`: usa `intent.taskTitle` e `intent.taskDueDays`; `ask_copilot`: usa `useAskCopilot` real; `create_note` e `create_task` com título de outcome com ✓ |
| `apps/app/lib/api/copilot.api.ts` | Adicionado `ask(leadId, question)` |
| `apps/api/src/modules/copilot/copilot.service.ts` | Injeta `LlmService`; novo método `ask(orgId, leadId, question)` com prompt contextual do lead |
| `apps/api/src/modules/copilot/copilot.controller.ts` | `POST /copilot/ask` com guard `copilot:read` |
| `apps/api/src/modules/copilot/copilot.module.ts` | Importa `AiActionsModule` para usar `LlmService` |

---

## V1 — create_task

### Extração de dados do parser

Funções novas em `useVoiceActionController.ts`:

- `extractDueDays(normalized)` — detecta: "hoje"=0, "amanhã"=1, "depois de amanhã"=2, "essa semana"=5, "próxima semana"=7, "em N dias"=N. Default: 1.
- `extractTaskTitle(transcript, normalized)` — remove verbos de comando ("crie", "criar", "adicione", "lembrar de") e referências temporais. Retorna título limpo.
- `dueDaysLabel(days)` — converte para texto legível ("hoje", "amanhã", "próxima semana", "em N dias").

Parser `create_task` popula `taskTitle` e `taskDueDays` no intent. Preview mostra:
```
Título: "ligar para cliente" — Prazo: amanhã
```

Handler em `LeadDetailModal` usa `intent.taskTitle ?? 'Tarefa criada por voz'` e `intent.taskDueDays ?? 1` em vez de re-parsear o transcript.

Palavras-chave ampliadas: agora também reconhece "lembrar" e "lembre" além de "tarefa"/"task".

---

## V2 — create_note

Já estava conectado desde a implementação do Bloco 5. Verificado e funcional:
- Backend: `POST /activity-logs/notes` com `{ leadId, content }` → cria `ActivityLog.type='manual_note'`
- Frontend: `useCreateNote(leadId)` chama `activityLogsApi.createNote(leadId, content)`
- Handler: `intent.noteContent ?? intent.transcript` → `createNote.mutateAsync(content)`
- Parser extrai texto limpo (remove verbos "anote que", "registre que")

Única mudança: título de outcome atualizado para `'Nota registrada ✓'`.

---

## V3 — ask_copilot

### Backend: `POST /copilot/ask`

- Guard: `@RequirePermission('copilot:read')`
- Body: `{ leadId: UUID, question: string (max 500) }`
- Comportamento:
  1. Busca lead validando `orgId` (assertSameTenant implícito)
  2. Monta contexto do lead: nome, status, temperatura, score, contatos, origem, data de criação
  3. Chama `LlmService.call(prompt)` com template contextual
  4. Retorna `{ answer: string }`
- `CopilotModule` agora importa `AiActionsModule` para obter `LlmService` exportado

### Frontend

- `copilotApi.ask(leadId, question)` → `POST /copilot/ask`
- `useAskCopilot()` mutation sem side effects (sem toast — a resposta aparece no outcome do panel)
- Handler retorna `{ title: 'Resposta da IA', description: result.answer }`
- O `VoiceActionPanel` renderiza o `outcome.description` no card de sucesso — a resposta completa fica visível ali

---

## Feedback de estado contextual na UI

`EXECUTING_LABELS` por intent no `VoiceActionPanel`:

| intent.type | Badge durante execução |
|---|---|
| `create_task` | Criando tarefa… |
| `create_note` | Registrando nota… |
| `ask_copilot` | Consultando IA… |
| `classify_lead` | Classificando lead… |
| `generate_response` | Gerando resposta… |
| `generate_follow_up` | Gerando follow-up… |
| `summarize_lead` | Gerando resumo… |
| `mark_qualified` | Atualizando status… |
| `move_to_proposal` | Criando proposta… |

Intents sem label específico usam `STATUS_LABELS['executing']` como fallback.

Resultado após execução:
- `create_task` → `'Tarefa criada ✓'` + `"[título]" — prazo [X]`
- `create_note` → `'Nota registrada ✓'` + conteúdo da nota
- `ask_copilot` → `'Resposta da IA'` + resposta completa da IA

---

## O que testar

- [ ] "crie uma tarefa para amanhã de ligar para o cliente" → intent com `taskTitle='ligar para o cliente'`, `taskDueDays=1`
- [ ] "lembrar de enviar proposta essa semana" → intent com `taskTitle='enviar proposta'`, `taskDueDays=5`
- [ ] "crie tarefa para hoje" → `taskDueDays=0`, data da tarefa = hoje
- [ ] "crie tarefa em 3 dias" → `taskDueDays=3`
- [ ] Executar create_task → task aparece na lista de tarefas do lead
- [ ] "anote que o cliente pediu desconto" → `noteContent='o cliente pediu desconto'`
- [ ] Executar create_note → note aparece no timeline do lead
- [ ] "o que fazer com este lead" → intent `ask_copilot` sem `aiActionType`
- [ ] Executar ask_copilot → chama `POST /copilot/ask`, resposta aparece no outcome card
- [ ] Badge durante execução de create_task mostra "Criando tarefa…"
- [ ] Badge durante execução de ask_copilot mostra "Consultando IA…"
- [ ] `POST /copilot/ask` com leadId de outra org retorna 404
- [ ] `POST /copilot/ask` com mock provider retorna resposta mock
