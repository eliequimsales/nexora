# Próximos Passos — Plano Executável

> **Gerado em:** 2026-04-23
> **Contexto:** Análise completa do estado atual após Fase 1 (Base + Módulos Core) + Bloco 3 (Voice/Persona/Secretary) + Polish UX + Fixes MVP.
> **Divisão de trabalho:** Codex prepara ambiente/contratos → Claude implementa em cima.
> **Fonte da verdade:** este documento substitui o checklist de AGORA.md até o fim da Fase 2.

---

## 1. Mapa do estado atual

### ✅ O que já está pronto e rodando
| Camada | Módulos |
|--------|---------|
| **Backend (NestJS)** | auth, organizations, users, dashboard, leads, pipeline, workflows, ai-actions, copilot, proposals, analytics, audit-logs, integrations, secretary |
| **Frontend (Next.js)** | auth, dashboard, leads, pipeline, workflows, proposals, analytics, settings (team/audit/integrations), voice-actions, onboarding (checklist), copilot |
| **Shared** | niche config imobiliária, RBAC types, domain types |
| **Segurança** | JWT dual-token, slug-based login, tenant isolation, HMAC webhooks, AES-256-GCM para credenciais de canal, rate limit no ingest |
| **IA** | Anthropic Claude integrado, persona configurável, secretary automático, prompts por nicho |
| **Últimos fixes (sessão 2026-04-23)** | client.ts porta 3001, LoginDto com slug, LoginForm com workspace field |

### ⚠️ Implementado parcialmente (gaps conhecidos)
| Item | Estado |
|------|--------|
| **Tasks** | Model existe + workflow cria via `create_task`; **não há módulo CRUD nem página `/tasks`** |
| **Email adapter** | Stub apenas — proposta "enviada" não chega no lead |
| **BullMQ** | Pacote instalado; **nenhum worker implementado** — workflows ainda rodam no processo HTTP via `setImmediate` |
| **Templates por nicho** | Só `real_estate.ts` — não há sistema de escolha de template |
| **Voice intents** | `create_task`, `create_note`, `ask_copilot` reconhecidos mas **não conectados** (V1, V2, V3) |
| **Workflows UI** | Faltam `move_stage` stage selector, `lead_stage_changed` condições from/to, `ai_follow_up` action (W1, W2, W3) |

### ❌ Não implementado (definidos no roadmap)
- Billing / Stripe / planos / limites por org
- Template System v1 (catálogo + aplicar no onboarding)
- Workers BullMQ assíncronos + retry de webhook
- Convites de usuário + reset de senha + CSV import
- Notifications module (in-app + email transacional)
- Testes além de auth/tenant-isolation

### 🐛 Pendências técnicas ainda abertas
- **H10** — `move_stage` no workflow engine sem validação de tenant do `targetStageId`
- **H1** — `@MaxLength(72)` na senha (bcrypt trunca silenciosamente acima disso)
- **H2** — throttle específico em `/auth/login` e `/auth/register` (5/min por IP)
- **M7** — RBAC map duplicado frontend ↔ backend, deveria vir de `@reshit/shared`
- **M9** — Loop potencial no WorkflowEngine (classify → workflow → classify)
- **M12** — UX quando org não configurou `aiPrompts`: workflow falha silenciosa
- **I1, I2** — Partial indexes + CHECK constraints via migration SQL raw

---

## 2. Divisão Codex ↔ Claude

| Responsável | O que faz |
|-------------|-----------|
| **Codex** | Pensa e prepara: migrações Prisma, novos models no schema, env vars, specs de contrato, decisões de bibliotecas, docker-compose, scripts, validações de env. **Não escreve código de aplicação.** |
| **Claude** | Implementa em cima da preparação: services, controllers, hooks, componentes, testes, refactors. |

**Fluxo operacional por bloco:**
1. Eli pede o bloco via prompt.
2. Claude lê o prompt + contrato preparado pelo Codex (se houver).
3. Claude implementa + documenta + sugere testes.
4. Eli valida.
5. Próximo bloco.

