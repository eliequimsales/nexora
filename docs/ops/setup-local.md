# Setup Local — B'reshit SaaS

Guia completo para rodar o projeto do zero em ambiente local.

## Pré-requisitos

| Ferramenta | Versão mínima | Como verificar |
|-----------|--------------|----------------|
| Node.js | 20.x | `node -v` |
| pnpm | 9.x | `pnpm -v` |
| Docker + Docker Compose | qualquer recente | `docker -v` |
| Git | qualquer recente | `git -v` |

## 1. Clonar e instalar dependências

```bash
git clone <repo-url> saas-platform
cd saas-platform
pnpm install
```

## 2. Subir infraestrutura (Postgres + Redis)

```bash
docker compose up -d postgres redis
```

Aguarde até os healthchecks passarem:

```bash
docker compose ps
# postgres: healthy
# redis: healthy
```

Opcional — pgAdmin (interface web para o banco):

```bash
docker compose --profile tools up -d pgadmin
# Acesse: http://localhost:5050
# Login: admin@saas.dev / admin
```

## 3. Configurar variáveis de ambiente

### API

```bash
cp apps/api/.env.example apps/api/.env
```

Edite `apps/api/.env` e preencha:

```
DATABASE_URL=postgresql://saas:saas_password@localhost:5432/saas_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=gere_um_valor_de_32_chars_aqui_agora
LLM_PROVIDER=mock   # use "claude" + CLAUDE_API_KEY para testar IA real
```

### App (Next.js)

```bash
cp apps/app/.env.example apps/app/.env.local
```

O padrão `NEXT_PUBLIC_API_URL=http://localhost:3001` já funciona sem edição.

## 4. Rodar as migrations do banco

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate dev --name fase4-gate
```

Depois aplique o SQL manual de indices parciais e constraints. Ele fica fora de `prisma/migrations` para nao ser tratado como uma migration Prisma.

```bash
cat apps/api/prisma/manual/add_partial_indexes_and_constraints.sql | docker exec -i saas_postgres psql -v ON_ERROR_STOP=1 -U saas -d saas_dev
```

PowerShell:

```powershell
Get-Content "apps/api/prisma/manual/add_partial_indexes_and_constraints.sql" | docker exec -i saas_postgres psql -v ON_ERROR_STOP=1 -U saas -d saas_dev
```

## 5. Iniciar os servidores

Abra dois terminais (ou use tmux):

```bash
# Terminal 1 — API (NestJS)
pnpm --filter api dev
# Roda em http://localhost:3001

# Terminal 2 — App (Next.js)
pnpm --filter app dev
# Roda em http://localhost:3000
```

## 6. Verificar que está funcionando

```bash
curl -i http://localhost:3001/api/v1/auth/me
# Esperado sem token: HTTP 401. Isso confirma que a API esta respondendo.

# Abra o browser em http://localhost:3000
```

## 7. Gates locais recomendados

```bash
LLM_PROVIDER=mock pnpm --filter api test --runInBand
pnpm --filter api typecheck
pnpm --filter app typecheck
```

## Comandos úteis

```bash
# Rodar testes da API
pnpm --filter api test

# Typecheck (ambos os apps)
pnpm --filter api typecheck
pnpm --filter app typecheck

# Abrir Prisma Studio (UI do banco)
pnpm --filter api exec prisma studio

# Ver logs do Docker
docker compose logs -f postgres
docker compose logs -f redis

# Parar tudo
docker compose down
```

## Geração de JWT_SECRET

```bash
# Linux/macOS
openssl rand -hex 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Troubleshooting

**`DATABASE_URL` inválida / conexão recusada**
- Confirme que o container postgres está rodando: `docker compose ps`
- Verifique se a porta 5432 não está em uso por outro Postgres local

**`REDIS_URL` conexão recusada**
- Confirme que o container redis está rodando: `docker compose ps`

**Prisma Client desatualizado**
```bash
pnpm --filter api exec prisma generate
```

**Porta 3000 ou 3001 em uso**
- Encerre o processo que ocupa a porta ou altere `PORT` no `.env`
