# Guia Nexora — Para o Codex

> Este arquivo é o ponto de entrada para qualquer IA que queira entender o projeto Nexora.
> Atualizado em: 2026-04-23
> Autor do projeto: Eli
> IAs ativas no projeto: Claude Code (implementação), Obsidian (memória), Codex (guia estratégico)

---

## O que é a Nexora

Plataforma SaaS B2B de automação comercial com IA, multi-nicho e multi-tenant.

**Missão:** permitir que pequenas e médias empresas automatizem atendimento, qualificação de leads, CRM, follow-up, propostas comerciais e fluxos operacionais usando inteligência artificial — sem precisar de equipe técnica.

**Modelo de negócio:** assinatura mensal por organização, com planos por volume de leads, execuções de IA e usuários.

**Público-alvo MVP:** imobiliárias, escritórios jurídicos, clínicas, consultores independentes. Qualquer negócio com funil comercial ativo.

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend | NestJS + TypeScript |
| Banco | PostgreSQL via Prisma ORM |
| Cache / Filas | Redis (BullMQ planejado para workers) |
| IA | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Auth | JWT dual-token (access + refresh) |
| Infra | Docker Compose (local), deploy futuro em VPS/Railway |
| Monorepo | pnpm workspaces (`apps/api`, `apps/app`, `packages/shared`) |

---

## Arquitetura em uma frase

Multi-tenant shared-schema: todas as orgs compartilham o mesmo banco, separadas por `orgId`. Toda operação sensível verifica tenant com `assertSameTenant()`. RBAC semântico por permissão (não só por role).

---

## Módulos implementados

### ✅ Bloco 1 — Base Estrutural
| Módulo | O que faz |
|--------|-----------|
| Auth | Register, login, refresh token, logout, JWT guard global |
| Organizations | Criação de org, slug único, configurações, prompt de IA |
| Users | Gerenciamento de membros, convites, troca de role |
| Dashboard | Resumo de métricas da org (leads, propostas, atividade) |
| Leads | CRUD completo, classificação por IA, timeline, filtros |
| Pipeline | Kanban multi-estágio, movimentação drag-and-drop |

### ✅ Bloco 2 — Módulos Core
| Módulo | O que faz |
|--------|-----------|
| Workflows | Automação por eventos: lead criado → classifica → move estágio → cria tarefa |
| AI Actions | Executa prompts via Claude (classificar, responder, follow-up). Persiste `AiExecution` |
| AI Copilot | Sugere ações em batch: leads parados, sem classificação, propostas esquecidas |
| Proposals | Cria proposta, envia por link público, aceite/rejeição pelo lead |
| Analytics | Métricas por período + insight gerado por IA |
| Audit Logs | Registro imutável de ações sensíveis (role change, delete, config) |
| Activity Logs | Timeline por lead (status, IA, proposta, tarefa) |
| Integrations | WhatsApp (stub), Email SMTP, Webhooks HMAC, Ingest via formToken |

### ⚠️ Definido, não implementado
| Módulo | O que faz |
|--------|-----------|
| Templates | Configs por nicho: prompts de IA + pipeline + workflows pré-definidos |

---

## Fluxo principal (end-to-end)

```
1. Lead chega via formulário externo
   POST /ingest/:formToken → Lead criado no banco

2. Evento disparado
   emit('lead.created') → WorkflowEngine + WebhookDispatcher

3. Workflow executa
   ai_classify → Claude analisa lead → classification: hot/warm/cold
   emit('lead.classified') → move_stage automático

4. Copilot detecta lead parado
   Sugere "enviar follow-up" → usuário clica → AI responde

5. Proposta criada
   Usuário cria proposta com itens → envia → link /p/:token gerado

6. Lead recebe notificação
   ChannelService → WhatsApp ou Email com link da proposta

7. Lead aceita proposta
   /p/:token → accept → lead.status = closed_won → emit('proposal.accepted')
   → webhook externo notificado via HMAC
```

---

## Padrões arquiteturais que você precisa saber

| Padrão | Onde aparece | Por quê existe |
|--------|-------------|---------------|
| `assertSameTenant(a, b)` | Todo service com `id` externo | Previne IDOR cross-tenant |
| `@RequirePermission('x:y')` | Todo controller protegido | RBAC semântico por ação |
| `@Public()` | Ingest e proposta pública | Rotas sem autenticação |
| `@OnEvent('x.y')` | WorkflowEngine, WebhookDispatcher | Desacoplamento por evento |
| Fire-and-forget | AuditLog, notificação de proposta | Nunca bloqueia o fluxo principal |
| `setImmediate()` | Ingest, send de proposta | Libera thread HTTP antes dos side effects |
| AES-256-GCM | IntegrationCryptoService | Credenciais de canal cifradas no banco |
| HMAC-SHA256 | WebhookDispatcher | Autenticidade do payload para endpoints externos |