---

## 3. Roadmap dos próximos 10 blocos

A ordem foi escolhida priorizando: **destravar fluxo comercial real** → **escalar multi-nicho** → **monetizar** → **polir**.

### BLOCO 4 — Fixes de segurança residuais + sincronia RBAC
**Por quê:** tapar H10, H1, H2, M7, M9, M12 antes de qualquer novo módulo. Curto (1 sessão).

### BLOCO 5 — Tasks module completo
**Por quê:** Já existe no schema, workflow cria tasks, voice reconhece `create_task`. Falta UI/CRUD. Sem isso, tarefas criadas automaticamente ficam invisíveis.

### BLOCO 6 — Email real (Nodemailer) + Notifications module
**Por quê:** Fluxo comercial quebrado: proposta "enviada" não chega. Notifications module centraliza envios (email, in-app) e prepara terreno para retry.

### BLOCO 7 — Workers BullMQ (workflows + webhooks + retry)
**Por quê:** Workflows hoje rodam via `setImmediate` — funciona mas não é robusto. Webhook retry (H9) depende de BullMQ. Jobs agendados (follow-up 3 dias sem contato) também.

### BLOCO 8 — Template System v1
**Por quê:** Produto é multi-nicho. Hoje só imobiliária. Template = prompts + pipeline + workflows pré-configurados, aplicado no onboarding.

### BLOCO 9 — Onboarding wizard v2 (consome templates)
**Por quê:** Checklist atual é reativo. Wizard guia o novo usuário: org name → nicho → template aplicado → primeiro lead. Usa Bloco 8.

### BLOCO 10 — Billing (Stripe) + limites por org
**Por quê:** Monetização. Plans Starter/Pro/Business, limits em leads/mês, AI executions/mês, users. Guard que bloqueia quando estoura.

### BLOCO 11 — Voice Layer V1/V2/V3 fill
**Por quê:** Fechar os intents reconhecidos mas não conectados. Depende do Bloco 5 (tasks) e de endpoint novo `/copilot/ask`.

### BLOCO 12 — Workflows UI gaps (W1, W2, W3, W4)
**Por quê:** Workflow Engine tem mais capacidades do que a UI expõe. Completar o modal de criação.

### BLOCO 13 — Testes críticos + Polish final
**Por quê:** Cobertura de unit/integration nas regras críticas. Bugs residuais L1-L7.

---

## 4. Prompts prontos para copiar e colar

> Cada prompt abaixo é autocontido. Cole no início da sessão. Claude já sabe o contexto geral (CLAUDE.md + memory).

---

### 📦 PROMPT — BLOCO 4 (Fixes residuais + RBAC compartilhado)

```
Corrigir pendências residuais de segurança do MVP em um único bloco.

Escopo:
1. H10 — Em workflow.engine.ts, na ação move_stage: antes do prisma.lead.update, buscar o PipelineStage pelo targetStageId e validar stage.orgId === event.orgId. Lançar erro se divergir e gravar execution como failed com errorReason.
2. H1 — Em RegisterDto: @MaxLength(72) no campo password.
3. H2 — Em auth.controller: @Throttle({ default: { ttl: 60000, limit: 5 } }) nos métodos login e register.
4. M7 — Mover o mapa PERMISSIONS para packages/shared/src/rbac/permissions.ts. Importar nos dois lados (backend permissions.guard + frontend useCan). Remover duplicação.
5. M9 — No WorkflowEngine: antes de executar, checar se houve WorkflowExecution para o mesmo leadId + workflowId nos últimos 60s. Se sim, logar como skipped com errorReason: 'duplicate_recent_execution'.
6. M12 — Capturar BadRequestException de 'prompt não configurado' no engine e gravar errorReason: 'ai_prompt_not_configured'. Na UI da lista de workflows, se última execução falhou por esse motivo, renderizar link "Configurar IA" direto para settings.

Não criar novos módulos. Apenas ajustar arquivos existentes. Documentar no docs/implementation/fase2-bloco4-fixes-seguranca.md.
```

---

