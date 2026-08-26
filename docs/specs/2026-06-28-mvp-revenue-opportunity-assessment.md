# Spec — MVP: Revenue Opportunity Assessment (Nexora)

> **Conceito interno (expansível):** Revenue Opportunity Assessment (ROA).
> **Nome ao cliente (PT, dinheiro na frente):** a definir pelo fundador — recomendação: liderar com o número, não com "Assessment/Diagnóstico". Ex.: "Sua Receita Parada" / "Mapa de Receita Recuperável".
> **Status:** Spec aprovada para implementação (fundador disse "Vai" em 2026-06-28).
> **Governa:** `brain/CLAUDE.md` (Regra Suprema, Regra Zero, Guardrails 1–8), `brain/03_Arquitetura/revenue-engine.md`.
> **Estrutura:** Working Backwards (começa pelo resultado para o cliente, depois a tecnologia).

---

## 1. Objetivo de negócio

Qual decisão lucrativa o usuário consegue tomar ao final?

> Ao terminar o ROA, o dono do negócio sabe **exatamente qual é a próxima ação que gera mais lucro** (com valor em R$ e confiança) e **executa a primeira com um clique**.

Não é "ele recebeu um relatório". É "ele decidiu e agiu". (Regra Zero.)

**Objetivo de negócio da Nexora:** provar que **pessoas pagam** para resolver isso → 10 e-commerces pagando por uma recuperação real. Não é provar que o algoritmo funciona.

## 2. Transformação esperada

| Antes | Depois |
|---|---|
| "Não sei onde estou perdendo dinheiro." | "Sei exatamente qual a próxima ação mais lucrativa — e já comecei." |

Toda tela termina em **decisão + ação**. Quando a confiança for baixa por falta de dados, a ação é *a ação que aumenta a confiança* ("conecte sua loja para eu ver os outros 80%") — nunca informação pura.

## 3. Entrada de dados — Signal Provider + schema canônico + CSV

**Arquitetura (Guardrail 8):** o Revenue Engine é vertical-agnóstico. Toda lógica de fonte/setor vive num **Signal Provider**. O MVP entrega **um** provider: CSV. RFM é o primeiro *modelo de sinal*, não a regra universal.

### Schema canônico (versionado — `schemaVersion: 1`)

```ts
// O Engine SÓ conhece este shape. Nenhum campo específico de e-commerce/setor aqui.
interface CanonicalCustomer {
  externalId: string;          // id do cliente na fonte
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  purchases: CanonicalPurchase[];
  // sinais opcionais (provider preenche quando tem); ausência ≠ erro
  signals?: {
    abandonedCarts?: number;
    channel?: string;
  };
}
interface CanonicalPurchase { at: Date; amountCents: number; }

interface AssessmentInput {
  schemaVersion: 1;
  orgId: string;
  currency: 'BRL';
  annualRevenueCents?: number;  // p/ RRI executivo; se ausente, soma das compras 12m
  customers: CanonicalCustomer[];
  marginPctDefault: number;     // default por nicho; conservador
}
```

### Signal Provider — contrato

```ts
interface SignalProvider {
  readonly id: string;                 // 'csv' | 'shopify' | ...
  parse(raw: unknown): Promise<AssessmentInput>;   // normaliza p/ schema canônico
  validate(input: AssessmentInput): ValidationReport; // honestidade: dado sujo → confiança baixa
}
```

**CsvSignalProvider (MVP):** aceita CSV com colunas mínimas `customer_id, last_purchase_date, total_amount, n_purchases` (ou linhas de compra). Faz validação/normalização honesta:
- linhas inválidas viram `warnings`, não quebram o assessment;
- cobertura de dados baixa → reduz a confiança (não inventa número).

**Non-goal do MVP:** Shopify/Stripe providers (ano 1), execução real de mensagens, ML treinado.

## 4. Revenue Engine — núcleo matemático universal

Fórmula única (vertical-agnóstica):

```
ReceitaRecuperável_cliente (R$) = P_retorno × ValorFuturo − CustoRecuperação
```

No MVP, o **CsvSignalProvider usa o modelo RFM** para produzir `P_retorno` e `ValorFuturo` normalizados:

```
R = dias desde lastPurchaseAt
F = nº de compras
M = ticket médio = total / F

inativo se R > limiarNicho (default 60d)

P_retorno  = base(F) × decaimento(R)
  base(F)        = 1 − 1/(1+F)        // F=1→0,50 · F=3→0,75 · F=6→0,86
  decaimento(R)  = e^(−R/τ)            // τ = meia-vida por nicho (default 60d)

ValorFuturo = M × freqEsperada12m × margemPct
  freqEsperada12m = F anualizada (com teto)

CustoRecuperação = custo do canal (default pequeno) + descontoEsperado (default 0 no MVP)
```

**Confiança (2 camadas — forte na promessa, honesto na engenharia):**
- camada de venda: faixa forte (varia τ e margem em limites plausíveis → min/max);
- camada técnica: `confidencePct` = f(volume de clientes, completude de colunas, histórico). Piso de dados: abaixo do mínimo, retorna "estimativa preliminar", não número.

