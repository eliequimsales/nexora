# Bloco 6 — Email real + Notifications module

## Objetivo

Substituir o stub de email por SMTP real via Nodemailer e introduzir um módulo `notifications/` que centraliza envio transacional e in-app, desacoplando `ProposalsService` de canal e template.

---

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/api/package.json` | Adicionado `nodemailer` + `@types/nodemailer` |
| `apps/api/src/modules/integrations/adapters/email.adapter.ts` | Stub substituído por `nodemailer.createTransport` real |
| `apps/api/src/modules/integrations/channel.service.ts` | Adicionado `sendEmail()` estruturado; log de erro de canal; refactor de `logOutbound` para helper privado |
| `apps/api/src/modules/proposals/proposals.service.ts` | Removido `notifyLead()` inline; `ChannelService` e `ConfigService` removidos do constructor |
| `apps/api/src/modules/proposals/proposals.module.ts` | Removido `imports: [IntegrationsModule]` (não mais necessário) |
| `apps/api/src/app.module.ts` | `NotificationsModule` adicionado ao array de imports |

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/notifications/notifications.module.ts` | Módulo NestJS; importa `IntegrationsModule` e `AuditLogsModule` |
| `apps/api/src/modules/notifications/notifications.service.ts` | `sendTransactional`, `sendInApp`, `@OnEvent('proposal.sent')` |
| `apps/api/src/modules/notifications/templates/index.ts` | Resolver de templates com interpolação `{{var}}` |

---

## EmailAdapter

Substituído o stub por implementação real com Nodemailer.

```typescript
nodemailer.createTransport({
  host, port,
  secure: port === 465,
  auth: { user, pass: password },
})
```

### `send(config, to, { subject, text, html? })`
- `from = config.from ?? config.user`
- Envia via `transporter.sendMail()`

### `testConnection(config)`
- Chama `transporter.verify()`
- Retorna `{ ok: true }` ou `{ ok: false, error }` com mensagem amigável
- Mapeamento de erros SMTP conhecidos: auth inválida, host/porta inacessível, timeout, remetente inválido

---

## ChannelService

Adicionado método `sendEmail(orgId, to, { subject, text, html? })`:
- Busca config descriptografada por org
- Chama `EmailAdapter.send()` com o payload completo
- Loga sucesso em `integrationLog`
- Em falha: loga erro em `integrationLog` + relança a exceção

`sendMessage()` preservado sem alteração de assinatura (compatibilidade com WhatsApp).

---

## NotificationsService

### `sendTransactional(orgId, to, template, vars)`
1. Resolve template → `{ subject, text, html }`
2. Chama `channelService.sendEmail()`
3. Emite `notification.sent` com `{ orgId, channel: 'email', to, template }`
4. Registra audit `action: 'notification.sent'`

### `sendInApp(orgId, userId, type, payload)`
- Sem persistência (sem tabela de inbox neste bloco)
- Emite `notification.sent` com `{ orgId, channel: 'in_app', userId, type }`
- Registra audit

### `@OnEvent('proposal.sent')`
- Busca proposta + `lead.email` no banco
- Monta `link = ${appUrl}/p/${token}`
- Chama `sendTransactional(orgId, lead.email, 'proposal_sent', { leadName, proposalTitle, link })`
- Falha é `best-effort` — loga warning, não desfaz o envio da proposta

---

## Templates MVP

Arquivo: `notifications/templates/index.ts`

Interpolação por regex: `{{var}}` → valor de `vars[var]`.

| Template | Variáveis |
|---|---|
| `welcome` | `name`, `link` |
| `proposal_sent` | `leadName`, `proposalTitle`, `link` |
| `lead_assigned` | `userName`, `leadName` |
| `task_due_soon` | `userName`, `taskTitle`, `dueDate` |

Template desconhecido lança `Error("Template ... não encontrado")`.

---

## Desacoplamento de ProposalsService

Antes: `send()` chamava `notifyLead()` inline via `ChannelService` + `ConfigService`.
Depois: `send()` só emite `proposal.sent`. `NotificationsService` reage via `@OnEvent`.

Vantagem: proposta não carrega dependência de canal. Templates e audit centralizados em um módulo.

---

## Decisões de design

- **SMTP por org, não por env** — config via `IntegrationConfig` criptografada. Não há variáveis globais de SMTP.
- **`sendInApp` sem tabela** — interface funcional para uso futuro. Inbox UI entra em bloco posterior.
- **`user.invited` → `welcome`** — template pronto; handler será ligado quando fluxo de convite for implementado.
- **Falha SMTP logada em `integrationLog`** — observability operacional sem expor stack ou credenciais.

---

## O que testar

- [ ] `EmailAdapter.testConnection()` retorna `{ ok: false, error }` com credencial inválida
- [ ] `EmailAdapter.testConnection()` retorna `{ ok: true }` com SMTP válido (Mailtrap ou real)
- [ ] `resolveTemplate('proposal_sent', {...})` interpola `{{leadName}}` e `{{link}}` corretamente
- [ ] `resolveTemplate('unknown_template', {})` lança erro
- [ ] `sendTransactional()` emite `notification.sent` após envio
- [ ] `handleProposalSent()` não lança se `lead.email` for null (early return)
- [ ] `handleProposalSent()` chama `sendTransactional` com template `proposal_sent` e variáveis corretas
- [ ] `POST /integrations/configs/email/test` usa `transporter.verify()` real
- [ ] `sendMessage()` continua funcionando para WhatsApp (sem regressão)
