# Fase 1 — Bloco 2: Módulos Core

**Data:** 2026-04-23
**Status:** Implementado — pendências de segurança e MVP mapeadas
**Revisão:** Revisão crítica completa realizada (ver `brain/MELHORIAS_PENDENTES.md`)

---

## 1. Módulos Implementados

| Módulo | Status | Rota principal |
|--------|--------|---------------|
| Workflows | ✅ Completo | `/workflows` |
| AI Actions | ✅ Completo | `/ai-actions` |
| AI Copilot | ✅ Completo | `/copilot` |
| Templates | ⚠️ Definido, não implementado | — |
| Proposals / Quotes | ✅ Completo | `/proposals` + `/p/:token` |
| Analytics | ✅ Completo | `/analytics` |
| Audit Logs | ✅ Completo | `/audit-logs` |
| Activity Logs | ✅ Completo | `/activity-logs` |
| Integrations | ✅ Completo | `/integrations` + `/ingest/:formToken` |

---

## 2. Objetivo de Cada Módulo

### Workflows
Automação de fluxos operacionais baseados em eventos de lead. Um workflow tem um trigger (ex: `lead_created`) e uma ação (ex: `ai_classify`, `move_stage`, `create_task`). Executa automaticamente via `EventEmitter2`.

### AI Actions
Classificação de leads e geração de respostas via LLM (Anthropic Claude). Cada execução é persistida em `AiExecution` para rastreabilidade. Prompts são configurados por org via `Organization.aiPrompts`.

### AI Copilot
Assistente proativo que analisa o estado da org e sugere ações em batch: leads sem classificação, leads parados, propostas pendentes. Exibe sugestões contextuais na UI e permite executar ações em lote.

### Templates
Sistema de templates por nicho (ex: imobiliário, jurídico, saúde). Contém prompts de IA, estágios de pipeline e sugestões de workflow pré-configurados por setor. **Definido, implementação pendente.**

### Proposals / Quotes
Criação e envio de propostas comerciais para leads. Cada proposta tem token único, página pública (`/p/:token`) onde o cliente aceita ou rejeita. Aceitação muda o lead para `closed_won` e emite evento.

### Analytics
Agregações de métricas de negócio por período: funil de leads, taxa de conversão de propostas, distribuição de classificações de IA, execuções de workflows. Inclui card de insight gerado por IA.

### Audit Logs
Registro imutável de mutações sensíveis na org: troca de roles, ativação/desativação de usuários, criação e deleção de workflows, alterações de configurações. Desnormalizado (email e role do ator gravados diretamente).

### Activity Logs
Linha do tempo operacional de cada lead: criação, atualizações de status, movimentações de pipeline, execuções de IA, propostas enviadas. Exibida no modal de detalhe do lead.

### Integrations
Três sub-sistemas:
- **Canais de comunicação** — WhatsApp (Evolution API) e Email (SMTP), com configuração criptografada em AES-256-GCM
- **Webhooks de saída** — notificações HMAC-assinadas para sistemas externos em eventos de lead e proposta
- **Ingest público** — endpoint `POST /ingest/:formToken` para captura de leads via formulário externo

---

## 3. Arquitetura Envolvida

### Padrões transversais

| Padrão | Onde é usado |
|--------|-------------|
| `EventEmitter2` | Workflows, WebhookDispatcher, AuditLog (todos ouvem eventos de domínio sem acoplamento direto) |
| `@OnEvent()` | WorkflowEngine, WebhookDispatcher — reagem a `lead.*`, `proposal.*` sem import mútuo |
| Fire-and-forget | `AuditLogService.record()` — nunca bloqueia o fluxo principal |
| `assertSameTenant()` | Toda operação cross-resource que recebe um `id` externo |
| `@RequirePermission()` | Guard RBAC em todos os endpoints protegidos |
| `@Public()` | Apenas ingest e página pública de proposta |
| Adapter pattern | `EmailAdapter` + `WhatsAppAdapter` com interface uniforme via `ChannelService` |
| AES-256-GCM | Criptografia de credenciais de integração (`IntegrationCryptoService`) |
| HMAC-SHA256 | Assinatura de webhooks de saída (`X-Nexora-Signature`) |

