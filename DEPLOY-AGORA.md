# Subir o Nexora online em 15 minutos

> Versão mínima viável. Só pra ter um link funcionando que dev possa testar.
> Sem domínio próprio, sem Stripe real, sem chave Claude (IA fake mas funciona).

---

## Estágio 1 — Push pro GitHub (5 min)

### 1.1 Cria um repositório

Vai em https://github.com/new

- Nome: `nexora` (ou qualquer um)
- Privacy: **Private**
- Não marca "Add README" — vamos enviar o código que já existe
- Clica **Create repository**

GitHub vai mostrar comandos. Ignora — usa os meus abaixo.

### 1.2 Conecta o projeto local ao GitHub

Cola no terminal (substitui `SEU_USER` pelo seu usuário GitHub):

```bash
cd C:\Users\eli\Downloads\Documents\saas-platform
git remote add origin https://github.com/SEU_USER/nexora.git
git branch -M main
git push -u origin main
```

Quando pedir senha, **use Personal Access Token** (não a senha normal):
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- Marca `repo` (escopo)
- Copia o token e cola como senha

---

## Estágio 2 — Railway (10 min, 3 cliques)

### 2.1 Cria conta

Vai em https://railway.app → **Login with GitHub**.
Free trial: US$ 5 grátis, dá pra rodar uns 7 dias sem cartão.

### 2.2 Cria projeto novo do GitHub

1. Clica **+ New Project**
2. **Deploy from GitHub repo**
3. Autoriza Railway acessar seu GitHub
4. Seleciona o repo `nexora`

Railway vai detectar **2 Dockerfiles** (apps/api e apps/app) e perguntar qual usar.

### 2.3 Adiciona os 4 serviços

Você vai criar **4 serviços** no mesmo projeto Railway:

#### Serviço 1: Postgres (1 clique)
- Dentro do projeto → **+ New** → **Database** → **Add PostgreSQL**
- Pronto. Railway cria a `DATABASE_URL` automaticamente.

#### Serviço 2: Redis (1 clique)
- **+ New** → **Database** → **Add Redis**
- Cria `REDIS_URL` automaticamente.

#### Serviço 3: API (NestJS)
- **+ New** → **GitHub Repo** → escolhe `nexora` de novo
- Settings → **Root Directory**: deixa em branco
- Settings → **Build** → **Dockerfile Path**: `apps/api/Dockerfile`
- Settings → **Networking** → **Generate Domain** (pra ter URL pública)

**Cole essas Variables no painel desse serviço:**

```
NODE_ENV=development
PORT=3001
JWT_SECRET=cole-aqui-32-chars-aleatorios-qualquer-coisa-serve-pra-teste
INTEGRATION_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
LLM_PROVIDER=mock
ALLOWED_ORIGINS=https://[VAI-PREENCHER-DEPOIS]
APP_URL=https://[VAI-PREENCHER-DEPOIS]
```

E linka as databases (Railway tem botão "Add Reference"):
- `DATABASE_URL` → ref pra Postgres
- `REDIS_URL` → ref pra Redis

#### Serviço 4: App (Next.js)
- **+ New** → **GitHub Repo** → escolhe `nexora` (terceira vez)
- Settings → **Build** → **Dockerfile Path**: `apps/app/Dockerfile`
- Settings → **Networking** → **Generate Domain**

**Variables:**
```
NEXT_PUBLIC_API_URL=https://[URL-DA-API-DO-SERVIÇO-3]
```

(Pega o domínio gerado do Serviço 3 e cola aqui.)

### 2.4 Volta no Serviço 3 (API) e preenche os placeholders

Agora que você tem URLs do App e da API:
- `ALLOWED_ORIGINS` → cola URL do App
- `APP_URL` → cola URL do App

Clica **Deploy** em cada serviço.

---

## Estágio 3 — Smoke test (2 min)

Quando os 4 serviços ficarem verdes:

1. Pega a URL do **App** (algo tipo `nexora-app-production-xyz.up.railway.app`)
2. Abre no browser → tem que carregar a landing
3. Tenta criar conta em `/register?niche=barbearia`
4. Se cadastrar e cair no dashboard, **está funcionando**

Manda essa URL pro seu dev. **Você termina aqui.**

---

## Se der erro

| Erro | Solução |
|---|---|
| Build falha no Serviço API | Verifica se `DATABASE_URL` está linkada |
| App carrega mas cadastro dá erro de rede | Verifica `NEXT_PUBLIC_API_URL` no Serviço App + `ALLOWED_ORIGINS` no Serviço API |
| `prisma migrate deploy` falha | Roda manual: `railway run --service api npm run db:migrate` |
| Healthz responde 503 | Postgres/Redis ainda subindo, espera 1 min |

---

## Custo

- Postgres: ~US$ 1/mês
- Redis: ~US$ 1/mês
- API: ~US$ 5/mês (idle low)
- App: ~US$ 5/mês

Total: ~US$ 12/mês depois do trial. Cancela quando quiser.

---

## O que não vai funcionar nessa versão mínima

| Feature | Por quê |
|---|---|
| IA gerar mensagem com nome real | LLM_PROVIDER=mock — texto é genérico |
| Billing / trial Stripe | STRIPE_SECRET_KEY não setado |
| Email semanal | RESEND_API_KEY não setado |
| Webhook inbound de respostas | NEXORA_WEBHOOK_SECRET não setado (em dev mode aceita sem) |

Tudo isso liga depois trocando 4 env vars. Agora foca em **ter a URL viva**.
