# Variáveis de produção — Nexora

> Configure essas variáveis no painel do seu provider (Railway / Render / Fly).
> O app valida tudo na inicialização — se algo crítico estiver faltando ou
> errado, o processo NÃO sobe (e o log diz exatamente o quê).

---

## Críticas (sem isso, não sobe)

| Variável | Como obter | Validação em produção |
|---|---|---|
| `NODE_ENV` | Setar `production` | Aciona todas as validações estritas abaixo |
| `DATABASE_URL` | Provider (Railway/Render) | URI válida; rodar migrations no primeiro deploy |
| `REDIS_URL` | Provider | URI válida |
| `JWT_SECRET` | `openssl rand -hex 32` (gera 64 chars) | ≥ 48 chars |
| `INTEGRATION_ENCRYPTION_KEY` | `openssl rand -hex 32` | 64 chars hex; **não pode** ser zeros |
| `LLM_PROVIDER` | `claude` (literal) | obrigatório `claude` em prod |
| `CLAUDE_API_KEY` | console.anthropic.com → API Keys | obrigatório quando LLM_PROVIDER=claude |
| `NEXORA_WEBHOOK_SECRET` | `openssl rand -hex 24` | ≥ 24 chars; configure no Z-API/Resend para enviar no header |

## Críticas pra billing (sem isso, trial vence e quebra)

| Variável | Como obter |
|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys → `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → Webhooks → criar endpoint → revelar signing secret `whsec_...` |
| `STRIPE_PRICE_STARTER` | Stripe → Products → criar "Nexora Starter R$97/mês" → copiar Price ID `price_...` |
| `STRIPE_PRICE_PRO` | Mesma coisa, R$197 |
| `STRIPE_PRICE_BUSINESS` | Mesma coisa, R$397 |

Configure o webhook do Stripe apontando para:
`https://api.<seu-domínio>/billing/webhook`

Eventos a escutar:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Importantes (sem isso, alguma feature degrada)

| Variável | Sem ela acontece o quê |
|---|---|
| `APP_URL` | URL do frontend usada em CORS + redirect do Stripe checkout. Default `localhost:3000` quebra em prod. |
| `ALLOWED_ORIGINS` | CSV de origens aceitas pelo CORS. Deve incluir a URL do app. |
| `RESEND_API_KEY` | Sem ela, o relatório semanal não dispara (silenciosamente). Email transacional também quebra. |
| `RESEND_FROM_EMAIL` | Remetente do email; precisa de domínio verificado no Resend. |
| `JWT_EXPIRES_IN` | Default `15m`. Reduza pra `5m` se quiser tokens mais curtos. |
| `REFRESH_TOKEN_TTL_DAYS` | Default 7. Tempo que o usuário fica logado sem revalidar senha. |

## Opcionais (não precisa configurar se não vai usar)

| Variável | Quando precisar |
|---|---|
| `ZAPI_INSTANCE_ID` / `ZAPI_TOKEN` / `ZAPI_CLIENT_TOKEN` | Só se você ainda for usar o modo automático Z-API. **Recomendação: deixe vazio.** O produto opera em modo manual por design. |

---

## Como gerar todos os secrets de uma vez

No terminal:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "INTEGRATION_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "NEXORA_WEBHOOK_SECRET=$(openssl rand -hex 24)"
```

Copie a saída direto pro painel do provider. Guarde uma cópia num gerenciador de senhas (1Password, Bitwarden). **Nunca commite.**

---

## Validação local antes de subir

Antes do deploy, rode:

```bash
cd apps/api
NODE_ENV=production \
  DATABASE_URL=postgresql://... \
  REDIS_URL=redis://... \
  JWT_SECRET=... \
  INTEGRATION_ENCRYPTION_KEY=... \
  LLM_PROVIDER=claude \
  CLAUDE_API_KEY=... \
  NEXORA_WEBHOOK_SECRET=... \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  pnpm.cmd start:prod
```

Se o app subir, o Joi aprovou tudo. Se cair com erro de validação, leia a mensagem — ela diz exatamente qual variável está faltando ou inválida.

---

## Checklist de smoke após primeiro deploy

1. `GET /healthz` → 200 com `status: ok`
2. `GET /readiness` → 200 com `checks.postgres: up` e `checks.redis: up`
3. `GET /api/v1/auth/me` sem token → 401 (proteção JWT funcionando)
4. `POST /api/v1/auth/register` com body válido → 201 + access_token
5. `GET https://app.<dominio>` → carrega landing page
6. Cadastrar conta de teste → fluxo wizard completo → import CSV → recovery manual

Se passar nos 6, o deploy está saudável.

---

## Sentinela: o que falha cedo (e o que falha tarde)

| Tipo de erro | Quando aparece |
|---|---|
| Var crítica faltando | Inicialização (processo não sobe) |
| `INTEGRATION_ENCRYPTION_KEY` de zeros | Inicialização |
| `LLM_PROVIDER=mock` em prod | Inicialização |
| Stripe webhook secret errado | Primeira chamada do Stripe (falha de assinatura) |
| Stripe price ID errado | Primeira tentativa de assinar |
| `NEXORA_WEBHOOK_SECRET` faltando no Z-API | Primeiro webhook (401) |
| Migration não rodada | Primeira query que toca coluna nova (500) |

**Erros que falham cedo são bons.** Erros que falham tarde te queimam na frente do cliente. Por isso o Joi é estrito em produção: vale mais o deploy falhar do que a primeira venda quebrar.
