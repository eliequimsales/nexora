# Bloco 9 — Onboarding Wizard v2

## Objetivo

Substituir o checklist reativo de onboarding por um wizard guiado de primeira sessão que aplica template, configura a org e captura o primeiro lead em sequência, sem abandonar o usuário na interface vazia.

---

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/organizations/dto/update-onboarding.dto.ts` | DTO para PATCH /organizations/current/onboarding |
| `apps/app/lib/hooks/onboarding/useUpdateOnboarding.ts` | Mutation para `PATCH /organizations/current/onboarding`, invalida ORG_QUERY_KEY |
| `apps/app/lib/hooks/onboarding/useWizardState.ts` | Step local + persiste `wizardStep` via mutation; expõe `next`, `back`, `goTo`, `complete`, `dismiss` |
| `apps/app/components/modules/onboarding/WizardModal.tsx` | Modal com 6 steps + progress bar |
| `apps/app/components/modules/onboarding/WizardTrigger.tsx` | Client component: lê org + user, renderiza WizardModal se wizard não concluído |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/api/src/modules/organizations/organizations.service.ts` | `updateOnboarding()` adicionado — patch cirúrgico em `settings.onboarding` |
| `apps/api/src/modules/organizations/organizations.controller.ts` | `PATCH /organizations/current/onboarding` adicionado com guard `org:update` |
| `apps/app/types/domain/organizations.ts` | `OnboardingSettings` ganhou `wizardStep`, `wizardCompleted`, `wizardCompletedAt` |
| `apps/app/lib/api/organizations.api.ts` | `patchOnboarding()` adicionado |
| `apps/app/app/(app)/[slug]/layout.tsx` | `<WizardTrigger />` adicionado ao final do layout |

---

## Steps do Wizard

| # | Nome | Dismissível | Conteúdo |
|---|---|---|---|
| 1 | Bem-vindo | Não | Nome do usuário + org; botão "Começar" |
| 2 | Escolha o nicho | Sim (Pular) | `TemplateGrid` do Bloco 8; botão "Continuar" só habilita após template aplicado |
| 3 | Confirmar | Não | Preview de pipeline / automações / prompts configurados; badges de ✓ se aplicado |
| 4 | Persona da IA | Sim (Pular) | Form inline de nome/tom/estilo; submit salva e avança |
| 5 | Primeiro lead | Sim (Pular) | Form inline de nome/email/telefone; submit cria lead e avança |
| 6 | Concluído | — | CTA para Dashboard; fecha e grava `wizardCompleted = true` |

---

## Fluxo de estado

```
OrgLayout
  └── WizardTrigger (client)
        ├── org.settings.onboarding.wizardCompleted == true → não renderiza
        ├── org.settings.onboarding.dismissed == true → não renderiza
        └── senão → <WizardModal org user>

WizardModal
  └── useWizardState(org)
        ├── step (local state, iniciado com settings.onboarding.wizardStep ?? 1)
        ├── next() / back() / goTo(n) → setStep + PATCH /current/onboarding { wizardStep }
        ├── complete() → PATCH { wizardCompleted: true } + setStep(6)
        └── dismiss() → PATCH { dismissed: true }
```

---

## Endpoint backend

### `PATCH /organizations/current/onboarding`
- Guard: `@RequirePermission('org:update')` (admin)
- Body: `{ wizardStep?: 1-6, wizardCompleted?: boolean, dismissed?: boolean }`
- Comportamento: patch cirúrgico em `settings.onboarding` — merge com valores existentes, não substitui
- Se `wizardCompleted = true`: grava também `wizardCompletedAt = new Date().toISOString()`
- Retorna: `OrgResponseDto` completo

---

## Regra de trigger

| Condição | Wizard abre? |
|---|---|
| `settings.onboarding.wizardCompleted` == true | Não |
| `settings.onboarding.dismissed` == true | Não |
| Campo ausente (nova org) | Sim |
| `wizardStep` presente mas `wizardCompleted` ausente | Sim (retoma no step salvo) |

O wizard **não** fecha ao clicar fora (sem backdrop dismissível) — force a decisão: completar ou clicar "Configurar depois" no rodapé.

---

## Relação com OnboardingChecklist (Bloco 1)

O `OnboardingChecklist` continua existindo e aparece no dashboard/páginas internas após o wizard ser concluído ou dispensado. Os dois componentes são independentes:
- Wizard: primeira sessão, modal obrigatório, linear
- Checklist: pós-wizard, inline na tela, reativo ao estado real da org

---

## Decisões de design

- **Patch cirúrgico em `settings.onboarding`** — a mutation nunca envia o settings completo, só o subconjunto `onboarding`. Isso evita race condition com `PATCH /organizations/me` que também pode estar rodando em paralelo (ex: AssistantPersonaForm no Step 4 usa `useUpdateOrg` separado).
- **`useWizardState` com estado local** — o step local evita flickering de UI na navegação entre steps; o persist ao backend serve apenas para retomar em caso de refresh/close.
- **Step 2: "Continuar" desabilitado até template aplicado** — verificado via `org.settings.appliedTemplate`. O `TemplateCard` já tem seu próprio fluxo de apply (Bloco 8), então o wizard apenas aguarda o estado.
- **Step 4 embeda form inline** — `AssistantPersonaForm` do settings já é reutilizável, mas tem seu próprio botão "Salvar persona". Para o wizard criamos o form inline com `onNext()` acoplado ao submit, sem duplicar a lógica de validação.
- **Step 5: `CreateLeadInlineForm`** — `CreateLeadForm` existente tem modal + backdrop próprio, não é embedável. Step 5 usa form inline minimalista (nome/email/telefone) com o mesmo `useCreateLead` hook.
- **`WizardTrigger` como client component separado** — o layout `[slug]/layout.tsx` é server component. `WizardTrigger` isola o `useOrgQuery` e `useAuth` sem converter o layout inteiro para client.
- **Dismiss fecha o wizard sem marcar `wizardCompleted`** — o usuário pode reabrir implicitamente (se `dismissed` for limpo) ou via link futuro. Para MVP, dismissed = fecha definitivamente (mesmo comportamento do checklist).

---

## O que testar

- [ ] Nova org sem `settings.onboarding`: wizard abre automaticamente ao entrar em qualquer página do org
- [ ] `WizardTrigger` não renderiza se `wizardCompleted = true`
- [ ] `WizardTrigger` não renderiza se `dismissed = true`
- [ ] Step 1: "Começar" avança para step 2 e persiste `wizardStep: 2`
- [ ] Step 2: botão "Continuar" desabilitado se nenhum template aplicado
- [ ] Step 2: após aplicar template (TemplateCard), botão "Continuar" habilita
- [ ] Step 2: "Pular por agora" avança sem aplicar template
- [ ] Step 3: badges ✓ aparecem se template foi aplicado
- [ ] Step 4: submit salva persona e avança para step 5
- [ ] Step 4: "Pular" avança sem salvar
- [ ] Step 5: submit cria lead e avança para step 6
- [ ] Step 5: "Pular" avança sem criar lead
- [ ] Step 6: "Ir para o Dashboard" chama `complete()` e fecha o wizard
- [ ] Após completar: `settings.onboarding.wizardCompleted = true` e `wizardCompletedAt` presente
- [ ] Refresh na step 3: wizard reabre no step 3 (step persistido)
- [ ] `PATCH /organizations/current/onboarding` por member (403) e por admin (200)
- [ ] Backdrop não fecha o wizard ao clicar
- [ ] `OnboardingChecklist` ainda aparece no dashboard após wizard concluído
