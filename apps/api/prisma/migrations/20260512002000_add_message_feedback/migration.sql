-- CreateTable: AssisteFinanceiroMessageFeedback
-- Tracks feedback and outcomes from sent message suggestions
CREATE TABLE IF NOT EXISTS "assistente_financeiro_message_feedbacks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_suggestion_id" UUID NOT NULL,
  "customer_responded" BOOLEAN,
  "response_at" TIMESTAMPTZ,
  "customer_returned" BOOLEAN,
  "returned_at" TIMESTAMPTZ,
  "revenue_recovered" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (revenue_recovered >= 0),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistente_financeiro_message_feedbacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistente_financeiro_message_feedbacks_message_suggestion_id_fkey"
    FOREIGN KEY ("message_suggestion_id") REFERENCES "assistente_financeiro_message_suggestions"("id") ON DELETE CASCADE
);

-- CreateIndex: Indexes for query performance and cascade delete
CREATE INDEX "assistente_financeiro_message_feedbacks_message_suggestion_id_idx"
  ON "assistente_financeiro_message_feedbacks"("message_suggestion_id");

CREATE INDEX "assistente_financeiro_message_feedbacks_created_at_idx"
  ON "assistente_financeiro_message_feedbacks"("created_at" DESC);
