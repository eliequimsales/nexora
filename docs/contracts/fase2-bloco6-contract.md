# Fase 2 — Bloco 6 Contract

## Objetivo

Preparar o contrato tecnico do bloco 6 para substituir o stub de email por SMTP real e introduzir um modulo minimo de `Notifications`, sem frontend novo e sem reinventar o sistema de integracoes ja existente.

O bloco deve fechar:
- entrega real de email via SMTP
- `testChannel('email')` real
- modulo `notifications/` com envio transacional e placeholder de envio in-app
- reaproveitamento do evento `proposal.sent`

Fora do escopo:
- inbox/in-app UI
- tabela nova de notifications
- workers
- email inbound
- templates complexos ou editor de template

## Auditoria do estado atual

### Ja existe no repositório

Integracoes por organizacao:
- [integrations.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/integrations.service.ts) ja persiste `IntegrationConfig` criptografada por `orgId + channel`.
- o frontend ja possui formulario SMTP em [ChannelCard.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/integrations/ChannelCard.tsx) com campos:
  - `host`
  - `port`
  - `user`
  - `password`
  - `from`
- [integrations.controller.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/integrations.controller.ts) ja expoe `POST /integrations/configs/:channel/test`.

Adapter de email:
- [email.adapter.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/adapters/email.adapter.ts) existe, mas ainda e stub.

Canal unificado:
- [channel.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/integrations/channel.service.ts) ja faz roteamento `email | whatsapp`, grava `integrationLog` e usa config descriptografada.

Evento existente:
- [proposals.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/proposals/proposals.service.ts) ja emite `proposal.sent`.

Audit:
- [audit-log.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/audit-logs/audit-log.service.ts) ja permite registro fire-and-forget.

### Ainda nao existe

- `nodemailer` e `@types/nodemailer` nao estao em [apps/api/package.json](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/package.json)
- `src/modules/notifications/` nao existe
- nao existe template resolver para emails
- nao existe evento `notification.sent`
- `user.invited` ainda nao existe como evento real; `inviteUser()` continua stub em [users.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/users/users.service.ts)

## Preparação obrigatória

### Dependencias

Adicionar em `apps/api/package.json`:
- `nodemailer`
- `@types/nodemailer`

Depois:
- rodar `pnpm install`

Observacao:
- este bloco nao requer lib de template adicional
- o resolver de template pode ser local, com strings literais ou leitura simples de arquivos

### SMTP de teste

Estado real:
- nao ha SMTP em `.env`; o desenho atual usa `IntegrationConfig` por organizacao
- portanto, "confirmar SMTP test env" nao significa verificar segredo no repositório

Contrato operacional:
- precisa existir uma org de dev com canal `email` configurado via tela de Integracoes
- o teste pode usar:
  - Mailtrap
  - SMTP real do provedor do usuario
- isso deve ser validado pela rota existente `POST /integrations/configs/email/test`

Conclusao:
- disponibilidade de SMTP de teste e pre-requisito operacional externo, nao pre-requisito de codigo

## Decisoes de contrato

### 1. Nao mover SMTP para `.env`

O sistema ja foi desenhado para SMTP por org via `IntegrationConfig`.

Contrato:
- manter `host`, `port`, `user`, `password`, `from` como config criptografada por org
- nao introduzir variaveis globais de SMTP no `env`

### 2. EmailAdapter real

Arquivo:
- `apps/api/src/modules/integrations/adapters/email.adapter.ts`

Contrato:
- substituir stub por `nodemailer.createTransport`
- config do transport:
  - `host`
  - `port`
  - `secure: port === 465`
  - `auth: { user, pass: password }`

Assinatura recomendada do adapter:
- `send(config, to, subject, text, html?)`
- `testConnection(config)`

`testConnection`
- deve chamar `transporter.verify()`
- deve retornar:
  - `{ ok: true }`
  - `{ ok: false, error }` com mensagem amigavel

`send`
- deve chamar `sendMail({ from, to, subject, text, html? })`
- `from = config.from ?? config.user`

Tratamento de erro:
- capturar erros SMTP conhecidos do Nodemailer
- mapear para mensagens amigaveis, por exemplo:
  - autenticacao invalida
  - host/porta inacessivel
  - timeout de conexao
  - remetente invalido
- nao vazar stack nem detalhes sensiveis para a resposta publica

### 3. ChannelService precisa evoluir minimamente

Estado atual:
- `sendMessage()` aceita `content` string e `subject?`

Problema:
- `NotificationsService.sendTransactional()` precisa enviar `text` e, opcionalmente, `html`

Contrato minimo:
- evoluir `ChannelService` para aceitar no caminho `email` um payload mais rico, sem quebrar `whatsapp`

Opcao recomendada:
- manter `sendMessage()` para compatibilidade
- adicionar metodo novo e explicito, por exemplo:
  - `sendEmail(orgId, to, { subject, text, html? })`

Motivo:
- evita sobrecarregar `sendMessage()` com assinatura ambigua
- preserva compatibilidade com `whatsapp`
- deixa `NotificationsService` falar com uma API de email clara

### 4. NotificationsModule novo

