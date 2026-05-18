# Checklist do Piloto Manual — Nexora

> Executar antes de abordar a primeira barbearia.
> Cada item deve ser testado manualmente, no fluxo real, em uma conta nova.

---

## Setup

Suba os serviços localmente:

```bash
docker compose up -d
pnpm.cmd --filter api dev   # http://localhost:3001
pnpm.cmd --filter app dev   # http://localhost:3000
```

Confirme que `LLM_PROVIDER=mock` está no `.env` do API. Para testar com Claude real,
configure `LLM_PROVIDER=anthropic` e `ANTHROPIC_API_KEY=sk-...`.

---

## Roteiro

### ☐ 1. Cadastrar conta nova

1. Abra http://localhost:3000
2. Clique em "Começar trial direto" (ou "Fazer diagnóstico" → preencher → CTA)
3. Preencha:
   - Nome: Barbearia do João (qualquer)
   - Email: novo@email.com (não pode existir)
   - Senha: 12345678 (mínimo 8)
   - Nome da empresa: Barbearia Teste
   - Segmento: **Barbearia** (importante — habilita modo Nexora)
4. **Tente submeter SEM marcar o checkbox de termos** → deve mostrar erro "Você precisa aceitar o termo de uso"
5. Marque o checkbox → submeter
6. Verifique: redirecionou para `/<slug>/dashboard`

**Esperado:**
- ✅ Conta criada
- ✅ Trial automático de 7 dias ativo (verificar em `/<slug>/settings/billing`)
- ✅ Wizard "Bem-vindo à Nexora" aparece full-screen — **não deixa fechar**

---

### ☐ 2. Wizard pós-cadastro força importação

No wizard, tente clicar fora do modal → não fecha.

**Passo 1 — Baixar planilha:**
1. Clique em "Baixar planilha modelo"
2. Verifique: download do arquivo `modelo-clientes-nexora.xlsx`
3. Abra no Excel/LibreOffice — deve ter colunas Nome, Telefone, Email, Última Visita + 2 linhas de exemplo

**Passo 2 — Importar:**
1. Clique em "Importar agora" → redireciona para `/<slug>/clientes/importar`
2. (Continua no roteiro 3)

---

### ☐ 3. Importar 10 clientes fictícios

Edite a planilha modelo e adicione 10 clientes com **datas variadas**:

| Nome | Telefone | Email | Última Visita |
|---|---|---|---|
| Cliente 1 | 21999990001 | — | 01/12/2024 (40+ dias atrás) |
| Cliente 2 | 21999990002 | — | 15/12/2024 |
| Cliente 3 | 21999990003 | c3@e.com | 20/11/2024 |
| Cliente 4 | 21999990004 | — | 10/01/2025 |
| Cliente 5 | 21999990005 | — | hoje (não vai aparecer como inativo) |
| Cliente 6 | 21999990006 | — | 25/12/2024 |
| Cliente 7 | 21999990007 | — | 05/12/2024 |
| Cliente 8 | 21999990008 | — | 10/12/2024 |
| Cliente 9 | 21999990009 | — | 15/01/2025 |
| Cliente 10 | 21999990010 | — | 20/01/2025 |

Salve como `.xlsx` e arraste para o dropzone.

**Verifique o preview:**
- ✅ Linhas totais: 10
- ✅ Vão ser criados: 10
- ✅ Duplicados: 0
- ✅ Inválidos: 0

Clique em "Importar 10 clientes".

**Esperado:**
- ✅ Tela de sucesso "10 clientes importados"
- ✅ Volta pro dashboard — wizard fechou automaticamente

---

### ☐ 4. Aceitar termo LGPD (banner)

1. Vá para `/<slug>/clientes`
2. Banner LGPD deve aparecer no topo
3. Tente clicar em "Recuperar João" sem aceitar o termo
4. Deve dar erro 403 "Aceite o termo LGPD"
5. Marque o checkbox + clique em "Aceitar e continuar"
6. Banner deve sumir
7. **Nota:** se você marcou o checkbox no `/register`, o backend já registrou o aceite automaticamente, e o banner nem aparece. Esse passo é para contas antigas.

---

### ☐ 5. Verificar lista de inativos

1. Em `/<slug>/clientes`, deve aparecer a lista
2. Clientes com `Última Visita` há 30+ dias devem estar lá
3. Clientes com data recente NÃO devem aparecer
4. Cabeçalho deve mostrar:
   - Total de inativos
   - Receita potencial (inativos × R$80)

