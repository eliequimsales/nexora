# Fase 4 - Bloco 20: UX de Producao

**Data:** 2026-04-25
**Status:** FECHADO

## O que foi feito

### U1 - EmptyState reutilizavel
Criado `apps/app/components/ui/EmptyState/EmptyState.tsx` com:

- `icon`
- `title`
- `description?`
- `action?`

Aplicacao final:

- `TasksList`
- `WorkflowsPage`
- `LeadsList`
- `KanbanBoard` quando ainda nao ha estagios

### U2 - Paginacao de leads
`LeadsList` ja tinha paginacao visual e backend com `page`, `limit` e `totalPages`.

- `useLeadsQuery` ganhou `placeholderData: keepPreviousData`
- loading/empty state da lista passaram a usar os componentes reutilizaveis

### U3 - ErrorBoundary
Criado `apps/app/components/shell/ErrorBoundary.tsx`:

- `getDerivedStateFromError`
- `componentDidCatch`
- fallback com CTA "Tentar novamente"

Aplicado em `app/(app)/[slug]/layout.tsx`.

### U4 - Paginas de erro do Next.js
`apps/app/app/not-found.tsx` e `apps/app/app/error.tsx` ja existiam e permaneceram corretos.

### U5 - Skeleton reutilizavel
Criado `apps/app/components/ui/Skeleton/Skeleton.tsx` com variantes:

- `line`
- `card`
- `table-row`

Aplicacao final:

- `TasksList`
- `WorkflowsPage`
- `LeadsList`
- `KanbanBoard`

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `apps/app/components/ui/Skeleton/` | Componente reutilizavel |
| `apps/app/components/ui/EmptyState/` | Componente reutilizavel |
| `apps/app/components/ui/index.ts` | Exporta `Skeleton` e `EmptyState` |
| `apps/app/components/shell/ErrorBoundary.tsx` | Error boundary global do slug |
| `apps/app/app/(app)/[slug]/layout.tsx` | Envolve `children` com `ErrorBoundary` |
| `apps/app/lib/hooks/leads/useLeadsQuery.ts` | `keepPreviousData` |
| `apps/app/components/modules/tasks/TasksList.tsx` | Skeleton + EmptyState |
| `apps/app/components/modules/leads/LeadsList.tsx` | Skeleton + EmptyState |
| `apps/app/components/modules/pipeline/KanbanBoard.tsx` | Skeleton + EmptyState |
| `apps/app/app/(app)/[slug]/workflows/page.tsx` | Skeleton + EmptyState + CTA para IA |

## Notas de arquitetura

- `LeadsList` manteve o estado de erro proprio, mas os estados de loading e vazio agora usam os componentes reutilizaveis do bloco.
- `KanbanColumn` continua com placeholder compacto para coluna vazia; o fix do bloco fecha o estado global de loading/empty da board.
- `ErrorBoundary` no layout captura erros em qualquer pagina do slug sem duplicacao por page.