### 📦 PROMPT — BLOCO 5 (Tasks module + página /tasks)

```
Implementar módulo completo de Tasks com CRUD, página e integração com voice.

Contexto:
- Model Task já existe no schema Prisma.
- workflow.engine.ts usa prisma.task.create via action create_task.
- Voice intent create_task reconhecido mas não conectado (V1).

Escopo backend (apps/api):
- Criar src/modules/tasks/ com tasks.module.ts, tasks.controller.ts, tasks.service.ts, dto/ (create, update, response).
- Endpoints: GET /tasks (paginado, filtros status/assignedTo/leadId), GET /tasks/:id, POST /tasks, PATCH /tasks/:id (status done/pending, dueDate, assignedTo), DELETE /tasks/:id.
- Permissions: tasks:read (member), tasks:manage (member).
- Registrar no app.module.ts e adicionar as permissions em packages/shared/rbac.

Escopo frontend (apps/app):
- types/domain/tasks.ts
- lib/api/tasks.api.ts
- lib/hooks/tasks/ (useTasksQuery, useCreateTask, useUpdateTask, useCompleteTask)
- components/modules/tasks/ (TasksList, TaskRow, CreateTaskModal, TaskDetailDrawer)
- app/(app)/[slug]/tasks/page.tsx — página dedicada com filtros (minhas, todas, concluídas)
- Adicionar item "Tarefas" no Sidebar
- Integração voice: conectar intent create_task em components/modules/voice-actions para chamar useCreateTask.

Regras:
- Toda criação emite evento 'task.created'.
- Quando status vira 'done', gravar completedAt = now().
- Toda task precisa de leadId (não existe task sem lead no MVP).

Documentar em docs/implementation/fase2-bloco5-tasks-module.md.
Sugerir testes: unit para service (complete, listar por assignee), e2e para fluxo create→complete.
```

---

### 📦 PROMPT — BLOCO 6 (Email real + Notifications module)

```
Substituir stub de email por Nodemailer real e criar Notifications module que centraliza envios.

Codex (preparação — pedir antes se não feito):
- Adicionar nodemailer + @types/nodemailer em apps/api/package.json.
- Rodar pnpm install.
- Confirmar SMTP test env disponível (Mailtrap ou provider próprio).

Escopo backend:
1. email.adapter.ts:
   - Trocar stub por createTransport real com { host, port, secure: port === 465, auth: { user, pass } }.
   - testConnection deve chamar transporter.verify().
   - send deve passar { from: config.from ?? config.user, to, subject, text, html? }.
   - Catchar SMTPError específicos e retornar { ok: false, error } amigável.

2. Novo módulo src/modules/notifications/:
   - notifications.service.ts com métodos: sendTransactional(orgId, to, template, vars), sendInApp(orgId, userId, type, payload).
   - Template resolver simples (arquivos .hbs ou strings literais com {{var}}) para: welcome, proposal_sent, lead_assigned, task_due_soon.
   - Usar ChannelService para email.
   - Emitir evento 'notification.sent' para audit.

3. Reaproveitar nos handlers existentes:
   - proposal.sent → notifications.sendTransactional(..., 'proposal_sent', { link, leadName }).
   - user.invited (futuro) → 'welcome'.

Frontend: nada novo neste bloco.

Documentar em docs/implementation/fase2-bloco6-email-notifications.md.
Testes sugeridos: mock do transporter, verificar template resolve variáveis corretamente, verificar que testConnection detecta credencial inválida.
```

---

### 📦 PROMPT — BLOCO 7 (BullMQ workers: workflows + webhooks + retry)

