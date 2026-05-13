# Deploy Checklist — B'reshit SaaS

Checklist de produção. Marque cada item antes de publicar.

---

## Pré-deploy

### Variáveis de ambiente (API)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` aponta para banco de produção (SSL habilitado)
- [ ] `REDIS_URL` aponta para Redis de produção
- [ ] `JWT_SECRET` é um valor aleatório de 32+ chars (nunca o padrão)
- [ ] `APP_URL` aponta para o domínio real do frontend
- [ ] `ALLOWED_ORIGINS` contém apenas o domínio real (sem `localhost`)
- [ ] `LLM_PROVIDER=claude` e `CLAUDE_API_KEY` configurado
- [ ] `INTEGRATION_ENCRYPTION_KEY` é um hex de 64 chars gerado com `openssl rand -hex 32`
- [ ] Chaves Stripe de **produção** (não `sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` configurado e apontando para o webhook real

### Variáveis de ambiente (App)

- [ ] `NEXT_PUBLIC_API_URL` aponta para a URL pública da API (HTTPS)

### Banco de dados

- [ ] Prisma Client gerado no build/deploy: `pnpm --filter api exec prisma generate`
- [ ] Todas as migrations aplicadas: `prisma migrate deploy`
- [ ] SQL manual aplicado fora de transaction: `apps/api/prisma/manual/add_partial_indexes_and_constraints.sql`
- [ ] Backup do banco feito antes do deploy
- [ ] SSL habilitado na connection string (`?sslmode=require`)

### Build

- [ ] `pnpm --filter api build` passa sem erros
- [ ] `pnpm --filter app build` passa sem erros
- [ ] `pnpm --filter api typecheck` sem erros
- [ ] `pnpm --filter app typecheck` sem erros

### Testes

- [ ] `pnpm --filter api test` — todos passando
- [ ] Smoke test manual no ambiente de staging antes de ir para produção

---

## Infraestrutura

- [ ] PostgreSQL: backups automáticos habilitados
- [ ] Redis: persistência habilitada (AOF ou RDB) ou é aceitável perder filas em restart
- [ ] API: múltiplas instâncias atrás de load balancer (ou single se não for crítico)
- [ ] App: CDN ou serviço de borda configurado (Vercel, CloudFront, etc.)
- [ ] Domínios e certificados SSL configurados e válidos
- [ ] Health check configurado no load balancer. Observacao: endpoint dedicado `/health` ainda nao existe; criar endpoint simples antes de usar em producao real.

---

## Segurança

- [ ] `INTEGRATION_ENCRYPTION_KEY` diferente do default de zeros
- [ ] `JWT_SECRET` diferente do dev
- [ ] Não há `.env` real commitado no repositório
- [ ] CORS restrito ao domínio do frontend
- [ ] Rate limiting ativo (ThrottlerModule configurado — padrão: 100 req/min)
- [ ] Stripe webhook validando assinatura (não só recebendo)

---

## Stripe / Billing

- [ ] Produtos e preços criados no dashboard Stripe de produção
- [ ] `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` atualizados
- [ ] Webhook registrado no Stripe apontando para `https://api.dominio.com/billing/webhook`
- [ ] Evento `checkout.session.completed` habilitado no webhook
- [ ] Testado fluxo de checkout em staging com cartão de teste

---

## Pós-deploy

- [ ] Endpoint de health real validado em producao ou rota protegida responde de forma esperada
- [ ] Login e criação de organização funcionando
- [ ] Criar um lead de teste e verificar pipeline
- [ ] Verificar logs de erros nos primeiros 30 minutos
- [ ] Monitoramento/alertas configurados (Sentry, Datadog, ou equivalente)

---

## Rollback

Em caso de problema crítico:

```bash
# Reverter para imagem/versão anterior (adapter específico do deploy)
# Reverter migration se necessário:
pnpm --filter api exec prisma migrate resolve --rolled-back <migration_name>
```

Sempre ter o backup do banco feito antes do deploy para restauração de emergência.