---

## Estado atual — o que está feito vs. o que está pendente

### Feito ✅
- Base completa: auth, orgs, users, leads, pipeline
- Todos os módulos do Bloco 2 implementados
- Schema Prisma com 15+ models
- Revisão arquitetural crítica realizada
- 34 pendências mapeadas e priorizadas

### Pendências críticas (C) — bloqueiam produção
| ID | Problema | Status |
|----|----------|--------|
| C1 | IDOR em leads.service — stageId/assignedTo sem validação de tenant | ⏳ pendente |
| C2 | Login não-determinístico com email duplicado entre orgs | ⏳ pendente |
| C3 | getBoard() sem limit de leads por estágio | ⏳ pendente |
| C4 | Ingest público sem rate limiting | ✅ corrigido |
| C5 | Chave de cripto com fallback hardcoded em produção | ✅ corrigido |
| C6 | Analytics AI summary aceitava dados do cliente (prompt injection) | ✅ corrigido |

### Pendências altas (H) — fix antes de billing/onboarding
| ID | Problema | Status |
|----|----------|--------|
| H6 | Workflow na thread HTTP — latência no ingest | ✅ corrigido (setImmediate) |
| H7 | Página de proposta sem onError | ✅ corrigido |
| H8 | proposal.send() não notificava o lead | ✅ corrigido |
| H9 | Webhooks sem retry | ✅ handler proposal.sent adicionado |
| H10 | move_stage sem validação de tenant | ⏳ pendente |
| H1-H5 | bcrypt maxLength, throttle auth, partial indexes, RBAC sync, slug URL | ⏳ pendente |

### Migrações pendentes
```bash
pnpm prisma migrate dev --name add-workflows
pnpm prisma migrate dev --name add-proposals
pnpm prisma migrate dev --name add-audit-logs
pnpm prisma migrate dev --name add-integrations
```

---

## Próxima fase — o que vem depois das correções

```
Fase 2 — Polish + Billing + Onboarding

1. Polish UX
   - Estados de loading consistentes em todas as páginas
   - Empty states com CTAs úteis
   - Mobile responsiveness
   - Validação de formulários no frontend

2. Billing inicial
   - Integração Stripe (checkout, portal, webhooks)
   - Planos: Starter / Pro / Business
   - Limites por org: leads/mês, execuções de IA/mês, usuários
   - Página de upgrade quando limite atingido

3. Onboarding avançado
   - Wizard de primeiro acesso: nome da org → nicho → prompt de IA → pipeline padrão
   - Email de boas-vindas
   - Checklist de setup na home

4. Template System v1
   - Templates por nicho (imobiliário, jurídico, saúde, consultoria)
   - Cada template: prompts de IA + estágios de pipeline + workflows pré-configurados
   - Selecionado no onboarding

5. BullMQ (workers assíncronos)
   - Workflow execution em fila separada
   - Webhook retry com backoff exponencial
   - Jobs agendados: "lead sem follow-up há X dias"
```

---

