# Fase 2 - Bloco 9 Contract

## Objetivo

Preparar o contrato tecnico do bloco 9 para substituir o checklist reativo atual por um wizard guiado de primeira sessao, sem quebrar o dashboard nem reabrir o escopo do bloco 8.

O bloco deve fechar:
- wizard modal obrigatorio na primeira sessao
- persistencia de progresso do wizard em `org.settings.onboarding`
- aplicacao guiada de template
- configuracao minima da assistente
- caminho controlado para criar o primeiro lead

Fora do escopo:
- refactor do checklist atual
- onboarding server-side complexo
- cadastro/registro novo
- persistencia propria para onboarding
- wizard multi-pagina
- reabrir Template System

## Auditoria do estado atual

### Ja existe no repositorio

Checklist atual:
- [useOnboardingProgress.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/onboarding/useOnboardingProgress.ts) monta um checklist reativo.
- [OnboardingChecklist.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/onboarding/OnboardingChecklist.tsx) renderiza esse checklist no dashboard e grava `settings.onboarding.dismissed = true` via `PATCH /organizations/me`.
- [dashboard/page.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/app/(app)/[slug]/dashboard/page.tsx) ja inclui o checklist como parte da tela.

Organizacao e settings:
- [organizations.controller.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/organizations.controller.ts) hoje expoe `GET /organizations/me`, `PATCH /organizations/me` e `POST /organizations/current/apply-template`.
- [organizations.service.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/organizations.service.ts) ja implementa `applyTemplate()`.
- [update-org.dto.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/dto/update-org.dto.ts) aceita `settings`, mas
- [org-settings.dto.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/dto/org-settings.dto.ts) ainda nao tem campos de onboarding alem do que ja esteja solto no JSON.
- [org-response.dto.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/api/src/modules/organizations/dto/org-response.dto.ts) retorna `settings` cru como `Record<string, unknown>`.

Frontend e auth:
- [app/(app)/[slug]/layout.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/app/(app)/[slug]/layout.tsx) e server component simples com `Sidebar`, `TopBar` e `children`.
- [useAuth.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/auth/useAuth.ts) ja fornece `user` e `org` do auth store.
- [useOrgQuery.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/org/useOrgQuery.ts) ja busca `GET /organizations/me`.
- [useUpdateOrg.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/org/useUpdateOrg.ts) ja persiste configuracoes gerais por `PATCH /organizations/me`.

Template System (bloco 8) parcialmente pronto:
- `templates` ja existem em shared/backend/frontend:
  - [packages/shared/src/templates](/C:/Users/eli/Downloads/Documents/saas-platform/packages/shared/src/templates)
  - [TemplateCard.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/templates/TemplateCard.tsx)
  - [TemplateGrid.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/templates/TemplateGrid.tsx)
  - [useTemplatesQuery.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/templates/useTemplatesQuery.ts)
  - [useApplyTemplate.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/lib/hooks/templates/useApplyTemplate.ts)
- Estado real importante: `TemplateCard` hoje aplica o template diretamente no clique. Isso nao serve para o wizard, que precisa separar:
  - Step 2 = escolher
  - Step 3 = preview + aplicar

Formularios reaproveitaveis:
- [AssistantPersonaForm.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/org/AssistantPersonaForm.tsx) ja existe, mas hoje contem seu proprio submit e CTA final.
- [CreateLeadForm.tsx](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/components/modules/leads/CreateLeadForm.tsx) ja existe, mas e um modal completo com backdrop e `onClose`.

### Ainda nao existe

- `WizardModal.tsx`
- `useWizardState.ts`
- `WizardGate` client para abrir o wizard dentro do layout server
- endpoint dedicado `PATCH /organizations/current/onboarding`
- tipos de onboarding wizard no frontend/backend

## Decisoes de contrato

### 1. O checklist continua, mas vira pos-wizard

Regra do bloco:
- o checklist atual continua existindo
- ele nao some do dashboard
- ele deixa de ser o onboarding primario

Contrato:
- `OnboardingChecklist` continua como mecanismo de acompanhamento posterior
- o wizard entra antes dele, como camada de ativacao inicial

### 2. Nao transformar o layout em client component

Estado real:
- `app/(app)/[slug]/layout.tsx` hoje e server component simples

Contrato:
- nao adicionar `'use client'` ao layout
- criar um componente client dedicado, por exemplo:
  - `components/modules/onboarding/WizardGate.tsx`

Fluxo:
- layout server continua renderizando shell
- `WizardGate` roda no client e decide abrir `WizardModal`

Motivo:
- menor churn
- menor risco de cascata no app shell

### 3. Persistencia do wizard em `org.settings.onboarding`

Campos canonicos novos:

```ts
onboarding?: {
  dismissed?: boolean;
  wizardStep?: number;
  wizardCompleted?: boolean;
  wizardCompletedAt?: string;
}
```