```
Migrar execução síncrona (setImmediate) para filas BullMQ reais com retry exponencial.

Codex (preparação):
- Confirmar Redis disponível (já está no docker-compose).
- Sugerir design das filas e DLQ.
- Validar estratégia de backoff (ex: 1min, 5min, 30min).

Escopo backend:
1. Criar src/workers/ com:
   - queue.module.ts: registra 3 filas BullMQ: 'workflows', 'webhooks', 'scheduled-jobs'.
   - workflow.processor.ts: consome fila 'workflows', chama WorkflowEngine.execute.
   - webhook.processor.ts: consome fila 'webhooks' com retry { attempts: 3, backoff: { type: 'exponential', delay: 60000 } }.
   - scheduled.processor.ts: consome 'scheduled-jobs' (ex: "follow-up 3 dias sem contato").

2. workflow.engine.ts: no @OnEvent('lead.created'), em vez de executar inline, enfileirar job em 'workflows'.

3. webhook-dispatcher.service.ts: em vez de fetch direto, enfileirar em 'webhooks'. Resolve H9.

4. @nestjs/schedule (já instalado): criar cron diário que varre leads sem atividade há X dias e enfileira job de follow-up.

5. Painel admin opcional: @bull-board/api + @bull-board/express para /admin/queues (guard: role owner).

Frontend: adicionar badge discreto no dashboard mostrando "X jobs na fila" via GET /admin/queue-stats (opcional, só owner).

Documentar em docs/implementation/fase2-bloco7-workers-bullmq.md.
Testes: mockar queue.add e verificar que os listeners antigos delegaram. E2E: criar lead → verificar job enfileirado → processar → verificar AiExecution criado.
```

---

### 📦 PROMPT — BLOCO 8 (Template System v1 — multi-nicho real)

```
Criar sistema de templates por nicho: catálogo + aplicação no onboarding.

Codex (preparação):
- Definir formato de template em packages/shared/src/templates/types.ts (extending niche-configs types).
- Cada template: { id, niche, name, description, aiPrompts, pipelineStages[], workflows[], icon? }.
- Criar 4 templates iniciais em packages/shared/src/templates/: real_estate (migrar de niche-configs), legal, healthcare, consulting.
- Migrar o uso atual de getNicheConfig para getTemplate.

Escopo backend (apps/api):
1. src/modules/templates/:
   - templates.service.ts: list(), getById(id).
   - templates.controller.ts: GET /templates (público ou member), GET /templates/:id.
   - Não há persistência — templates vêm de @reshit/shared.

2. Novo método em OrganizationsService: applyTemplate(orgId, templateId):
   - Valida template existe.
   - Em transaction: sobrescreve aiPrompts, cria PipelineStages, cria Workflows default.
   - Grava em org.settings.appliedTemplate = { id, appliedAt, version }.
   - Emite 'organization.template_applied'.
   - Retorna org atualizada.
   - Endpoint: POST /organizations/current/apply-template { templateId }.

Escopo frontend (apps/app):
- types/domain/templates.ts
- lib/api/templates.api.ts
- lib/hooks/templates/useTemplatesQuery, useApplyTemplate
- components/modules/templates/TemplateCard, TemplateGrid
- Preparar para uso no onboarding (Bloco 9).

Regras:
- Aplicar template NÃO é reversível (grava auditLog).
- Se org já tem leads, aplicar template só adiciona, não apaga pipeline atual. Se não tem leads, substitui.

Documentar em docs/implementation/fase2-bloco8-template-system.md.
```

---

### 📦 PROMPT — BLOCO 9 (Onboarding wizard v2 consumindo templates)

```
Substituir checklist reativo por wizard guiado que aplica template e configura a org na primeira sessão.

Contexto:
- Checklist atual (lib/hooks/onboarding/useOnboardingProgress.ts) vai continuar existindo como pós-wizard.
- Wizard = modal obrigatório de primeira sessão, dismissible só depois de completar ou pular.

Escopo frontend:
1. components/modules/onboarding/WizardModal.tsx com steps:
   - Step 1: Bem-vindo (mostra nome do usuário + org).
   - Step 2: Escolher nicho / template (grid de TemplateCard do Bloco 8).
   - Step 3: Preview do que será aplicado (prompts, pipeline, workflows) + botão "Aplicar".
   - Step 4: Configurar assistente (nome, tom, estilo — reutiliza AssistantPersonaForm).
   - Step 5: Criar primeiro lead (opcional, link para CreateLeadForm ou pular).
   - Step 6: Concluído — CTA para dashboard.
2. lib/hooks/onboarding/useWizardState.ts: controla step atual + persiste em org.settings.onboarding.wizardStep.
3. Trigger: no layout (app)/[slug]/layout.tsx, se !org.settings.onboarding.wizardCompleted && !dismissed, abrir wizard.
4. Ao finalizar, gravar org.settings.onboarding.wizardCompleted = true + timestamp.

Escopo backend:
- Endpoint PATCH /organizations/current/onboarding { wizardStep?, wizardCompleted?, dismissed? }.

Documentar em docs/implementation/fase2-bloco9-onboarding-wizard.md.
```