## Como a memória do projeto funciona (os 3 cérebros)

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE 3 CÉREBROS                     │
├────────────────┬──────────────────┬─────────────────────────┤
│   CLAUDE CODE  │     OBSIDIAN     │         CODEX           │
│                │                  │                         │
│  Implementa    │  Memória oficial │  Guia estratégico       │
│  código        │  do projeto      │  Revisa decisões        │
│  Revisa        │  - AGORA.md      │  Sugere abordagens      │
│  arquitetura   │  - LOG_CONTINUO  │  Não escreve código     │
│  Executa fixes │  - SESSAO_ATUAL  │                         │
│  Documenta     │  - backlog.md    │  Lê este arquivo        │
│                │  - decisões      │  + vault Obsidian       │
└────────────────┴──────────────────┴─────────────────────────┘
```

### Como o Codex deve se comportar neste projeto
- **Leia este arquivo** como ponto de entrada
- **Leia `AGORA.md`** para saber o que está sendo feito agora
- **Leia `MELHORIAS_PENDENTES.md`** para entender o que precisa ser corrigido
- **Leia `LOG_CONTINUO.md`** para ver o histórico recente
- **Nunca escreva código** — seu papel é ajudar a pensar, não implementar
- **Quando consultado**, diga qual arquivo do vault você leu para contextualizar sua resposta
- **Sugira antes de confirmar** — se uma decisão parece errada, questione antes de validar

### Como integrar o Codex ao Obsidian
O vault está em: `C:/Users/eli/Downloads/Documents/brain/`

**Opção 1 — Acesso direto (recomendado hoje)**
Compartilhe arquivos específicos do vault com o Codex quando fizer uma pergunta.
Arquivos prioritários:
- `AGORA.md` → estado atual
- `MELHORIAS_PENDENTES.md` → pendências
- `LOG_CONTINUO.md` → histórico
- `03_Arquitetura/bloco2-modulos-core.md` → arquitetura do bloco atual
- `04_Backlog/backlog.md` → prioridades

**Opção 2 — Export periódico**
Crie um script que exporta os arquivos chave do vault para um `context-dump.md` único.
O Codex carrega esse arquivo no início de cada sessão.

**Opção 3 — MCP Server (futuro)**
O Obsidian tem um plugin MCP que permite a Claude Code ler/escrever o vault diretamente.
Quando configurado, Claude pode atualizar `AGORA.md` e `LOG_CONTINUO.md` automaticamente após cada sessão.
Plugin: `obsidian-mcp-server` (instalar via Community Plugins no Obsidian).

---

## Estrutura de arquivos do projeto

```
saas-platform/
├── apps/
│   ├── api/                          ← NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             ← JWT, register, login
│   │   │   │   ├── organizations/    ← Orgs, settings, formToken
│   │   │   │   ├── users/            ← Membros, roles, convites
│   │   │   │   ├── leads/            ← CRM central
│   │   │   │   ├── pipeline/         ← Kanban, estágios
│   │   │   │   ├── workflows/        ← Automações por evento
│   │   │   │   ├── ai-actions/       ← LLM + AiExecution
│   │   │   │   ├── copilot/          ← Sugestões contextuais
│   │   │   │   ├── proposals/        ← Propostas comerciais
│   │   │   │   ├── analytics/        ← Métricas + AI insight
│   │   │   │   ├── audit-logs/       ← Audit + Activity logs
│   │   │   │   └── integrations/     ← Canais, webhooks, ingest
│   │   │   ├── common/               ← Guards, decorators, RBAC
│   │   │   ├── config/               ← configuration.ts, env validation
│   │   │   └── database/             ← PrismaService
│   │   └── prisma/
│   │       └── schema.prisma         ← 15+ models
│   └── app/                          ← Next.js frontend
│       ├── app/
│       │   ├── (auth)/               ← Login, register
│       │   ├── (app)/[slug]/         ← App autenticado por org
│       │   │   ├── dashboard/
│       │   │   ├── leads/
│       │   │   ├── pipeline/
│       │   │   ├── workflows/
│       │   │   ├── proposals/
│       │   │   ├── analytics/
│       │   │   └── settings/
│       │   │       ├── team/
│       │   │       ├── audit/
│       │   │       └── integrations/
│       │   └── p/[token]/            ← Proposta pública (sem auth)
│       ├── components/               ← UI components
│       ├── lib/
│       │   ├── api/                  ← API clients
│       │   ├── hooks/                ← TanStack Query hooks
│       │   └── rbac/                 ← Permissões no frontend
│       └── types/                    ← TypeScript domain types
└── packages/
    └── shared/                       ← Tipos e utils compartilhados
```

---

## Regras de decisão do projeto

1. **Segurança sempre vence prazo** — nenhum endpoint vai para produção com IDOR ou sem validação de tenant
2. **YAGNI rigoroso** — não construir para casos hipotéticos, só para o que está no backlog
3. **Módulos pequenos e focados** — arquivo > 300 linhas é candidato a split
4. **Multi-nicho via config, não via código** — nichos diferentes = templates diferentes, não módulos diferentes
5. **IA como ferramenta, não como produto** — IA serve o fluxo operacional, não é o produto em si
6. **Frontend burro, backend esperto** — lógica de negócio nunca fica no frontend
7. **Fire-and-forget para side effects** — audit, notificações e webhooks nunca bloqueiam a resposta principal

---

## Glossário

| Termo | Significado |
|-------|-------------|
| Org / Organização | Tenant — empresa que usa a plataforma |
| Lead | Contato/oportunidade de negócio |
| formToken | Token público da org para capturar leads via formulário externo |
| Ingest | Processo de captura de lead via formulário externo |
| AiExecution | Registro de uma chamada ao LLM (prompt, resposta, tokens, status) |
| WorkflowExecution | Registro de uma execução de workflow para um lead |
| assertSameTenant | Função que lança 404 se dois orgIds divergem |
| TenantContext | Objeto `{ userId, orgId, role, tokenId }` injetado por `@CurrentUser()` |
| channel | Canal de comunicação: `email`, `whatsapp`, `webhook` |
| signingSecret | Chave HMAC para assinar payloads de webhook |

---

*Este arquivo é atualizado ao fim de cada bloco de implementação.*
*Próxima atualização: após Fase 2 (Billing + Onboarding).*