Contrato:
- `dismissed` continua existindo
- `wizardStep` guarda o step atual
- `wizardCompleted` controla abertura futura
- `wizardCompletedAt` registra timestamp de fechamento real

Observacao:
- o prompt nao pediu `skippedAt`; nao adicionar neste bloco

### 4. Endpoint dedicado de onboarding no backend

Adicionar:
- `PATCH /organizations/current/onboarding`

Payload:

```ts
{
  wizardStep?: number;
  wizardCompleted?: boolean;
  dismissed?: boolean;
}
```

Comportamento:
- atualiza apenas o subobjeto `settings.onboarding`
- se `wizardCompleted === true`, grava tambem `wizardCompletedAt = now()`
- nao sobrescreve outras partes de `settings`

Motivo para endpoint dedicado:
- `OrgSettingsDto` atual nao modela onboarding wizard
- isola validacao e evita alargar `PATCH /organizations/me` cedo demais

### 5. DTO proprio de onboarding

Criar no backend:
- `update-onboarding.dto.ts`

Validacoes minimas:
- `wizardStep` opcional, inteiro, faixa `1..6`
- `wizardCompleted` boolean opcional
- `dismissed` boolean opcional

### 6. `useWizardState` e fonte de dados correta

Contrato:
- `useWizardState.ts` deve ler:
  - `useOrgQuery()` para estado persistido da organizacao
  - `useAuth()` para `user.name`

Nao usar:
- `useOrg()` do auth store como fonte principal do wizard

Motivo:
- `AuthOrg` no store e resumido e nao contem `settings`
- o wizard depende de `settings.onboarding` e `settings.appliedTemplate`

### 7. Trigger de abertura

Regra de abertura:
- abrir se `!org.settings.onboarding?.wizardCompleted && !org.settings.onboarding?.dismissed`

Detalhe importante:
- `dismissed` aqui significa que o usuario completou ou pulou de forma valida no wizard
- nao reusar o comportamento atual de fechar o checklist sem passar pelo fluxo

Contrato pragmatica:
- o wizard pode oferecer `Pular por agora` apenas em steps permitidos
- ao pular, persistir `dismissed = true`
- o checklist continua depois como pos-wizard

### 8. Estrutura recomendada do frontend

Criar:
- `apps/app/components/modules/onboarding/WizardGate.tsx`
- `apps/app/components/modules/onboarding/WizardModal.tsx`
- `apps/app/lib/hooks/onboarding/useWizardState.ts`

Responsabilidades:
- `WizardGate`: decide se deve abrir o wizard
- `WizardModal`: renderiza UI e steps
- `useWizardState`: controla step atual, persistencia, selecao de template e transicoes

### 9. Steps do wizard

#### Step 1 - Bem-vindo
- mostrar `user.name` + `org.name`
- CTA principal: `Começar`

#### Step 2 - Escolher nicho/template
- usar grid de templates do bloco 8
- nesta etapa o usuario apenas seleciona
- nao aplicar ainda

Decisao estrutural:
- `TemplateGrid` e `TemplateCard` precisam ganhar modo `select`

Exemplo de contrato:
- `mode?: 'apply' | 'select'`

Motivo:
- no estado atual `TemplateCard` aplica diretamente
- isso conflita com o step 3

#### Step 3 - Preview + aplicar
- mostrar preview do template escolhido:
  - prompts
  - pipeline
  - workflows
- CTA: `Aplicar`

Contrato:
- aplicar template apenas aqui
- reaproveitar `useApplyTemplate()`
- apos sucesso, avancar step e invalidar org/pipeline/workflows

#### Step 4 - Configurar assistente
- reaproveitar `AssistantPersonaForm`

Decisao de contrato:
- evitar usar o form atual exatamente como esta, porque ele traz CTA final e submissao isolada
- extrair ou adaptar para modo embutido no wizard

Opcao recomendada:
- adicionar prop de modo, por exemplo:
  - `mode?: 'settings' | 'wizard'`
- em `wizard`, esconder texto/CTA de settings e devolver sucesso ao controller do wizard

#### Step 5 - Criar primeiro lead
- passo opcional

Estado real importante:
- `CreateLeadForm.tsx` e um modal completo

Contrato:
- nao abrir modal dentro de modal
- extrair o conteudo do form para componente reutilizavel embutivel

Opcao recomendada:
- criar componente base compartilhado, por exemplo:
  - `LeadFormFields` ou `CreateLeadInlineForm`

Fluxo permitido:
- `Criar lead agora`
- `Pular por agora`

#### Step 6 - Concluido
- resumo curto
- CTA para dashboard

Ao concluir:
- gravar `wizardCompleted = true`
- gravar `wizardCompletedAt = now()`
- opcionalmente gravar `dismissed = true`

### 10. Persistencia durante o fluxo