## 5. Decision Engine — ordenar por impacto financeiro

- Calcula `ReceitaRecuperável` por cliente; soma = **receita recuperável total** (R$).
- **RRI operacional** (0–100) = percentil da `ReceitaRecuperável` na base → ordena a fila (uso interno).
- **RRI executivo** (%) = receita recuperável total ÷ `annualRevenueCents`.
- **3 causas auditáveis** (Guardrail 5): segmenta a receita recuperável por motivo computável do CSV — ex.: *recorrentes que pararam · inativos de alto valor · baixo valor disperso*. Cada causa mostra o R$ que representa.
- Seleciona **Top 3 oportunidades** por R$ (não por score).

## 6. Ações — no máximo três, cada uma um botão (Regra Zero)

Cada oportunidade termina num botão (Recommendation = 1% do Engine 3; Execution = stub manual/semiassistido):
- "Cliente X · prob. retorno 91% · recuperável R$ 4.200 → **[Gerar mensagem]**"
- ações alternativas conforme dado: **[Criar campanha de recompra]**, **[Exportar lista priorizada]**.

UI **money-first, sem "dashboard"**, baseada em prioridades:
```
Hoje
  Recupere R$ 58.000   → Executar
Próxima prioridade
  Recupere R$ 33.000   → Executar
```
RRI aparece pequeno. O número grande é sempre dinheiro.

## 7. Resultado esperado

Saída do assessment:
- Receita recuperável total (R$) + faixa + `confidencePct`;
- RRI executivo (%) e RRI operacional por cliente (interno);
- 3 causas com R$;
- Top 3 ações clicáveis;
- horizonte estimado ("recuperável realista nos próximos 90 dias: R$ X").

**Time to Value alvo < 10 min** (Guardrail 6): upload CSV → resultado em segundos, zero setup.

## 8. Learning — retroalimentação desde o dia 1

Engine 5 é **conceito** no MVP, mas a **captura começa agora**: todo desfecho de ação (gerou mensagem? cliente voltou? quanto recuperou?) é registrado (reusar `AssisteFinanceiroRecoveryAction.customerReturned` / `revenueRecovered`). Sem treino ainda — só coleta para calibrar `P_retorno` depois.

---

## Arquivos a criar / alterar (`apps/api` + `apps/app`)

**Backend — `apps/api/src/modules/assistente-financeiro`:**
- Criar `signal-providers/signal-provider.interface.ts` (contrato + schema canônico v1).
- Criar `signal-providers/csv.signal-provider.ts` (parse + validação honesta).
- Criar `revenue-engine/revenue-engine.service.ts` (fórmula de valor esperado + confiança).
- Criar `revenue-engine/rfm.model.ts` (P_retorno/ValorFuturo via RFM — usado pelo CSV provider).
- Criar `revenue-engine/decision.service.ts` (RRI op/exec, 3 causas, Top 3).
- Criar `assessment/assessment.controller.ts` → `POST /api/v1/assessment` (upload CSV → AssessmentResult).
- Criar `assessment/dtos/*` (input/result, validados com class-validator — sanitizar entrada, Regra de segurança).

**Frontend — `apps/app`:**
- Tela de upload (CSV) + tela de resultado money-first baseada em prioridades (sem "dashboard").

## O que testar (TDD — escrever teste falhando primeiro)

- `rfm.model`: P_retorno e ValorFuturo (casos felizes + bordas: F=0, R enorme, M=0).
- `revenue-engine.service`: fórmula de valor esperado; faixa de confiança; **piso de dados** (retorna "preliminar").
- `csv.signal-provider`: parse válido; linhas sujas viram warnings (não quebram); cobertura baixa → confiança baixa.
- `decision.service`: ordenação por R$ (não por score); RRI executivo = recuperável ÷ receita anual; soma das 3 causas = total.
- `assessment.controller` (e2e): CSV válido → 200 com result; CSV inválido → 400 sanitizado.
- Regra crítica de negócio coberta: **a fila ordena por dinheiro, não por churn** (cliente churn-alto/valor-baixo não fica no topo).

## Critérios de sucesso do MVP

1. Dono sobe um CSV e em < 10 min vê "R$ X recuperável + 3 causas + 3 ações clicáveis".
2. Todo número é auditável (Regra Zero / Guardrail 5).
3. O Revenue Engine não tem nenhuma linha específica de e-commerce (Guardrail 8).
4. Pelo menos uma ação executável (mesmo semiassistida) — termina em ação, não em relatório.

## Fora de escopo (YAGNI — não construir agora)

Integrações reais (Shopify/Stripe), execução automática de mensagens, ML treinado, família RRI (Marketing/Sales/...), módulos de CFO de IA, billing/pricing. Tudo isso é pós-validação de que pagam.

---

**Próximo passo:** transformar esta spec em plano de tarefas (TDD, bite-sized) e implementar. Ver `superpowers:writing-plans`.
