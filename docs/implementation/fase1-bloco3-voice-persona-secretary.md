# Fase 1 — Bloco 3: Voice Layer, Persona Configurável e Secretária Operacional

**Data:** 2026-04-23
**Status:** Implementado — pendências mapeadas
**Sessão:** continuação de sessão anterior (contexto compactado)

---

## 1. Objetivo do Bloco

Adicionar três camadas de inteligência operacional ao MVP:

- **Voice Layer**: comandos de voz dentro do modal de lead, integrados aos módulos de AI Actions, Leads, Proposals e Activity Logs.
- **Persona Configurável**: nome, tom e estilo da assistente por organização, injetados em todos os prompts de IA.
- **Secretária Operacional**: sistema automático que classifica novos leads e registra um briefing no histórico da equipe — sem configuração de workflow pelo usuário.

---

## 2. Módulos Afetados

| Módulo | Tipo de mudança |
|---|---|
| `ai-actions` | `prompt.service.ts` passa persona; `ai-actions.service.ts` lê `org.settings.assistant` |
| `organizations` | DTO expandido com `assistant` e `secretary` |
| `activity-logs` | Novo endpoint `POST /activity-logs/notes`; novo método `createNote()` |
| `secretary` | Módulo novo — `SecretaryService` com `@OnEvent` para `lead.created` e `lead.classified` |
| `integrations` | Bugs corrigidos em `ingest.controller.ts` (campo inválido + shape do evento) |
| `workflows` | `ai_follow_up` adicionado ao `ACTION_TYPES` do DTO |
| Frontend — `voice-actions` | `VoiceActionButton`, `VoiceActionPanel`, `useVoiceActionController` — implementação completa + refinamento UX |
| Frontend — `org` | `AssistantPersonaForm`, `SecretarySettingsForm` — novos componentes de settings |
| Frontend — `leads` | `LeadDetailModal` conectado a 8 intents de voz com mutations reais |

---

## 3. Arquivos Principais

### Backend

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/ai-actions/prompt.service.ts` | `AssistantPersona` interface + `buildVariables()` injeta `{{assistant_name}}`, `{{assistant_tone}}`, `{{assistant_style}}` |
| `apps/api/src/modules/ai-actions/ai-actions.service.ts` | Lê `org.settings.assistant` e passa para `buildVariables()` |
| `apps/api/src/modules/organizations/dto/org-settings.dto.ts` | `OrgAssistantDto` + `OrgSecretaryDto` com validação |
| `apps/api/src/modules/audit-logs/activity-log.service.ts` | `createNote(orgId, leadId, userId, content)` com assertSameTenant |
| `apps/api/src/modules/audit-logs/activity-log.controller.ts` | `POST /activity-logs/notes` com `@RequirePermission('leads:update')` |
| `apps/api/src/modules/audit-logs/dto/create-note.dto.ts` | DTO com validação de UUID + string 1–1000 chars |
| `apps/api/src/modules/secretary/secretary.service.ts` | `@OnEvent('lead.created')` classifica; `@OnEvent('lead.classified')` escreve briefing |
| `apps/api/src/modules/integrations/ingest.controller.ts` | Bugs corrigidos: campo `classification` removido; evento emitido com shape correto |
| `apps/api/src/modules/workflows/dto/create-workflow.dto.ts` | `ai_follow_up` adicionado ao `ACTION_TYPES` |

### Frontend

| Arquivo | Responsabilidade |
|---|---|
| `apps/app/types/domain/organizations.ts` | `AssistantPersona`, `SecretarySettings`, `OrgSettings` tipados |
| `apps/app/types/domain/voice-actions.ts` | Todos os tipos da voice layer incluindo `noteContent` |
| `apps/app/components/modules/voice-actions/VoiceActionButton.tsx` | Botão de ativação com dual-span `animate-ping` |
| `apps/app/components/modules/voice-actions/VoiceActionPanel.tsx` | Painel completo: 9 estados, waveform, intent card, outcome card |
| `apps/app/lib/hooks/voice-actions/useVoiceActionController.ts` | State machine, Web Speech API, `parseIntent()`, `buildSuggestions()` |
| `apps/app/components/modules/leads/LeadDetailModal.tsx` | `onExecuteIntent` conectado a 8 intents com mutations reais |
| `apps/app/lib/hooks/activity-logs/useCreateNote.ts` | Mutation com invalidação de cache + toast |
| `apps/app/components/modules/org/AssistantPersonaForm.tsx` | Form react-hook-form + zod: nome, tom, estilo |
| `apps/app/components/modules/org/SecretarySettingsForm.tsx` | Toggle com mutation imediata |
| `apps/app/app/(app)/[slug]/settings/page.tsx` | Seções "Secretária" e "Persona da assistente" adicionadas |

---

## 4. Decisões Tomadas

**Persona via `org.settings` (JSON column)**
Não foi criada migração nova. `assistant` e `secretary` entram como sub-objetos do campo `settings` já existente. O PATCH faz merge profundo — nunca substitui o objeto inteiro.

**SecretaryService separado do WorkflowEngine**
Secretária é automação de sistema; workflows são configuração de usuário. Ambos escutam os mesmos eventos mas são listeners independentes. Sem acoplamento entre eles.

**`triggeredBy: 'secretary:system'`**
O briefing só é escrito quando `triggeredBy === 'secretary:system'`. Evita duplicata quando usuário classifica manualmente (que já gera `lead_classified` no `activityLog`).

**`create_note` usa `leads:update` em vez de permissão nova**
Semanticamente correto: criar uma nota sobre um lead é uma operação de atualização de dados do lead. Evitou adicionar uma entrada nova no mapa de permissões.

**Voice layer 100% browser-native**
Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) sem dependência externa. Fallback via textarea + botão "Interpretar" funciona em qualquer navegador.

**Comandos `create_task` e `ask_copilot` como copilot próprio**
`create_task` marcado como `planned` — precisa de módulo de tasks com endpoint próprio. `ask_copilot` é proxy para `ai_respond` no MVP; receberá endpoint dedicado em v2.

---

## 5. Testes Recomendados

### Voice Layer
```bash
# create_note via voz
# Input: "anote que cliente quer reunião na quinta"
# Esperado: activityLog type='manual_note', content='cliente quer reunião na quinta'

