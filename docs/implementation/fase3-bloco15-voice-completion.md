# Fase 3 — Bloco 15: Voice Completion (V2 + V3)

**Data:** 2026-04-24
**Status:** FECHADO

## Escopo

Completar as integrações de voz que dependiam de endpoints reais:
- **V2** — `create_note` via voz: salva nota de atividade com `type: manual_note`
- **V3** — `ask_copilot` real: usa `POST /copilot/ask` com contexto do lead (não `ai_respond`)

## Estado anterior

Ambas as integrações já estavam implementadas em sessões anteriores:
- `POST /activity-logs/notes` — endpoint existente
- `useCreateNote(leadId)` — hook existente
- `POST /copilot/ask` — endpoint existente via `CopilotService.ask()`
- `useAskCopilot` — hook existente
- `LeadDetailModal.tsx` — casos `create_note` e `ask_copilot` já wired

## Gap resolvido neste bloco

`AskCopilotDto.leadId` era obrigatório, mas a spec exige `leadId?: string` para
permitir perguntas gerais sem contexto de lead.

### Mudanças

**`apps/api/src/modules/copilot/dto/ask-copilot.dto.ts`**
- `leadId` agora `@IsOptional() @IsUUID() leadId?: string`

**`apps/api/src/modules/copilot/copilot.service.ts`**
- Assinatura: `ask(orgId, question, leadId?)` — leadId movido para último (opcional)
- Se `leadId` ausente, prompt genérico sem contexto de lead
- Se `leadId` presente, busca lead, valida tenant, injeta contexto no prompt

**`apps/api/src/modules/copilot/copilot.controller.ts`**
- Atualizado para nova ordem de args: `ask(ctx.orgId, dto.question, dto.leadId)`

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/modules/copilot/dto/ask-copilot.dto.ts` | leadId opcional |
| `apps/api/src/modules/copilot/copilot.service.ts` | leadId? opcional no ask() |
| `apps/api/src/modules/copilot/copilot.controller.ts` | args atualizados |

## Testes sugeridos

- `POST /copilot/ask` com `leadId` válido → retorna resposta com contexto do lead
- `POST /copilot/ask` sem `leadId` → retorna resposta genérica (sem 400)
- `POST /copilot/ask` com `leadId` de outro org → 404