---

### ☐ 6. Gerar mensagem manual e copiar

1. Clique em "Recuperar" em qualquer cliente
2. Modal abre com **toggle "Manual / Automático"** — default = Manual
3. Selecione canal (WhatsApp se tiver telefone, Email se só email)
4. Clique em "Gerar mensagem"
5. Verifique: mensagem da IA é exibida — deve **conter o nome do cliente**
6. Clique em "Copiar mensagem"
7. **Verifique feedback visual:** botão fica verde com "Copiado!" por 2s
8. Abra o WhatsApp (ou qualquer editor de texto) → cole → verifique que o texto é igual

---

### ☐ 7. Abrir WhatsApp Web direto

1. Ainda no modal, clique em "Abrir no WhatsApp Web"
2. Deve abrir `web.whatsapp.com` em nova aba, com o número + mensagem **pré-preenchida**
3. Confirme que o texto está completo

---

### ☐ 8. Marcar como enviado manualmente

1. Volte ao modal Nexora
2. Clique em "Já enviei pelo meu WhatsApp"
3. Verifique: aparece tela "Tudo certo! [Nome] foi tirado da lista de inativos"
4. Feche o modal
5. **Verifique:** o cliente sumiu da lista de inativos

---

### ☐ 9. Confirmar retorno do cliente

Simula que o cliente respondeu e voltou:

1. Vá para `/<slug>/nexora/responses`
2. Para um cliente que tenha sido marcado como respondido (ou simule via webhook):
   - `POST /api/v1/leads/webhooks/response` com `{ channel: 'whatsapp', from: '21999990001', message: 'Quero voltar!' }`
3. Volte para a página de respostas — cliente aparece como "Respondeu"
4. Clique em "Confirmar retorno"
5. Digite o valor real pago (ex: 50)
6. Clique em "Salvar"
7. **Verifique no dashboard:** "Receita recuperada" agora soma R$ 50

---

### ☐ 10. Testar opt-out

1. Simule resposta de opt-out:
   - `POST /api/v1/leads/webhooks/response` com `{ channel: 'whatsapp', from: '21999990002', message: 'PARAR' }`
2. Vá para `/<slug>/clientes`
3. Cliente 2 deve ter sumido da lista
4. Tente gerar mensagem pra ele direto pela API:
   - `POST /api/v1/leads/<id>/preview-recovery`
5. Deve retornar 400 "Cliente solicitou parar de receber mensagens (opt-out)"

---

### ☐ 11. Trial automático ativo

1. Vá para `/<slug>/settings/billing`
2. Deve mostrar:
   - Status: **Trial ativo**
   - Plano: Starter
   - Dias restantes: 7 (ou menos)
3. Limites configurados:
   - 100 leads/mês
   - 50 execuções de IA/mês
   - 2 usuários

---

### ☐ 12. Email semanal (opcional — só roda na segunda 8h)

Para testar manualmente:

```bash
# No console node do API:
const svc = app.get(NexoraReportService);
await svc.sendWeeklyReport('<orgId>');
```

**Esperado:**
- ✅ Sem `RESEND_API_KEY`: log "Resend not configured" + retorna false (não quebra)
- ✅ Com chave: email chega no email do admin com KPIs da semana

---

## Critério de "pronto pra abordar barbearia"

Todos os 12 itens checados sem bug crítico. Se algum item falhar:

- **Item 1-3 falha:** bloqueia onboarding — corrija antes
- **Item 4-8 falha:** bloqueia uso real — corrija antes
- **Item 9-12 falha:** funcionalidade auxiliar — pode rodar piloto sem, mas anote como tech debt

---

## Após validar o checklist

Não fique mais tempo no código. O próximo trabalho é comercial:

1. Lista de 10 barbearias próximas (Google Maps, Instagram)
2. Mensagem fria (WhatsApp): "Vi sua barbearia, tenho uma ferramenta que ajuda a trazer cliente antigo de volta. Topa testar grátis por 7 dias?"
3. Se 1 disser "topo": pegue a lista, importe, mande as primeiras 5 mensagens **pelo seu próprio WhatsApp** usando o modo manual
4. Se cliente voltar → confirma receita no app → toma decisão sobre cobrar
5. Se 0 dos 10 toparem em 1 semana → o problema não é o produto

A partir daqui, código só resolve depois da primeira validação real.