### Fluxo de eventos

```
Lead criado (POST /leads ou /ingest/:token)
  → EventEmitter2.emit('lead.created')
    → WorkflowEngine: executa workflows ativos com trigger lead_created
      → AiActionsService.executeForLead() → Anthropic → emit('lead.classified')
      → WorkflowEngine: executa workflows com trigger lead_classified
    → WebhookDispatcherService: entrega payload HMAC para webhooks registrados
    → (futuro) BullMQ worker
```

### Schema — modelos adicionados neste bloco

```
Workflow, WorkflowExecution
AiExecution
Proposal
AuditLog
OutboundWebhook, IntegrationConfig, IntegrationLog
```

---

## 4. Arquivos Principais

### Backend — `apps/api/src/modules/`

| Arquivo | Responsabilidade |
|---------|-----------------|
| `workflows/workflow.engine.ts` | Ouve eventos, seleciona workflows ativos, executa ações |
| `workflows/workflows.service.ts` | CRUD de workflows + log de execução |
| `ai-actions/ai-actions.service.ts` | Executa prompt contra LLM, persiste AiExecution |
| `ai-actions/llm.service.ts` | Wrapper do Anthropic SDK (único ponto de contato com a API) |
| `copilot/copilot.service.ts` | Gera sugestões contextuais da org e executa batch |
| `proposals/proposals.service.ts` | Ciclo de vida de proposta (create → send → accept/reject) |
| `proposals/public-proposal.controller.ts` | Endpoint público `/p/:token` (sem auth) |
| `analytics/analytics.service.ts` | Agregações Prisma groupBy + geração de insight via LLM |
| `audit-logs/audit-log.service.ts` | `record()` fire-and-forget, escrita async com lookup de email |
| `audit-logs/activity-log.service.ts` | Timeline operacional de leads |
| `integrations/integration-crypto.service.ts` | Encrypt/decrypt AES-256-GCM para credenciais |
| `integrations/channel.service.ts` | Facade para envio via WhatsApp ou Email |
| `integrations/webhook-dispatcher.service.ts` | Entrega webhooks com HMAC, loga resultado |
| `integrations/ingest.controller.ts` | Endpoint público de captura de leads por formToken |
| `integrations/integrations.service.ts` | CRUD de configs, webhooks e logs de integração |

### Frontend — `apps/app/`

| Arquivo | Responsabilidade |
|---------|-----------------|
| `app/(app)/[slug]/workflows/page.tsx` | Lista e toggle de workflows |
| `app/(app)/[slug]/proposals/page.tsx` | Lista de propostas com filtros de status |
| `app/p/[token]/page.tsx` | Página pública de aceite/rejeição de proposta |
| `app/(app)/[slug]/analytics/page.tsx` | Dashboard de métricas com seletor de período |
| `app/(app)/[slug]/settings/audit/page.tsx` | Log de auditoria com filtros por tipo de ação |
| `app/(app)/[slug]/settings/integrations/page.tsx` | Config de canais, webhooks e logs de integração |
| `components/modules/integrations/ChannelCard.tsx` | Form inline de config de canal com teste de conexão |
| `components/modules/integrations/WebhookList.tsx` | CRUD de webhooks com exibição única do signing secret |
| `components/modules/analytics/FunnelBar.tsx` | Barras CSS-only de funil (sem biblioteca de gráfico) |
| `components/modules/leads/LeadTimeline.tsx` | Timeline vertical de atividade do lead |
| `lib/hooks/copilot/useBatchAiAction.ts` | Execução em lote de ações de IA pelo copilot |

---

## 5. Testes Recomendados

### Críticos (testar antes de avançar)

