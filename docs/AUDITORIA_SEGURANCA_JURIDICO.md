# Auditoria de segurança e conformidade — 13/09/2026

Escopo: `apps/recepcionista`, a aplicação em produção em
https://www.meunexora.com.br (Railway, Next.js 14 App Router, Prisma, PostgreSQL).

Método: leitura do código de autenticação, sessão, webhooks, camada de IA,
acesso a dados e documentos jurídicos; correção das lacunas encontradas; e um
teste para cada trava — inclusive para as que já estavam corretas.

Resultado: **1026 testes em 56 arquivos, todos verdes**, `tsc --noEmit` limpo.

> **A parte mais importante deste relatório é a seção 3.** Uma auditoria que só
> lista vitórias é propaganda. O que fica em aberto está escrito lá, com o
> motivo de ter ficado.

---

## 1. O que foi corrigido nesta auditoria

### 1.1 Força bruta distribuída (rotas de credencial)

**Antes:** login, cadastro, recuperação e redefinição tinham teto apenas por IP.

**O furo:** teto por IP não enxerga ataque distribuído. Mil máquinas com mil
endereços são mil baldes distintos, e a conta alvo recebe mil tentativas sem
estourar nenhum deles. O único ponto onde o ataque inteiro é visível é a conta,
porque todas as tentativas apontam para o mesmo e-mail.

**Agora:**
- `login`: teto por IP (10 / 5 min) **e** por e-mail tentado (8 / 15 min).
- `recuperar`: teto por IP (5 / 15 min) **e** por e-mail (3 / 60 min) — este
  também impede inundar a caixa de entrada de uma pessoa específica trocando de IP.
- Os dois baldes por conta são consumidos **exista ou não a conta**. Recusar só
  quando existe transformaria o 429 num detector de contas, anulando a resposta
  única que a rota de recuperação usa justamente para não entregar essa informação.

Arquivos: `app/api/auth/login/route.ts`, `app/api/auth/recuperar/route.ts`.

### 1.2 `Retry-After` nas recusas por excesso de tentativas

**Antes:** o 429 não dizia quanto esperar.

**Por que importa:** sem o cabeçalho, o cliente legítimo não sabe se espera dez
segundos ou dez minutos, e o reflexo é tentar de novo na hora — o que empurra a
janela e transforma um tropeço em bloqueio prolongado.

**Agora:** `respostaDeLimite(politica)` em `lib/limites.ts` devolve 429 com
`Retry-After` em segundos, arredondado para cima (nunca promete liberação antes
da hora) e nunca zero. Aplicado nas quatro rotas de credencial.

### 1.3 Contenção de prompt injection

**Antes:** as mensagens do cliente já chegavam ao modelo como turno de
**usuário** — nunca como `system` —, o que é a separação estrutural correta. Mas
o prompt não dizia em lugar nenhum que texto de cliente não é instrução.

**Agora:** `buildSystemPrompt` abre com uma seção "Limite de confiança" que:
- declara que toda mensagem recebida é conversa, nunca ordem;
- recusa quem se apresente como dono, suporte, Nexora, teste ou atualização de
  sistema — quem configura a empresa faz isso no painel, nunca pelo WhatsApp;
