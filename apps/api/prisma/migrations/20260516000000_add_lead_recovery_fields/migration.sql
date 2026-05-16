-- Nexora: add recovery tracking columns to leads
--
-- opted_out_at:    set when the customer asks to stop receiving recovery messages
--                  (detected via webhook keyword matching). Recovery jobs MUST
--                  check this column before sending.
-- recovered_at:    set when the barbershop confirms the customer actually came back
--                  via POST /leads/:id/confirm-recovery.
-- recovered_value: real BRL value the customer spent on the recovery return —
--                  feeds the "receita recuperada" KPI on the Nexora dashboard.

ALTER TABLE "leads"
  ADD COLUMN "opted_out_at"    TIMESTAMPTZ,
  ADD COLUMN "recovered_at"    TIMESTAMPTZ,
  ADD COLUMN "recovered_value" DECIMAL(10, 2);

-- Partial index — most queries either look for opt-outs or filter them out.
-- This stays cheap because the column is sparse.
CREATE INDEX "leads_opted_out_at_idx"
  ON "leads" ("org_id", "opted_out_at")
  WHERE "opted_out_at" IS NOT NULL;

CREATE INDEX "leads_recovered_at_idx"
  ON "leads" ("org_id", "recovered_at")
  WHERE "recovered_at" IS NOT NULL;