| Cenário | Tipo | Por quê |
|---------|------|---------|
| Workflow `ai_classify` cria `AiExecution` e atualiza `lead.aiClassification` | Integração | Fluxo central de IA |
| Workflow `move_stage` rejeita `targetStageId` de outro org | Unidade | Risco de cross-tenant |
| `proposal.send()` → lead recebe notificação (após fix H8) | E2E | Fluxo comercial principal |
| `/p/:token` — aceite atualiza lead para `closed_won` e emite evento | Integração | Conversão de proposta |
| `IntegrationCryptoService` — encrypt → decrypt retorna valor original | Unidade | Criptografia de credenciais |
| `ingest/:formToken` — token inválido retorna 400, token válido cria lead | Integração | Endpoint público |
| `AuditLogService.record()` — nunca propaga exceção para o caller | Unidade | Garantia fire-and-forget |
| Analytics `parsePeriod` com data inválida retorna erro 400 (após fix M8) | Unidade | Estabilidade |

### Importantes

| Cenário | Tipo |
|---------|------|
| `WorkflowEngine` não executa loop em `classify → workflow → classify` | Integração |
| `AnalyticsService` retorna dados corretamente filtrados por `orgId` | Unidade |
| Webhook falhado é logado com `status: 'failed'` e `httpStatus` correto | Integração |
| `AiExecution` não vaza dados entre orgs (filtro por `orgId`) | Integração |
| `CopilotService` não retorna sugestões de orgs diferentes | Unidade |

---

## 6. Pendências

Ver `brain/MELHORIAS_PENDENTES.md` para lista completa com contexto e fix sugerido.

### Resumo executivo

**CRÍTICOS** (bloqueiam produção):
- C4 — Ingest público sem rate limiting
- C5 — Chave de criptografia com fallback hardcoded em produção
- C6 — Analytics AI summary aceita dados do cliente (prompt injection)

**IMPORTANTES** (fix antes de billing/onboarding):
- H6 — Execução de workflow na thread HTTP (latência visível no ingest)
- H7 — Página pública de proposta sem tratamento de erro
- H8 — `proposal.send()` não notifica o lead
- H9 — Webhooks sem retry
- H10 — `move_stage` sem validação de tenant do estágio

**Migrações pendentes:**
```bash
pnpm prisma migrate dev --name add-workflows
pnpm prisma migrate dev --name add-proposals
pnpm prisma migrate dev --name add-audit-logs
pnpm prisma migrate dev --name add-integrations
```

**Dependência pendente:**
```bash
cd apps/api && pnpm install  # @anthropic-ai/sdk
```

**Variável de ambiente obrigatória:**
```
INTEGRATION_ENCRYPTION_KEY=<64 chars hex>
```

---

## 7. Próximos Passos

### Imediato (antes de avançar)
1. Resolver os 5 itens CRÍTICOS e H6–H10
2. Implementar `proposal.send()` com notificação via `ChannelService`
3. Validar fluxo ponta a ponta: formulário externo → lead → workflow → proposta → aceite
4. Executar migrations pendentes e `pnpm install`

### Próxima fase
1. **Polish e refinamento de UX** — estados de loading consistentes, empty states, mobile responsiveness
2. **Billing inicial** — planos, limites por org (leads, execuções de IA, usuários), integração com Stripe
3. **Onboarding avançado** — wizard de setup inicial: prompt de IA, pipeline padrão, primeiro workflow
4. **Template System v1** — implementar o que foi definido: templates por nicho com prompts + pipeline + workflows pré-configurados
5. **Fila assíncrona (BullMQ)** — mover execução de workflows e entregas de webhook para workers separados

### Dependências técnicas para próxima fase
- Redis já está no stack (`RedisModule` presente) — BullMQ pode ser adicionado sem infraestrutura nova
- `@nexora/shared` existe mas não exporta RBAC — mover o mapa de permissões antes de qualquer nova feature que dependa de roles
- Template System depende de nenhum módulo novo — pode ser implementado como configuração sobre módulos existentes

---

*Documento gerado em 2026-04-23. Próxima revisão após correção dos itens CRÍTICOS.*
