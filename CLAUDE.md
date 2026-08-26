# Nexora — repositório de código

> **Leia primeiro: [`THE_NEXORA_CONSTITUTION.md`](./THE_NEXORA_CONSTITUTION.md) — a lei suprema da empresa.**
> Em qualquer conflito (produto, engenharia, UX, roadmap), a Constituição vence.

## Antes de propor ou construir qualquer feature

Passe pelo **Conselho de Decisão** (7 perguntas) da Constituição. Se uma resposta for "não", a feature de produto não entra (exceto trabalho habilitador que serve algo que passa).

Lembretes que mais erram:
- **Regra Zero:** toda tela termina em decisão + ação, nunca em informação pura.
- **Dinheiro antes de vaidade:** R$ primeiro, RRI pequeno. Sem "dashboards" — fila de prioridades.
- **Engine Universal:** o núcleo nunca conhece setores; só sinais normalizados. RFM é só o 1º Signal Provider.
- **Verdade acima de marketing:** confiança baixa → o sistema admite.
- **North Star:** Receita Recuperada incremental e comprovada (holdout) — não MRR/ARR/usuários.

## Memória e decisões

Este repo é o código. A memória de produto, arquitetura, estratégia e decisões vive no vault Obsidian em `../brain/`:
- Missão da IA: `../brain/00_Visao/missao-ia-recuperacao.md`
- Arquitetura (Revenue Engine, Signal Providers, RRI): `../brain/03_Arquitetura/revenue-engine.md`
- Estratégia de escala: `../brain/00_Visao/estrategia-empresa-bilhao.md`
- Decisões técnicas: `../brain/06_Decisoes/decisoes-tecnicas.md`
- Specs: `docs/specs/`

## Stack

pnpm monorepo: `apps/api` (NestJS), `apps/app` (Next.js), `packages/shared`. Deploy no Railway. O MVP atual está especificado em `docs/specs/2026-06-28-mvp-revenue-opportunity-assessment.md`.

## Segurança (inegociável)

Nunca ler/imprimir `.env` nem expor segredos. Validar e sanitizar toda entrada (incl. CSV/integrações). Proteger endpoints sensíveis.
