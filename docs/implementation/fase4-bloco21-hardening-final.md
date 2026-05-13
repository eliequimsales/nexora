# Fase 4 — Bloco 21: Hardening Final

**Data:** 2026-04-25
**Status:** FECHADO

## Resultado dos checks

### F1 — Build de produção
| Comando | Resultado |
|---------|-----------|
| `pnpm --filter api build` | ✅ Exit 0 |
| `pnpm --filter app build` | ✅ Exit 0 — todas as rotas compiladas |

### F2 — Typecheck
| Comando | Resultado |
|---------|-----------|
| `pnpm --filter api typecheck` | ✅ Sem erros |
| `pnpm --filter app typecheck` | ✅ Sem erros |

### F3 — Segurança remanescente
| Check | Estado | Localização |
|-------|--------|-------------|
| `INTEGRATION_ENCRYPTION_KEY` fatal em produção | ✅ | `integration-crypto.service.ts:18-19` — `throw new Error(...)` se `nodeEnv === 'production'` |
| `@Throttle(5/min)` em `/auth/login` | ✅ | `auth.controller.ts:54` — `{ default: { ttl: 60_000, limit: 5 } }` |
| `@Throttle(5/min)` em `/auth/register` | ✅ | `auth.controller.ts:41` |
| `proposals:manage` — decisão registrada | ✅ | Ver `06_Decisoes/decisoes-tecnicas.md` — mantido como `member` no MVP |

**Decisão proposals:manage:** Permissão permanece mapeada para `member`. Não será criada `proposals:send` separada no MVP. Qualquer membro de vendas pode criar e enviar propostas; risco mitigado pelo audit log existente.

### F4 — Remoção de noise
| Item | Ação |
|------|------|
| `whatsapp.adapter.ts` — comentário TODO com código comentado | Limpo — stub mantido com log claro |
| `console.log` em `main.ts` | Mantido — mensagem operacional de startup, não debug |

### F5 — Verificação de segurança crítica
| Check | Estado | Localização |
|-------|--------|-------------|
| `GET /pipeline/board` — `take: 50` por estágio (C3) | ✅ | `pipeline.service.ts:20` |
| `POST /ingest/:formToken` — `@Throttle` (C4) | ✅ | `ingest.controller.ts:20` — `{ ttl: 60_000, limit: 10 }` |
| Analytics — LLM não recebe input do cliente (C6) | ✅ | `analytics.service.ts:generateAiSummary` — usa apenas dados internos |

### Testes finais
```
5 suites / 37 testes — todos passando
```

## Baseline da Fase 4

| Check | Estado |
|-------|--------|
| `api typecheck` | ✅ |
| `app typecheck` | ✅ |
| `api build` | ✅ |
| `app build` | ✅ |
| `api test --runInBand` (LLM_PROVIDER=mock) | ✅ 37/37 |

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/modules/integrations/adapters/whatsapp.adapter.ts` | TODO + código comentado removidos |
| `brain/06_Decisoes/decisoes-tecnicas.md` | Decisão `proposals:manage` registrada |