# mark_qualified
# Input: "marcar este lead como qualificado"
# Confirmar → lead.status === 'qualified'

# move_to_proposal
# Input: "mova para proposta"
# Confirmar → nova proposta em rascunho com leadId correto

# fallback sem microfone
# Digitar no textarea → Interpretar → intent card aparece normalmente

# comando ambíguo
# Input: texto sem match
# Esperado: status='ambiguous', mensagem de ajuda, sem crash
```

### Persona
```bash
# Salvar persona e verificar persistência
PATCH /organizations/me { settings: { assistant: { name: "Sofia", tone: "friendly", style: "empathetic" } } }
GET /organizations/me → settings.assistant deve retornar os valores

# IA usando persona
# Prompt de ai_respond com "Você se chama {{assistant_name}}."
# Executar → activityLog deve mencionar "Sofia"

# Fallback sem persona
# Remover settings.assistant → ai_classify deve rodar normalmente com defaults
```

### Secretária
```bash
# Lead criado via ingest com secretary habilitada
POST /ingest/:formToken { name, email, phone }
→ lead classificado automaticamente
→ activityLog type='secretary_briefing' criado

# Sem aiPrompts.classify configurado
→ secretária não age (falha silenciosa, sem erro no lead)

# secretary.enabled = false
→ nenhuma ação automática disparada
```

### Correções de bug (regressão)
```bash
# ingest não deve criar campo classification inexistente
POST /ingest/:formToken → prisma não deve lançar erro de campo desconhecido

# ai_follow_up deve ser aceito no DTO de workflow
POST /workflows { actionType: 'ai_follow_up' } → 201, não 400
```

---

## 6. Pendências

| ID | Descrição | Prioridade |
|---|---|---|
| V1 | `create_task` voice intent sem backend — precisa de módulo de tasks | Alta |
| V3 | `ask_copilot` é proxy de `ai_respond` — endpoint dedicado em v2 | Baixa |
| W2 | `move_stage` sem seletor de `targetStageId` no modal de workflow | Média |
| W3 | `lead_stage_changed` sem seletores de stage from/to no modal | Média |
| W4 | Orgs sem `aiPrompts` falham com `BadRequestException` — guard defensivo pendente | Alta |
| H4 | Mapa de permissões RBAC duplicado frontend ↔ backend | Média |
| SEC | Validar que `createNote` não aceita `leadId` de outra org via DTO (já protegido no service, mas sem teste) | Alta |

---

## 7. Próximo Passo Ideal

**W4 — Guard defensivo para orgs sem `aiPrompts`**

Orgs novas ou recém-criadas não têm `aiPrompts` configurados. Hoje o `AiActionsService` lança `BadRequestException` quando o template não existe. A secretária e os workflows de IA falham silenciosamente em vez de guiar o usuário.

Fix: retornar erro tratado com mensagem clara, ou pular a ação e logar um aviso no `activityLog` do lead (`type: 'ai_skipped'`, `content: 'Prompt não configurado — configure em Configurações → IA.'`).

Impacto: baixo esforço, alta qualidade percebida no onboarding.
