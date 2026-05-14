# Dev Setup — Nexora API

Execute nesta ordem exata. Cada etapa depende da anterior.

## Pré-requisitos

- Docker Desktop rodando
- Node.js 20+
- pnpm 9+

---

## 1. Subir infraestrutura

```bash
# Na raiz do monorepo
docker compose up -d
```

Aguarda postgres e redis ficarem healthy (5–10s).
Verifica: `docker compose ps` — ambos devem mostrar `healthy`.

---

## 2. Instalar dependências

```bash
# Na raiz (instala todos os workspaces, incluindo @anthropic-ai/sdk)
pnpm install
```

---

## 2.5. Configurar variáveis de ambiente

```bash
cd apps/api
cp .env.example .env
```

O `.env` padrão já aponta para os containers do docker-compose (`localhost:5432`, `localhost:6379`).
Para usar IA real, edite `LLM_PROVIDER=claude` e preencha `CLAUDE_API_KEY`.

---

## 3. Rodar migration inicial

```bash
cd apps/api

# Cria todas as tabelas a partir do schema.prisma atual
pnpm prisma migrate dev --name init
```

Resultado esperado: `Your database is now in sync with your schema.`

Se quiser inspecionar o banco depois:
```bash
pnpm prisma studio
# Abre em http://localhost:5555
```

---

## 4. Subir a API

```bash
# Ainda em apps/api
pnpm dev
```

Resultado esperado:
```
[Nest] LOG [NestApplication] Nest application successfully started
Listening on port 3001
```

---

## 5. Smoke test — Fluxo Workflow + AI Action

### 5a. Registrar uma org e obter token

```bash
curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{
    "name": "Admin Teste",
    "email": "admin@teste.com",
    "password": "senha12345",
    "orgName": "Imobiliária Teste",
    "niche": "real_estate"
  }' | jq '{slug: .organization.slug, token: .access_token}'
```

Guarda o `slug` e o `access_token` retornados.

### 5b. Criar um workflow de classificação

```bash
ACCESS_TOKEN="<token acima>"

curl -s -X POST http://localhost:3001/workflows \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classificar lead ao entrar",
    "triggerType": "lead_created",
    "triggerConditions": {},
    "actionType": "ai_classify",
    "actionConfig": {}
  }' | jq '{id: .id, name: .name, active: .isActive}'
```

### 5c. Injetar um lead via ingest (formToken)

```bash
# Pegar o formToken da org
FORM_TOKEN=$(curl -s http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.organization.formToken')

curl -s -X POST http://localhost:3001/ingest/$FORM_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "phone": "11999990000"
  }' | jq .
```

### 5d. Verificar que o workflow executou

```bash
# Listar workflows com stats do dia
curl -s http://localhost:3001/workflows \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.[0] | {name, executionsToday, successToday, failedToday}'
```

`executionsToday: 1, successToday: 1` = ciclo funcionando.

### 5e. Verificar classificação no lead

```bash
LEAD_ID=$(curl -s "http://localhost:3001/leads" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.data[0].id')

curl -s "http://localhost:3001/leads/$LEAD_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '{name, status, aiClassification, aiScore}'
```

Resultado esperado (mock): `"aiClassification": "warm", "aiScore": 55`

---

## Ativar IA real (opcional)

Edita `apps/api/.env`:
```
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
```

Reinicia a API. O mesmo smoke test passa — com classificação real do Claude.

---

## Comandos úteis

```bash
# Resetar banco (destrói tudo e recria)
pnpm prisma migrate reset

# Ver logs do postgres
docker compose logs postgres -f

# Parar tudo
docker compose down
```
