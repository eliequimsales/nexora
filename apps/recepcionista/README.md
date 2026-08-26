# Nexora Atendente

**O primeiro produto da plataforma Nexora.**

Um Atendente Digital que responde os clientes de qualquer empresa 24 horas por dia no WhatsApp: aprende com o cadastro feito no painel, responde dúvidas, captura oportunidades, faz retomada de conversas paradas e encaminha para a equipe humana quando necessário.

Princípios do produto:

- **Serve para qualquer empresa** — não existe especialização fixa por segmento. Todo o conhecimento do Atendente vem do cadastro da própria empresa (produtos, serviços, preços, horários, regras, tom de voz).
- **Nunca inventa** — o que não está no cadastro, ele não afirma; ele encaminha para a equipe.
- **Campanhas de marketing podem ser segmentadas por nicho no anúncio**, sem nenhuma alteração no software.
- Futuramente a plataforma Nexora terá outros produtos; hoje, o único produto é o Atendente.

## Stack

- **Next.js 14 (App Router)** — frontend + API routes no mesmo app
- **PostgreSQL + Prisma** — dados isolados por empresa (`companyId` em tudo)
- **Camada de IA multi-provedor** — Groq (padrão), OpenAI, Anthropic ou Ollama, via `AI_PROVIDER`
- **Evolution API v2** — integração WhatsApp via webhook
- **Auth** — JWT (jose) em cookie httpOnly + bcrypt

## IA do Atendente (custo por conversa)

A interface é única — `generateReceptionistReply(input)` em [`lib/ai/provider.ts`](./lib/ai/provider.ts) — e todos os provedores retornam o mesmo formato estruturado validado com zod (`resposta`, `transferir_humano`, `motivo_transferencia`, `nome_cliente`, `interesse`).

| `AI_PROVIDER` | Modelo padrão | Perfil |
|---|---|---|
| `groq` **(padrão)** | `llama-3.1-8b-instant` | Custo mínimo por conversa, resposta rápida — padrão do MVP comercial |
| `openai` | `gpt-4.1-nano` | Alternativa de baixo custo |
| `anthropic` | `claude-opus-4-8` | Opção premium (melhor qualidade, maior custo) |
| `ollama` | `llama3.1` | Local/auto-hospedado, custo zero por conversa |

Se o provedor falhar (chave inválida, fora do ar, resposta fora do formato), o comportamento é sempre o mesmo: erro registrado no `ErrorLog`, cliente recebe uma mensagem honesta de fallback e a conversa vai para **Aguardando sua equipe** — nunca fica no vácuo.

## Rodando localmente

```bash
# na raiz do monorepo
pnpm install

cd apps/recepcionista
cp .env.example .env        # preencha as variáveis (AI_PROVIDER=groq + GROQ_API_KEY)
pnpm db:push                # cria as tabelas no Postgres
pnpm dev                    # http://localhost:3002
```

Testes e checagens:

```bash
pnpm test        # vitest — regras puras (prompt, horários, handoff, webhook, follow-up, provider)
pnpm typecheck
pnpm build
```

## Demonstração (dados de exemplo)

Com o banco criado, popule uma empresa fictícia completa e neutra (serve para qualquer segmento):

```bash
pnpm db:seed
# Login: demo@nexora.app | Senha: demo12345
```

Cria a **Nexora Demonstração** com cadastro completo, 8 conversas em todos os status (Atendente respondendo, aguardando equipe, equipe atendendo, finalizada, com retomada já enviada), 3 oportunidades capturadas e mensagens distribuídas na última semana — os relatórios já aparecem preenchidos. Re-executável: apaga e recria a empresa demo.

### Roteiro de demonstração (5 minutos)

1. **Landing (30s)** — abra `/` e deixe a conversa do hero rodar: "é isso que ele faz, às 2h da manhã".
2. **Conversas (2min)** — entre com o login demo. Mostre o alerta âmbar de "aguardando sua equipe", abra a conversa do **Carlos** (cliente com problema pediu atendente → o Atendente encaminhou sozinho) e clique em **Assumir conversa**. Mostre a da **Fernanda** (condição especial → equipe respondendo com o Atendente pausado).
3. **Oportunidade (30s)** — abra a conversa do **Marcos**: cliente de madrugada virou oportunidade com nome, interesse e prazo.
4. **Meu Atendente (1min)** — mostre que tudo que ele fala vem dali: produtos, serviços, preços, horários, regras, tom de voz e as palavras que encaminham para a equipe.
5. **Relatórios (1min)** — conversas respondidas pelo Atendente, encaminhadas à equipe, oportunidades, principais dúvidas e o gráfico de horários (destaque as mensagens fora do expediente).

## Conectando o WhatsApp (Evolution API) — passo a passo

1. **Suba uma Evolution API v2** (Docker, VPS ou Railway) com `AUTHENTICATION_API_KEY` definida.
2. Defina **`EVOLUTION_API_URL`** no app (URL pública da Evolution).
3. Defina **`EVOLUTION_API_KEY`** (a mesma `AUTHENTICATION_API_KEY`).
4. Defina **`WEBHOOK_TOKEN`** e **`APP_URL`** (URL pública deste app).
5. No painel → **Meu Atendente → Conectar WhatsApp**, clique em **Criar conexão** —
   o app cria a instância `nexora-{companyId}` e configura o webhook sozinho
   (`{APP_URL}/api/webhook/whatsapp?token={WEBHOOK_TOKEN}`, eventos
   `MESSAGES_UPSERT`, `CONNECTION_UPDATE` e `QRCODE_UPDATED`).
6. **Escaneie o QR Code**: WhatsApp no celular > Dispositivos conectados >
   Conectar dispositivo. O status vira "Conectado" sozinho.
