# Bloco 12 — Workflows UI (W1/W2/W3/W4)

## Objetivo

Expor todas as capacidades do engine de workflows na UI do `CreateWorkflowModal` e adicionar guard de configuração de IA na página de workflows.

---

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `apps/app/types/domain/workflows.ts` | `ActionType` ganhou `ai_follow_up`; `ACTION_LABELS` atualizado |
| `apps/app/types/domain/organizations.ts` | `OrgSettings` ganhou `aiPrompts?: Record<string, string>` |
| `apps/app/components/modules/workflows/CreateWorkflowModal.tsx` | W1: opção ai_follow_up; W2: select de estágio para move_stage; W3: selects fromStageId/toStageId para lead_stage_changed |
| `apps/app/app/(app)/[slug]/workflows/page.tsx` | W4: banner amarelo se aiPrompts não configurados |

---

## W1 — ai_follow_up

- `ActionType` no frontend agora inclui `'ai_follow_up'` (já existia no backend em `ACTION_TYPES`).
- `ACTION_LABELS['ai_follow_up'] = 'Follow-up com IA'`.
- Zod schema do modal atualizado com o novo valor no enum de `actionType`.
- O engine já suporta execução — nenhuma mudança de backend necessária.

---

## W2 — move_stage com select de estágio

- Quando `actionType === 'move_stage'`, o modal renderiza um `<select>` populado com estágios do pipeline.
- Estágios carregados via `usePipelineBoard()` (hook já existente, `staleTime: 20_000`).
- Valor selecionado gravado em `actionConfig.targetStageId`.
- Fallback: lista vazia renderiza apenas a opção "Selecione um estágio".

---

## W3 — lead_stage_changed com fromStageId / toStageId

- Quando `triggerType === 'lead_stage_changed'`, o modal renderiza 2 selects opcionais dentro de um card:
  - **Estágio de origem** → `fromStageId` → `triggerConditions.fromStageId`
  - **Estágio de destino** → `toStageId` → `triggerConditions.toStageId`
- Ambos default para `""` (qualquer estágio) — campos opcionais.
- Valores só são incluídos em `triggerConditions` se selecionados (não vazios).
- Mesma fonte de dados: `usePipelineBoard()`.

---

## W4 — banner de aiPrompts ausentes

- `useOrgQuery()` carrega o `OrgResponse` completo com `settings`.
- Se `orgData?.settings?.aiPrompts` estiver ausente ou vazio (`Object.keys` = 0), banner amarelo é exibido no topo da página.
- Banner: ícone `AlertTriangle`, texto fixo, link "Configurar" → `/${org.slug}/settings`.
- Banner só aparece após `orgData` carregar (evita flash desnecessário).

---

## O que testar

- [ ] Select de ação inclui "Follow-up com IA"
- [ ] Criar workflow com `actionType='ai_follow_up'` → salva corretamente
- [ ] `actionType='move_stage'` → select de estágios aparece, seleção gravada em `actionConfig.targetStageId`
- [ ] `triggerType='lead_stage_changed'` → 2 selects de estágio aparecem
- [ ] Criar workflow com `fromStageId` e `toStageId` → gravados em `triggerConditions`
- [ ] Criar workflow com selects em branco → `triggerConditions` vazio (opcional)
- [ ] Org sem `aiPrompts` configurados → banner visível
- [ ] Org com `aiPrompts` configurados → banner não aparece
- [ ] CTA "Configurar" leva para settings da org