---

### 📦 PROMPT — BLOCO 10 (Billing Stripe + limites por org)

```
Adicionar billing com Stripe: planos Starter/Pro/Business + limites enforced via guard.

Codex (preparação):
- Adicionar stripe em apps/api/package.json.
- Definir products/prices no Stripe dashboard (manual, entregar IDs).
- Adicionar STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER/PRO/BUSINESS em env.
- Novo model no schema Prisma:
  model Subscription {
    id            String   @id @default(uuid())
    orgId         String   @unique
    stripeCustomerId   String
    stripeSubId        String?
    plan          String   // starter | pro | business
    status        String   // active | past_due | canceled | trialing
    currentPeriodEnd DateTime
    limits        Json     // { leadsPerMonth, aiExecPerMonth, maxUsers }
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }
- Migrar: pnpm prisma migrate dev --name add-subscriptions.

Escopo backend:
1. src/modules/billing/:
   - billing.service.ts: createCheckoutSession(orgId, priceId), createPortalSession(orgId), handleWebhook(rawBody, signature).
   - billing.controller.ts: POST /billing/checkout, POST /billing/portal, POST /billing/webhook (Public + raw body parser).
   - Webhook handlers para: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.
2. src/common/guards/plan-limits.guard.ts: lê subscription.limits, compara com contagem atual do mês (leads ou aiExecutions). Aplicar em LeadsController.create e AiActionsController.execute.
3. Middleware no ingest: bloquear e retornar 402 se limite estourado.

Escopo frontend:
- app/(app)/[slug]/settings/billing/page.tsx: plano atual, uso do mês, botão upgrade (abre checkout Stripe).
- components/modules/billing/PlanCard, UsageMeter.
- Toast global: quando API retorna 402, mostrar modal "Limite do plano atingido — fazer upgrade".

Documentar em docs/implementation/fase2-bloco10-billing.md.
Segurança: rota /billing/webhook deve validar signature do Stripe antes de processar.
```

---

### 📦 PROMPT — BLOCO 11 (Voice V1/V2/V3 fill)

```
Fechar os intents de voz reconhecidos mas não conectados.

Contexto: components/modules/voice-actions já tem parser e button. Intents create_task, create_note, ask_copilot estão "planned" na UI.

Escopo:
1. V1 — create_task:
   - Depende do Bloco 5 (tasks module feito).
   - Conectar intent no handler usando useCreateTask(leadId, { title, dueDays }).
   - Parser extrai título livre ("lembrar de ligar amanhã" → title="ligar", dueDays=1).

2. V2 — create_note:
   - Backend: adicionar endpoint POST /leads/:id/notes em ActivityLog como type='note_manual' { content }.
   - Frontend hook useCreateNote(leadId).
   - Conectar intent.

3. V3 — ask_copilot:
   - Backend: novo endpoint POST /copilot/ask { leadId, question } → retorna { answer } chamando LlmService.call com prompt contextual (dados do lead + histórico).
   - Frontend hook useAskCopilot.
   - Reconectar intent (hoje aponta para ai_respond como proxy).
   - UI: renderizar resposta em modal ou toast expandido.

4. Adicionar na UI estados claros: "Entendi, criando tarefa…" → "Tarefa criada ✓".

Documentar em docs/implementation/fase2-bloco11-voice-fill.md.
```

---