Criar:
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`

Opcional mas recomendado se Claude preferir separar responsabilidade:
- `apps/api/src/modules/notifications/templates/*`

Registrar no:
- `apps/api/src/app.module.ts`

Dependencias do modulo:
- `ChannelService`
- `AuditLogService`
- `ConfigService`
- `PrismaService` apenas se precisar buscar usuarios ou org adicional

### 5. sendTransactional

Metodo exigido:
- `sendTransactional(orgId, to, template, vars)`

Templates MVP:
- `welcome`
- `proposal_sent`
- `lead_assigned`
- `task_due_soon`

Contrato do template resolver:
- sem lib nova obrigatoria
- aceitar uma destas abordagens:
  - strings literais com `{{var}}`
  - arquivos `.hbs` lidos localmente

Recomendacao pragmatica:
- strings literais ou arquivos simples em disco, sem engine pesada

Output do resolver:
- `subject`
- `text`
- `html?`

### 6. sendInApp

Metodo exigido:
- `sendInApp(orgId, userId, type, payload)`

Restricao importante:
- nao existe model de notification nem frontend de inbox

Contrato para este bloco:
- `sendInApp` nasce como interface de servico para uso futuro
- nao criar tabela nova agora
- comportamento minimo aceitavel:
  - validar `orgId` e `userId` se necessario
  - emitir `notification.sent`
  - registrar audit
  - opcionalmente registrar `ActivityLog` quando houver `leadId` no payload

Ou seja:
- neste bloco, `sendInApp` e contrato funcional minimo, nao sistema completo de inbox

### 7. Evento notification.sent

Prompt exige:
- emitir `notification.sent` para audit

Contrato:
- toda entrega bem-sucedida de `sendTransactional` e `sendInApp` deve emitir `notification.sent`

Payload minimo recomendado:
- `orgId`
- `channel` (`email` | `in_app`)
- `to` ou `userId`
- `template` ou `type`
- `resourceType?`
- `resourceId?`

Como amarrar com audit:
- `NotificationsService` deve emitir o evento
- o proprio modulo pode ter handler `@OnEvent('notification.sent')` ou registrar `AuditLogService.record()` diretamente

Recomendacao:
- fazer os dois papeis no proprio modulo de notifications, sem criar modulo novo de auditoria

Audit sugerido:
- `action: 'notification.sent'`
- `resourceType: 'notification'`
- `metadata` com `channel`, `template/type`, `target`

### 8. proposal.sent deve virar notificacao real

Estado atual:
- `ProposalsService.send()` emite `proposal.sent`
- depois chama `notifyLead()` inline com `ChannelService`

Problema:
- duplicacao de responsabilidade de notificacao fora de um modulo dedicado

Contrato recomendado:
- remover a logica de envio inline de `notifyLead()` de `ProposalsService`
- manter apenas o evento `proposal.sent`
- `NotificationsService` passa a reagir a `proposal.sent` via `@OnEvent('proposal.sent')`

Payload esperado no handler:
- buscar proposta + lead
- montar `link = ${appUrl}/p/${token}`
- chamar `sendTransactional(orgId, lead.email, 'proposal_sent', { link, leadName, proposalTitle? })`

Motivo:
- desacopla proposta de canal
- consolida templates e audit em um unico lugar

### 9. user.invited fica preparado, nao fechado

Estado atual:
- `inviteUser()` e stub
- nao existe `user.invited`

Contrato:
- nao implementar flow completo de convite neste bloco
- apenas deixar o template `welcome` e a superficie de `sendTransactional()` pronta
- documentar que `user.invited -> welcome` sera ligado quando o bloco de convite existir

### 10. Logging e erros

ChannelService hoje grava `integrationLog` em sucesso.

Contrato adicional para este bloco:
- em envio de email, gravar falha em `integrationLog` tambem quando possivel
- `NotificationsService` nao deve engolir erro silenciosamente
- para `proposal.sent`, falha de notificacao continua `best effort` e nao desfaz a proposta enviada

Mensagem de erro externa:
- amigavel
- sem stack
- sem credenciais

## Arquivos que a Claude deve tocar

Dependencias:
- `apps/api/package.json`
- lockfile gerado por `pnpm install`

Backend integracoes:
- `apps/api/src/modules/integrations/adapters/email.adapter.ts`
- `apps/api/src/modules/integrations/channel.service.ts`
- `apps/api/src/modules/integrations/integrations.module.ts` apenas se wiring mudar

Novo modulo:
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- opcionalmente diretório de templates simples:
  - `apps/api/src/modules/notifications/templates/*`

Wiring:
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/proposals/proposals.service.ts`
- `apps/api/src/modules/users/users.service.ts` apenas se Claude quiser deixar comentário/TODO alinhado ao novo módulo

Audit:
- `apps/api/src/modules/audit-logs/audit-log.service.ts` apenas se precisar helper novo, de preferência evitar

Documentacao:
- `docs/implementation/fase2-bloco6-email-notifications.md`

## Riscos

- tentar empurrar SMTP para `.env` quebraria o desenho multi-tenant atual
- acoplar `ProposalsService` diretamente a template/email reduz reutilizacao e duplica responsabilidade
- introduzir persistencia de inbox neste bloco inflaria escopo sem frontend correspondente
- usar apenas `sendMessage()` string para email dificulta `html` e templates limpos
- falha SMTP sem log de integracao enfraquece observability operacional
- nao e possivel "confirmar Mailtrap" pelo repo; isso depende de runtime config e teste real

## Sequencia minima recomendada para Claude

1. adicionar `nodemailer` e `@types/nodemailer`
2. rodar `pnpm install`
3. trocar `EmailAdapter` stub por adapter real
4. evoluir `ChannelService` para envio de email estruturado
5. criar `NotificationsModule` e `NotificationsService`
6. implementar resolver de templates MVP
7. ligar `proposal.sent` ao `NotificationsService`
8. emitir `notification.sent` + audit
9. documentar o bloco

## Definition of Done deste contrato

O bloco 6 pode ser considerado fechado quando:
- email SMTP real funciona via config por org
- `testChannel('email')` usa `transporter.verify()`
- existe `NotificationsService` com `sendTransactional()` e `sendInApp()`
- `proposal.sent` aciona `proposal_sent` via notifications
- `notification.sent` e emitido e auditado
- frontend de integracoes continua funcionando sem alteracao de superficie