Contrato:
- persistir `wizardStep` a cada avancar de step
- nao depender apenas de estado local

Motivo:
- refresh ou navegacao nao pode perder progresso

### 11. Relacao com checklist atual

Estado atual:
- checklist usa `dismissed`
- checklist tambem inspeciona prompts/persona/primeiro lead

Contrato:
- manter `useOnboardingProgress()` como esta, com ajustes minimos se necessario
- depois do wizard:
  - se usuario completou tudo, checklist pode aparecer como concluido
  - se usuario pulou lead/persona, checklist continua servindo como pos-wizard

### 12. `OnboardingSettings` e tipos frontend

Atualizar:
- [apps/app/types/domain/organizations.ts](/C:/Users/eli/Downloads/Documents/saas-platform/apps/app/types/domain/organizations.ts)

Adicionar:
- `wizardStep?: number`
- `wizardCompleted?: boolean`
- `wizardCompletedAt?: string`

### 13. Backend service

Adicionar em `OrganizationsService`:
- metodo dedicado, por exemplo `updateOnboarding(ctx, dto)`

Responsabilidade:
- ler `settings` atual
- merge apenas do subobjeto `onboarding`
- aplicar timestamp quando concluir
- retornar `mapOrg(updated)`

### 14. Navegacao e CTA final

Contrato:
- ao terminar no step 6, fechar modal
- manter o usuario na rota atual se ele ja estiver no dashboard
- se estiver em outra rota interna, nao redirecionar automaticamente sem necessidade

Recomendacao:
- CTA explicito `Ir para dashboard`
- sem redirect automatico agressivo

## Arquivos que a Claude deve tocar

Frontend:
- `apps/app/app/(app)/[slug]/layout.tsx`
- `apps/app/app/(app)/[slug]/dashboard/page.tsx` apenas se algum encaixe minimo for necessario
- `apps/app/components/modules/onboarding/WizardGate.tsx`
- `apps/app/components/modules/onboarding/WizardModal.tsx`
- `apps/app/components/modules/onboarding/OnboardingChecklist.tsx` se precisar ajustar convivencia com wizard
- `apps/app/lib/hooks/onboarding/useWizardState.ts`
- `apps/app/types/domain/organizations.ts`
- `apps/app/lib/api/organizations.api.ts`
- `apps/app/lib/hooks/org/useUpdateOrg.ts` apenas se algum helper for reaproveitado
- `apps/app/components/modules/templates/TemplateCard.tsx`
- `apps/app/components/modules/templates/TemplateGrid.tsx`
- `apps/app/components/modules/org/AssistantPersonaForm.tsx`
- `apps/app/components/modules/leads/CreateLeadForm.tsx` ou extraido para componente base reutilizavel

Backend:
- `apps/api/src/modules/organizations/organizations.controller.ts`
- `apps/api/src/modules/organizations/organizations.service.ts`
- `apps/api/src/modules/organizations/dto/org-settings.dto.ts` se optar por alinhar o tipo tambem
- `apps/api/src/modules/organizations/dto/update-onboarding.dto.ts`

Documentacao:
- `docs/implementation/fase2-bloco9-onboarding-wizard.md`

## Riscos

- transformar o layout em client component geraria churn desnecessario
- reutilizar `TemplateCard` do jeito atual quebraria a separacao Step 2 / Step 3
- abrir `CreateLeadForm` modal dentro do wizard geraria modal-aninhado ruim
- usar auth store como fonte primaria do wizard falharia porque `AuthOrg` nao traz `settings`
- misturar wizard e checklist como duas fontes primarias causaria UX duplicada
- endpoint dedicado e melhor que ampliar `PATCH /organizations/me` sem contrato claro

## Sequencia minima recomendada para Claude

1. criar DTO e endpoint `PATCH /organizations/current/onboarding`
2. adicionar `updateOnboarding()` em `OrganizationsService`
3. expandir tipos de `OnboardingSettings` no frontend
4. criar `useWizardState.ts`
5. adaptar `TemplateCard/TemplateGrid` para modo selecao
6. adaptar `AssistantPersonaForm` para modo wizard
7. extrair variante inline de criacao de lead
8. criar `WizardModal.tsx`
9. criar `WizardGate.tsx`
10. inserir `WizardGate` no layout sem converter o layout inteiro para client
11. validar convivencia com o checklist pos-wizard

## Definition of Done deste contrato

O bloco 9 pode ser considerado fechado quando:
- existe wizard modal obrigatorio de primeira sessao
- o progresso fica persistido em `settings.onboarding`
- o wizard usa template selection no step 2 e apply no step 3
- a assistente pode ser configurada dentro do wizard
- o primeiro lead pode ser criado ou pulado sem modal aninhado
- o checklist atual continua existindo como pos-wizard
- o layout nao foi convertido desnecessariamente para client