7. **Mande uma mensagem real** de outro celular para o número conectado.
8. **Valide no painel**: a conversa aparece em Conversas com a resposta do Atendente.

Detalhes: cada empresa tem sua própria instância (nome, status, QR atual, data de
conexão e último erro ficam no banco); o QR rotaciona sozinho via webhook; grupos e
mídia sem texto são ignorados; retries são deduplicados por `instância:idMensagem`.

## Fluxo principal

```
Cliente manda mensagem no WhatsApp
  → Evolution dispara o webhook (POST /api/webhook/whatsapp)
  → sistema identifica a empresa pela instância
  → salva a mensagem (dedupe por instância+id da mensagem)
  → se a equipe está atendendo: o Atendente fica em silêncio
  → se palavra-chave de encaminhamento: transfere direto (sem custo de IA)
  → senão: monta as instruções com o cadastro + histórico → provedor de IA responde
  → resposta enviada pelo WhatsApp e salva no banco
  → oportunidade (nome/interesse) e encaminhamentos registrados quando o Atendente sinalizar
```

## Retomada de conversas (follow-up)

Worker interno (via `instrumentation.ts`) roda a cada `FOLLOWUP_INTERVAL_MINUTES` e envia a mensagem configurada para conversas em que o cliente parou de responder, respeitando o limite por conversa. Também é possível disparar externamente:

```
POST /api/cron/follow-ups
x-cron-secret: <CRON_SECRET>
```

## Segurança e multiempresa

- Toda query filtra por `companyId` vindo do JWT — nunca de parâmetro do cliente.
- Webhook validado por token na URL + schema zod no payload; retries deduplicados.
- Senhas com bcrypt; cookie httpOnly/secure; rate limit em login/cadastro; segredos só via env.
- Erros gravados em `ErrorLog` (com contexto e empresa).

## Cobrança futura

`Company.plan` (`trial` | `pro` | `business`) já existe no schema — a estrutura para limitar recursos por plano e integrar um gateway de pagamento pluga aí, sem migração de dados.

## Deploy (Railway) — como está em produção

O serviço `recepcionista` (nome interno; o produto é Nexora Atendente) roda no projeto `nexora` do Railway, buildado pelo [`Dockerfile`](./Dockerfile) deste diretório (contexto = raiz do monorepo):

- Variável de serviço **`RAILWAY_DOCKERFILE_PATH=apps/recepcionista/Dockerfile`**
  (o `railway up` envia a raiz do repo, e o `railway.json` da raiz pertence à api —
  essa variável é o que aponta o build para o Dockerfile certo).
- Imagem `node:22-slim` **com `openssl` instalado** (sem ele o Prisma resolve o
  engine errado, `libssl 1.1`) e **pnpm fixado em 10.33** (o pnpm 11 ignora o
  `pnpm.onlyBuiltDependencies` do package.json e aborta o install do Prisma).
- Banco: database lógico `recepcionista` dentro da instância Postgres do projeto.
- Deploy manual: `railway up --service recepcionista --detach` na raiz do repo.
- Schema/seed: rodados da máquina local contra a `DATABASE_PUBLIC_URL` com o
  database trocado para `/recepcionista` (`pnpm db:push` e `pnpm db:seed`).

### Resultado do teste real em produção (2026-07-02)

URL: `https://recepcionista-production-2eea.up.railway.app`

| Verificação | Resultado |
|---|---|
| Landing | 200 ✅ |
| `/painel` sem sessão | 307 → login ✅ |
| Webhook sem token | 401 ✅ |
| Webhook com token (payload Evolution simulado) | 200, conversa criada ✅ |
| Webhook repetido (mesmo id) | deduplicado, sem mensagem dupla ✅ |
| Login demo + conversas + relatórios | 200, seed completo visível ✅ |
| Falha do provedor de IA (sem chave) | fallback honesto → "Aguardando sua equipe" + `ErrorLog` ✅ |
| Worker de retomada | ativo no boot (`[follow-up] worker ativo`) ✅ |

**Pendências para operação com WhatsApp real:** definir `GROQ_API_KEY` no serviço
(chave gratuita em console.groq.com); hospedar/conectar uma instância Evolution API
(o plano atual do Railway não permite provisionar mais serviços — requer upgrade ou
host externo); definir `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`; escanear o QR e
apontar o webhook.

### Checklist de produção

- [ ] `JWT_SECRET` longo e aleatório (`openssl rand -base64 48`) — nunca o do exemplo
- [ ] `WEBHOOK_TOKEN` e `CRON_SECRET` aleatórios
- [ ] `AI_PROVIDER` definido e a chave do provedor correspondente configurada
- [ ] Webhook configurado com `?token=` e evento `MESSAGES_UPSERT`
- [ ] Teste ponta a ponta: mensagem de um celular → resposta do Atendente → conversa no painel
- [ ] Conferir a tabela `ErrorLog` após o primeiro dia de uso

### Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Mensagem chega no WhatsApp e nada acontece | Webhook sem `?token=` correto (retorna 401) ou evento errado — precisa ser `MESSAGES_UPSERT` |
| `ErrorLog` com "Instância desconhecida" | O nome da instância na Evolution não bate com o campo em Meu Atendente → Conexão com o WhatsApp |
| Atendente não responde e conversa vai para "aguardando sua equipe" | Falha no provedor de IA (chave do `AI_PROVIDER` configurado, saldo ou rede) — detalhe em `ErrorLog`, contexto `ai-reply` |
| Resposta gerada mas não enviada | `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` inválidos — contexto `ai-reply` ou `human-reply` no `ErrorLog` |
| Retomada (follow-up) não dispara | `followUpEnabled` desligado, mensagem vazia, ou conversa não está com status "Atendente respondendo" |
