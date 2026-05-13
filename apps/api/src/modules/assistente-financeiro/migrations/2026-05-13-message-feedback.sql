-- ============================================================================
-- Migration: Add assistente_financeiro_message_feedbacks table
-- Date: 2026-05-13
-- Purpose: Track outcomes of sent recovery messages for AI learning loop
-- Dependencies: assistente_financeiro_message_suggestions table must exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistente_financeiro_message_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_suggestion_id UUID NOT NULL REFERENCES assistente_financeiro_message_suggestions(id) ON DELETE CASCADE,
  customer_responded BOOLEAN,
  response_at TIMESTAMP WITH TIME ZONE,
  customer_returned BOOLEAN,
  returned_at TIMESTAMP WITH TIME ZONE,
  revenue_recovered DECIMAL(12, 2) DEFAULT 0 CHECK (revenue_recovered >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_af_message_feedbacks_suggestion_id
  ON assistente_financeiro_message_feedbacks(message_suggestion_id);

CREATE INDEX IF NOT EXISTS idx_af_message_feedbacks_created_at
  ON assistente_financeiro_message_feedbacks(created_at DESC);

-- Index for analytics queries on successful recoveries
CREATE INDEX IF NOT EXISTS idx_af_message_feedbacks_returned
  ON assistente_financeiro_message_feedbacks(customer_returned)
  WHERE customer_returned = TRUE;

COMMENT ON TABLE assistente_financeiro_message_feedbacks IS 'Feedback tracking outcomes of sent recovery messages';
COMMENT ON COLUMN assistente_financeiro_message_feedbacks.revenue_recovered IS 'Revenue (BRL) recovered from this customer after message';
COMMENT ON COLUMN assistente_financeiro_message_feedbacks.customer_responded IS 'Whether the customer responded to the message';
COMMENT ON COLUMN assistente_financeiro_message_feedbacks.customer_returned IS 'Whether the customer made a purchase after the message';
