# Colocar a Nexora no ar

Estado em 01/09/2026: **o código está pronto e nada está no ar.** O último
deploy é de 06/07/2026 e todos aparecem como `REMOVED` — o trial do Railway
expirou e derrubou os serviços. Os volumes sobreviveram (`postgres-volume`,
140 MB).

Execute nesta ordem. Cada etapa depende da anterior.

---

## 0. Antes de tudo: o que só uma pessoa pode fazer

Nada abaixo funciona sem estes dois, e nenhum deles é técnico.

### 0.1 Plano Hobby do Railway — US$ 5/mês

`railway up` responde *"Your trial has expired. Please select a plan to
continue"*. Só `recepcionista` e `Postgres` precisam rodar.

### 0.2 Identificação do fornecedor

Preencha `apps/recepcionista/lib/legal/identidade.ts`:

```ts
export const FORNECEDOR: Fornecedor = {
  nome: "",        // nome completo de quem presta o serviço
  documento: "",   // CPF, formatado
  endereco: "",    // endereço físico completo, com CEP
  email: "",       // e-mail de contato para o titular exercer direitos
  encarregado: "", // nome de quem responde por proteção de dados (art. 41)
};
```

**Isto não é papelada opcional.** O Decreto 7.962/2013, art. 2º exige nome,
CPF e endereço em destaque antes de qualquer cobrança, e
`/api/billing/checkout` **recusa abrir cobrança** enquanto qualquer campo
estiver em `[DEFINIR]` — devolve 503 e registra o motivo em ErrorLog. A trava
é proposital: sem ela, a primeira venda sairia com `[DEFINIR]` no lugar do nome
de quem cobrou, por escrito no e-mail de confirmação.

As páginas `/termos`, `/privacidade` e `/operador` mostram um aviso vermelho
enquanto isso durar.

---

## 1. Reativar o Railway

```bash
railway status                      # confirma projeto nexora / production
railway list                        # confirma os serviços
```

O Postgres nunca chegou a ser implantado nesta encarnação do projeto — o CLI
não consegue iniciar um banco gerenciado que nunca subiu (`railway redeploy
--service Postgres` responde *"No deployment found for service"*). Se ele não
subir sozinho depois da assinatura, crie pelo painel e reaponte
`DATABASE_URL`.

---

## 2. Variáveis que faltam

Já estão no serviço: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `CRON_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`,
`AI_PROVIDER`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WEBHOOK_TOKEN`,
`RAILWAY_DOCKERFILE_PATH`.

Faltam cinco, e sem elas a cobrança não existe:

```bash
railway variables --service recepcionista \
  --set STRIPE_SECRET_KEY=sk_live_... \
  --set STRIPE_WEBHOOK_SECRET=whsec_... \
  --set STRIPE_PRICE_PRO=price_1UAHmvQWkA652EBrPK4Wglek \
  --set RESEND_API_KEY=re_... \
  --set EMAIL_REMETENTE="Nexora <contato@SEU-DOMINIO>"
```

Opcional, mas recomendada:

```bash
# Chave da lista de supressão. Sem ela o HMAC do telefone cai para JWT_SECRET,
# que funciona — mas separar o segredo significa que trocar a chave de sessão
# não invalida a lista de quem pediu para nunca mais ser contatado.
railway variables --service recepcionista --set SUPRESSAO_SECRET="$(openssl rand -hex 32)"
```

Os valores de Stripe estão no dashboard: **Developers → API keys** (chave
secreta) e **Developers → Webhooks → `we_1UAIczQWkA652EBrWJDePt8T`** (signing
secret). O webhook já está criado, com 9 eventos e a versão de API
`2026-08-26.dahlia`, que é a mesma do código — não mexa nela sem mexer no
código junto: `current_period_end` mudou de lugar entre versões.

### O domínio do remetente

`EMAIL_REMETENTE` precisa de domínio verificado no Resend. `nexora.com.br` não
existe hoje, e a Política de Privacidade diz isso com todas as letras. Sem
domínio próprio o e-mail sai do domínio de testes do Resend e a confirmação da
assinatura chega com cara de fraude — justamente o e-mail que existe para dar
segurança ao consumidor.

---

## 3. Levar o schema para o banco

O schema mudou em 01/09/2026 e o projeto usa `db push`, não migrations:

```bash
cd apps/recepcionista
railway run pnpm db:push
```

O que entra: `RegistroImportacao`, `Supressao`,
`Company.confirmacaoEnviadaEm`, `Company.termosAceitosEm`,
`Company.termosVersao`, e `RecoveryEntry.customerId` passando a ser nulável.

**Confira essa última.** Ela é a diferença entre anonimizar e apagar o
Livro-Caixa quando um cliente pede exclusão. Se o `db push` reclamar de dado
existente, resolva antes de seguir — nunca com `--accept-data-loss`.

---

## 4. Subir

```bash
railway up --service recepcionista
railway logs --service recepcionista
```

---

## 5. Conferir no ar, nesta ordem

1. `/` carrega e o rodapé leva a `/termos`, `/privacidade` e `/operador`.
2. As três páginas jurídicas **não** mostram o aviso vermelho. Se mostrarem,
   a etapa 0.2 não foi concluída e a cobrança está travada.
3. Criar conta → o aceite é obrigatório e grava `termosAceitosEm`.
4. `/painel/clientes/importar` → **Baixar minha base em planilha** devolve um
   CSV que abre no Excel com acento correto.
5. Assinar com um cartão de teste → chega o e-mail de confirmação, com preço,
   data da próxima cobrança, o art. 49 e a identificação do fornecedor.
6. `stripe listen` ou o painel de webhooks: os 9 eventos entregam 200.

---

## 6. O que continua pendente depois do ar

### Gateway do WhatsApp

`EVOLUTION_API_URL` aponta hoje para `*.trycloudflare.com` — o túnel rápido e
gratuito da Cloudflare. Por ele passa a conversa dos clientes, com nome e
telefone. O endereço é público, o nome muda a cada execução e a outra ponta é
uma máquina pessoal.

`lib/whatsapp/endereco.ts` **recusa** esse endereço quando `NODE_ENV` é
`production`, e o Atendente vai falhar alto na primeira chamada. Isso é
proposital: é melhor o recurso não funcionar do que funcionar assim.

Para ligar o Atendente é preciso hospedar a Evolution API num serviço fixo —
o próprio Railway serve. Enquanto isso não acontecer, o produto principal
(Diagnóstico, Importação, Onda, Livro-Caixa) funciona inteiro sem ele, e sem
mandar nada dos clientes para fora do país.

### Verificação adversarial da auditoria

Duas das dez dimensões rodaram com agentes e produziram 35 achados; nenhum
passou pela verificação adversarial, porque os agentes verificadores morreram
no limite de sessão. Os achados usados foram conferidos à mão, um a um. As
outras oito dimensões foram auditadas manualmente em 01/09/2026 e o resultado
está no commit `8383a54`.