### 📦 PROMPT — BLOCO 12 (Workflows UI gaps — W1, W2, W3, W4)

```
Completar a UI do CreateWorkflowModal para expor todas as capacidades do engine.

Escopo apenas frontend:
1. W1 — ai_follow_up:
   - Adicionar opção no select de actionType.
   - Adicionar ao enum em types/domain/workflows.ts e no ACTION_LABELS.
   - Adicionar no enum do CreateWorkflowDto (backend, se faltando).

2. W2 — move_stage sem target:
   - Quando actionType === 'move_stage', renderizar select populado com usePipelineStages() (pipeline.api).
   - actionConfig.targetStageId = valor escolhido.

3. W3 — lead_stage_changed sem from/to:
   - Quando triggerType === 'lead_stage_changed', renderizar 2 selects opcionais (fromStageId, toStageId).
   - Gravar em triggerConditions.

4. W4 — aiPrompts missing guard:
   - No top da página /workflows, se org.aiPrompts está vazio, mostrar banner amarelo: "Configure os prompts de IA para que workflows de classificação funcionem" com CTA → settings.
   - Usar useOrg() para checar.

Documentar em docs/implementation/fase2-bloco12-workflows-ui.md.
```

---

### 📦 PROMPT — BLOCO 13 (Testes críticos + Polish final)

```
Adicionar cobertura de testes nos módulos críticos e limpar bugs residuais.

Escopo testes backend:
1. leads.service.spec.ts — update com stageId/assignedTo inválido deve lançar (regressão de C1).
2. workflow.engine.spec.ts — move_stage com targetStageId de outro tenant deve falhar (regressão H10). Loop prevention (M9).
3. proposals.service.spec.ts — respond com token expirado, duplicado, válido. Transition de status correto.
4. integrations/integration-crypto.service.spec.ts — encrypt + decrypt roundtrip, falha se key ausente em prod.
5. auth.service.spec.ts já existe — adicionar teste do slug login.

Escopo testes e2e (apps/api/test):
- proposal-flow.e2e-spec.ts: ingest lead → classify → create proposal → send → accept → verify lead status closed_won.

Escopo polish:
- L1: remover import não usado Spinner em LeadsList.
- L2: comentário correto em AiExecution triggerType.
- L3: import estático de NotFoundException em ai-actions.controller.
- L4: @@index em Workflow (orgId, triggerType, isActive) — precisa migration.
- L5: mover CopilotButton para layout global.
- L6: useAiInsight com errorMessage exposto.
- L7: avaliar split de proposals:manage em create/send/close.
- I1, I2: migration SQL raw com partial indexes e CHECK constraints.

Documentar em docs/implementation/fase2-bloco13-testes-polish.md.
```

---

## 5. Ordem recomendada de execução

```
Hoje    → Bloco 4 (1 sessão curta)
Semana 1 → Bloco 5 (Tasks) + Bloco 6 (Email/Notifications)
Semana 2 → Bloco 7 (BullMQ) — requer mais ambiente
Semana 3 → Bloco 8 (Templates) + Bloco 9 (Onboarding wizard)
Semana 4 → Bloco 10 (Billing Stripe) — grande, pode dividir
Depois  → Bloco 11 (Voice) + Bloco 12 (Workflows UI)
Fim     → Bloco 13 (Testes + polish)
```

**Regra:** cada bloco = 1 prompt → 1 sessão → 1 doc de implementação. Ao final, atualizar `LOG_CONTINUO.md` e `AGORA.md` no vault.

---

## 6. Definition of Done por bloco

Cada bloco só fecha quando:
- ✅ Código implementado e `pnpm typecheck` passa em api e app
- ✅ Documentação em `docs/implementation/fase2-bloco{N}-*.md`
- ✅ Testes sugeridos listados (mínimo unit do core novo)
- ✅ `LOG_CONTINUO.md` atualizado
- ✅ Próximo bloco pendente em `AGORA.md`

---

*Documento pronto para orientar a Fase 2 inteira. Atualizar quando um bloco for concluído, marcando ✅ e linkando o doc correspondente.*
