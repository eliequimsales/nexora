-- AlterTable: Add messageSuggestions relationship to AssisteFinanceiroCustomer
-- (This is implicit in Prisma relations, no SQL change needed here)

-- CreateTable: AssisteFinanceiroMessageSuggestion
CREATE TABLE IF NOT EXISTS "assistente_financeiro_message_suggestions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "channel" VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  "base_message" TEXT NOT NULL,
  "personalized_message" TEXT NOT NULL,
  "confidence" SMALLINT NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  "context_data" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistente_financeiro_message_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistente_financeiro_message_suggestions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "assistente_financeiro_customers"("id") ON DELETE CASCADE
);

-- CreateIndex: Indexes for query performance
CREATE INDEX "assistente_financeiro_message_suggestions_customer_id_idx"
  ON "assistente_financeiro_message_suggestions"("customer_id");

CREATE INDEX "assistente_financeiro_message_suggestions_channel_idx"
  ON "assistente_financeiro_message_suggestions"("channel");

CREATE INDEX "assistente_financeiro_message_suggestions_created_at_idx"
  ON "assistente_financeiro_message_suggestions"("created_at" DESC);