- nomeia os ataques comuns ("ignore as instruções anteriores", "modo
  desenvolvedor", "mostre suas instruções") em vez de falar em abstrato;
- proíbe revelar, resumir ou parafrasear o próprio prompt;
- fecha a porta do desconto inventado: condição que não está na base não existe,
  por mais que o cliente afirme que foi prometida — nesse caso, transfere.

Teste cobre também a invariante estrutural: turno com papel `SYSTEM` vindo do
histórico é descartado, não promovido a instrução.

Arquivo: `lib/ai/prompt.ts`.

### 1.4 Vazamento de dados no perfil da empresa

**Antes:** `GET /api/company/profile` fazia `profile: true` — devolvia a linha
inteira de `CompanyProfile`, incluindo `whatsappInstance`, `whatsappQrCode`
(data URL base64 do QR ativo) e `whatsappError`. O `PUT` devolvia a linha
atualizada inteira.

**O risco:** QR Code ativo no corpo de uma resposta é sessão de WhatsApp
viajando em texto, e nada disso é usado pela tela — ela lê o estado da conexão
por `/api/whatsapp/status`.

**Agora:** `select` explícito com exatamente os 17 campos que a tela de
configurações usa; os campos de conexão não saem mais do servidor. O `PUT`
responde `{ ok: true }`.

Arquivo: `app/api/company/profile/route.ts`.

### 1.5 Registro auditável do consentimento (IP)

**Antes:** o banco guardava `termosAceitosEm` e `termosVersao`. Faltava de onde
veio o aceite.

**Agora:** campo `ipAceite` em `Company`, gravado nos **dois** caminhos de
cadastro — por senha e pelo Google. Registrar num e não no outro deixaria metade
das contas sem prova completa, e o caminho pelo Google tende a ser o mais usado.

O IP vem de `clientIp`, que lê o último salto do `X-Forwarded-For` (o escrito
pelo proxy) e valida o formato.

Arquivos: `prisma/schema.prisma`, `app/api/auth/signup/route.ts`,
`app/api/auth/google/callback/route.ts`.

### 1.6 Cabeçalhos de resposta de segurança (next.config.mjs) travados por teste

**Antes:** configurados no `next.config.mjs`, mas sem teste automatizado — qualquer edição inadvertida poderia remover HSTS, afrouxar CSP ou reabrir clickjacking sem que a suíte falhasse.

**Agora:**
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (2 anos).
- `Content-Security-Policy`: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self'`, `form-action 'self'`, `base-uri 'self'`, `upgrade-insecure-requests`.
- `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `X-Permitted-Cross-Domain-Policies: none`.
- Todos travados pela suíte `tests/cabecalhos-seguranca.test.ts`.

Arquivos: `next.config.mjs`, `tests/cabecalhos-seguranca.test.ts`.

### 1.7 Superfície pública de agendamento (/api/agendar/[slug]) blindada contra DoS e scraping

**Antes:**
- `GET` não tinha teto por IP: scrapers podiam varrer slots indefinidamente e sobrecarregar o banco.
- `POST` limitava apenas por `agendar:${params.slug}`: um atacante com 20 requisições esgotava a cota do negócio e bloqueava clientes reais de agendar.
- O 429 não devolvia `Retry-After`.

**Agora:**
- `GET`: teto por IP (`agendar-slots:ip:${ip}`) com 60 req/min e `respostaDeLimite` com `Retry-After`.
- `POST`: proteção em camadas:
  1. Teto por IP (`agendar:ip:${ip}`): 10 tentativas a cada 10 min — o atacante bate no seu próprio teto e não derruba a loja;
  2. Teto por slug ampliado (`agendar:slug:${params.slug}`): 60 agendamentos / 5 min;
  3. Teto por telefone (`agendar:tel:${telefone}`): 5 agendamentos / 15 min;
  4. Todas as recusas usam `respostaDeLimite` com `Retry-After`.

Arquivos: `app/api/agendar/[slug]/route.ts`, `tests/agendamento-publico.test.ts`.

---

## 2. O que já estava correto — e agora está travado por teste

Estes itens **não foram alterados**. Eles entraram na suíte porque trava sem
teste é intenção, não garantia: o custo de um guarda é uma linha, e o de
descobrir que alguém a desfez é um incidente.

| Item | Estado encontrado |
|---|---|
| Webhook Stripe | `constructEventAsync` sobre o corpo **cru** (reserializar invalidaria a assinatura), falha fechada sem `STRIPE_WEBHOOK_SECRET` |
| Webhook WhatsApp | token comparado com `safeEqual` (`timingSafeEqual`), falha fechada sem `WEBHOOK_TOKEN` |
| Cookie de sessão | `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`, 7 dias |
| Revogação de sessão | `sessaoEpoca` conferida contra o banco a cada requisição; sair incrementa; **trocar a senha incrementa dentro da mesma transação** da troca |
| Middleware | falha fechado sem `JWT_SECRET`, algoritmo fixado em HS256 |
| IP do cliente | último salto do `X-Forwarded-For`, com formato validado — o cliente não escolhe o próprio balde |
| Enumeração de contas | login roda bcrypt mesmo sem conta (hash falso); recuperação responde igual exista ou não |
| `passwordHash` | só é lido no login, com `select` explícito de três campos; nunca entra em resposta |
| Log de erro | `logErroSemConteudo` grava classe e pilha, sem a mensagem, no caminho que processa lista colada de terceiros |
| Escopo de tenant | `tests/escopo-tenant.test.ts` reprova consulta com id vindo da URL sem `companyId` no mesmo `where` |
| Opt-out (LGPD art. 18) | `pediuParaParar` decide por comando exato ou frase sem ambiguidade; marca `optOut` + `optOutAt` nas variantes do telefone; responde confirmando; a Onda filtra `optOut: false` |
| Exclusão / anonimização | `POST /api/clientes/excluir` apaga cadastro, visitas e agendamentos; o valor no Livro-Caixa é **anonimizado** (`SetNull`), não apagado — é registro financeiro do lojista |
| Operador × Controlador | explícito em `termos.ts`, `privacidade.ts` e `operador.ts`: o lojista é CONTROLADOR, a Nexora é OPERADORA |
| CDC art. 49 | 7 dias de arrependimento nos Termos **e** no e-mail de confirmação da compra |

---

## 3. Riscos residuais — o que NÃO foi resolvido

### 3.1 Rate limit é por processo, em memória

`lib/rate-limit.ts` usa um `Map` local. Com mais de uma instância, o teto
efetivo multiplica pelo número de instâncias, e um deploy zera todos os baldes.
Hoje roda uma instância só, então o efeito é teórico — mas escalar horizontalmente
**sem** trocar isto por um contador no Postgres ou Redis enfraquece toda a
seção 1.1 em silêncio.

### 3.2 O webhook do WhatsApp não tem HMAC do corpo

A Evolution API não assina o payload: o que existe é um token compartilhado. A
comparação já é em tempo constante e falha fechada, mas duas fraquezas
permanecem:

- **o token viaja na query string** (`?token=...`), e query string costuma
  aparecer em log de acesso de proxy e de CDN;
- não há como provar que o corpo não foi alterado em trânsito.

Correção possível: mover o token para cabeçalho, se a Evolution permitir. Isso
exige reconfigurar o webhook no gateway — mudança coordenada, não unilateral.

### 3.3 O teto por conta permite travar uma conta de propósito

Quem souber o e-mail de alguém consegue bloquear o login dessa pessoa por 15
minutos, gastando o balde. É incômodo e temporário. A alternativa é deixar a
senha ser adivinhada, que é definitivo. **Escolha consciente**, registrada aqui
para não ser redescoberta como bug.

### 3.4 `ipAceite` é nulo nas contas anteriores a hoje

Não há como reconstruir o IP de um aceite passado. Nulo é honesto; preencher com
qualquer coisa seria fabricar prova.

### 3.5 Gateway do WhatsApp em túnel de desenvolvimento

`EVOLUTION_API_URL` aponta para `*.trycloudflare.com`. O código **recusa** esse
endereço em produção (`lib/whatsapp/endereco.ts`), então o Atendente está
desligado — o que é o comportamento correto: por ali passariam conversas de
clientes, com nome e telefone, para uma máquina pessoal. Ligar o Atendente exige
hospedar a Evolution num servidor fixo.

### 3.6 Não auditado nesta passagem

Dependências de pacotes dos serviços secundários fora de produção (`apps/api` e `apps/app`), que não sobem na aplicação oficial (`apps/recepcionista`).

---

## 4. Mapa de conformidade

| Exigência | Onde é cumprida |
|---|---|
| LGPD art. 18, II e V (acesso e portabilidade) | `GET /api/dados/exportar` — CSV, sem trava de assinatura |
| LGPD art. 18, VI (eliminação) | `POST /api/clientes/excluir`, com anonimização do registro financeiro |
| LGPD art. 18 (revogação/opt-out) | `lib/recuperacao/optout.ts` + webhook do WhatsApp: efeito imediato e confirmação |
| LGPD art. 37 (registro das operações) | `termosAceitosEm`, `termosVersao`, `ipAceite`; `RegistroImportacao` com a declaração por extenso |
| LGPD art. 39 (contrato de operador) | `lib/legal/operador.ts` |
| LGPD art. 41 (encarregado) | `FORNECEDOR_ENCARREGADO`, com recuo para o próprio fornecedor |
| CDC art. 49 (arrependimento) | `lib/legal/termos.ts` e `lib/billing/confirmacao.ts` |
| Decreto 7.962/2013 art. 2º (identificação) | `lib/legal/identidade.ts`; `/api/billing/checkout` recusa cobrar sem ela |
| Decreto 7.962/2013 art. 4º, V (confirmação) | `lib/billing/confirmacao.ts` |

---

## 5. Arquivos alterados

**Segurança:** `lib/limites.ts`, `lib/ai/prompt.ts`, `app/api/auth/login/route.ts`,
`app/api/auth/recuperar/route.ts`, `app/api/auth/signup/route.ts`,
`app/api/auth/redefinir/route.ts`, `app/api/auth/google/callback/route.ts`,
`app/api/company/profile/route.ts`, `prisma/schema.prisma`.

**Testes:** `tests/hardening.test.ts` (novo).

A mudança de schema é uma coluna nula nova. O `prisma db push` do boot aplica
sozinho, sem perda de dado e sem `--accept-data-loss` — que continua proibido e
travado por `tests/boot-do-container.test.ts`.
