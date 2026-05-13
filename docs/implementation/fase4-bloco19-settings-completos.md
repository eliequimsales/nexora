# Fase 4 - Bloco 19: Settings Completos

**Data:** 2026-04-25
**Status:** FECHADO

## O que foi feito

### S1 - SMTP
`ChannelCard` em `settings/integrations/page.tsx` ja cobria formulario, teste e enable/disable. Nenhuma alteracao estrutural foi necessaria.

### S2 - AI Prompts
`apps/app/app/(app)/[slug]/settings/ai/page.tsx` virou a surface clara para os prompts de IA:

- 3 textareas: `classify`, `respond`, `followUp`
- descricao curta abaixo de cada label
- banner de aviso quando algum campo esta vazio
- leitura de `org.aiPrompts`
- save via `PATCH /organizations/me` com `{ aiPrompts: { ... } }`

O contrato final ficou alinhado ao schema real:

- `UpdateOrgDto` aceita `aiPrompts` top-level
- `OrganizationsService` grava em `Organization.aiPrompts`
- `OrgResponseDto` expoe `aiPrompts` top-level

### S3 - Team management
**Frontend (`UsersList.tsx`):**
- `StatusToggle` ao lado de `RoleSelector`
- confirmacao antes de desativar
- `PATCH /users/:id { status }`
- exibicao de `createdAt` como data de entrada

**Frontend (`team/page.tsx`):**
- botao "Convidar" abre `InviteModal`
- modal com email + role
- sucesso mostra senha temporaria para compartilhamento manual
- CTA visivel apenas para admins

**Backend (`users.service.ts`):**
- `inviteUser` implementado
- cria usuario ativo com senha temporaria
- retorna `{ tempPassword }`
- registra `user.invited`

### S4 - Settings Layout
`apps/app/app/(app)/[slug]/settings/layout.tsx` organiza a navegacao lateral de settings com highlight do item ativo.

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `apps/app/app/(app)/[slug]/settings/layout.tsx` | Sidebar de navegacao |
| `apps/app/app/(app)/[slug]/settings/ai/page.tsx` | Formulario de AI prompts |
| `apps/app/app/(app)/[slug]/settings/team/page.tsx` | Invite modal e fluxo de convite |
| `apps/app/components/modules/users/UsersList.tsx` | Role, status e data de entrada |
| `apps/app/types/domain/organizations.ts` | `aiPrompts` top-level no contrato frontend |
| `apps/api/src/modules/organizations/dto/update-org.dto.ts` | `aiPrompts` top-level no DTO |
| `apps/api/src/modules/organizations/dto/org-response.dto.ts` | `aiPrompts` na resposta |
| `apps/api/src/modules/organizations/organizations.service.ts` | Persistencia de `aiPrompts` top-level |
| `apps/app/lib/api/users.api.ts` | `invite` retorna `{ tempPassword }` |
| `apps/api/src/modules/users/users.service.ts` | `inviteUser` implementado |
