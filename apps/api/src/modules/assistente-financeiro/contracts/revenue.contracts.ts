/**
 * Revenue Contracts — A LINGUAGEM DA NEXORA.
 *
 * Estes contratos NÃO dependem de nenhuma implementação. Eles definem a língua
 * que todas as camadas falam (Signal Providers, Revenue Engine, Decision Engine, UI).
 *
 * Constituição:
 * - Artigo VII (Engine Universal): o núcleo só conhece sinais normalizados, nunca setores.
 * - Artigo VIII (Mesmo schema): todo Signal Provider produz exatamente este schema.
 * - Artigo X (Dinheiro antes de vaidade): valor em R$ é primário; RRI é secundário.
 *
 * Promoção futura: quando o frontend (apps/app) precisar destes tipos, mover para
 * `@nexora/shared`. Por enquanto vivem no módulo para a primeira fatia ser autocontida.
 *
 * Convenção: todo valor monetário é em CENTAVOS (inteiro), moeda BRL no MVP.
 */

export type CurrencyCents = number;

// ---------- Schema canônico (entrada normalizada) ----------

export interface CanonicalPurchase {
  at: Date;
  amountCents: CurrencyCents;
}

export interface CanonicalCustomer {
  externalId: string;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  purchases: CanonicalPurchase[];
  /** Sinais opcionais por fonte; ausência nunca é erro. */
  signals?: {
    abandonedCarts?: number;
    channel?: string;
  };
}

/**
 * Qualidade do dado normalizado. Artigo VI (Verdade acima de marketing):
 * dado sujo/incompleto REDUZ a cobertura — nunca inventa certeza.
 */
export interface DataQuality {
  totalRows: number;
  validRows: number;
  /** validRows / totalRows, 0..1. Alimenta a confiança a jusante. */
  coverage: number;
  warnings: string[];
}

export interface AssessmentInput {
  schemaVersion: 1;
  orgId: string;
  currency: 'BRL';
  /** Para o RRI executivo; se ausente, usar a soma das compras dos últimos 12m. */
  annualRevenueCents?: CurrencyCents;
  /** Margem default por nicho (0..1), conservadora. */
  marginPctDefault: number;
  customers: CanonicalCustomer[];
  /** Preenchido pelo Signal Provider no parse; opcional para construção em testes. */
  dataQuality?: DataQuality;
}

// ---------- Sinais normalizados (saída do Signal Provider) ----------

/**
 * O Revenue Engine SÓ conhece isto — nunca recência/frequência cruas.
 * Cada provider (RFM, Subscription, B2B...) calcula pReturn/futureValue do SEU jeito.
 */
export interface RevenueSignal {
  externalId: string;
  /** Probabilidade de retorno se abordado agora (0..1). */
  pReturn: number;
  /** Valor futuro esperado se voltar (recorrente, não ticket único). */
  futureValueCents: CurrencyCents;
  /** Custo esperado de recuperar (canal + desconto esperado). */
  recoveryCostCents: CurrencyCents;
}

// ---------- Saída do produto ----------

export type ConfidenceLevel = 'preliminary' | 'low' | 'medium' | 'high';

export interface Confidence {
  pct: number; // 0..100
  level: ConfidenceLevel;
  /** Artigo VI: por que esta confiança — honestidade explícita. */
  reason: string;
}

export type ActionKind =
  | 'generate_message'
  | 'create_campaign'
  | 'export_list'
  | 'increase_confidence';

export interface Action {
  kind: ActionKind;
  /** Texto em PT, orientado a clareza/dinheiro. */
  label: string;
  executable: boolean;
}

export interface Opportunity {
  externalId: string;
  recoverableCents: CurrencyCents;
  /** RRI operacional 0..100 — ranking interno, nunca o número de venda. */
  rriOperational: number;
  /** Artigo IV (Regra Zero): EXATAMENTE uma ação por oportunidade. */
  action: Action;
  /** Guardrail 5: motivo auditável. */
  why: string;
}

export interface RecoverableCause {
  label: string;
  recoverableCents: CurrencyCents;
  pctOfTotal: number; // 0..100
}

export interface AssessmentResult {
  totalRecoverableCents: CurrencyCents;
  rangeLowCents: CurrencyCents;
  rangeHighCents: CurrencyCents;
  /** RRI executivo (%) = recuperável ÷ receita anual. null se receita anual desconhecida. */
  rriExecutivePct: number | null;
  confidence: Confidence;
  /** Causas auditáveis (Guardrail 5). */
  causes: RecoverableCause[];
  /** Top oportunidades, ordenadas por R$ desc (Artigo X). */
  topOpportunities: Opportunity[];
}

// ---------- Porta universal ----------

/**
 * Todo Signal Provider implementa este contrato. RFM/CSV é apenas o primeiro
 * (Guardrail 8): RFM nunca é a regra universal, só um produtor de sinais.
 */
export interface SignalProvider {
  readonly id: string;
  /** Normaliza entrada bruta da fonte para o schema canônico. */
  parse(raw: unknown): Promise<AssessmentInput>;
  /** Produz os sinais normalizados (pReturn/futureValue/custo) que o Engine consome. */
  toSignals(input: AssessmentInput): RevenueSignal[];
}
