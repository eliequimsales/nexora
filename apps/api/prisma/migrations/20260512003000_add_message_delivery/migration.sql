-- CreateTable: AssisteFinanceiroMessageDelivery
-- Tracks delivery status and channel metadata for each sent message suggestion
CREATE TABLE IF NOT EXISTS "assistente_financeiro_message_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_suggestion_id" UUID NOT NULL,
  "channel" VARCHAR(20) NOT NULL,
  "recipient" VARCHAR(200) NOT NULL,
  "external_id" VARCHAR(200),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "error_message" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ,
  "delivered_at" TIMESTAMPTZ,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistente_financeiro_message_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistente_financeiro_message_deliveries_message_suggestion_id_fkey"
    FOREIGN KEY ("message_suggestion_id") REFERENCES "assistente_financeiro_message_suggestions"("id") ON DELETE CASCADE
);

-- CreateIndex: Indexes for query performance and delivery tracking
CREATE INDEX "assistente_financeiro_message_deliveries_message_suggestion_id_idx"
  ON "assistente_financeiro_message_deliveries"("message_suggestion_id");

CREATE INDEX "assistente_financeiro_message_deliveries_external_id_idx"
  ON "assistente_financeiro_message_deliveries"("external_id");

CREATE INDEX "assistente_financeiro_message_deliveries_status_idx"
  ON "assistente_financeiro_message_deliveries"("status");

CREATE INDEX "assistente_financeiro_message_deliveries_created_at_idx"
  ON "assistente_financeiro_message_deliveries"("created_at" DESC);
