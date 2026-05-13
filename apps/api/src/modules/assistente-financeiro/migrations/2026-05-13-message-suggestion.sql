-- ============================================================================
-- Migration: Add assistente_financeiro_message_suggestions table
-- Date: 2026-05-13
-- Purpose: Store AI-generated personalized recovery messages for churned customers
-- Dependencies: assistente_financeiro_customers table must exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistente_financeiro_message_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES assistente_financeiro_customers(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  base_message TEXT NOT NULL,
  personalized_message TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  context_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_af_message_suggestions_customer_id
  ON assistente_financeiro_message_suggestions(customer_id);

CREATE INDEX IF NOT EXISTS idx_af_message_suggestions_channel
  ON assistente_financeiro_message_suggestions(channel);

CREATE INDEX IF NOT EXISTS idx_af_message_suggestions_created_at
  ON assistente_financeiro_message_suggestions(created_at DESC);

-- Composite index for tenant-scoped queries via customer relationship
CREATE INDEX IF NOT EXISTS idx_af_message_suggestions_customer_channel
  ON assistente_financeiro_message_suggestions(customer_id, channel);

COMMENT ON TABLE assistente_financeiro_message_suggestions IS 'AI-generated message suggestions for customer recovery';
COMMENT ON COLUMN assistente_financeiro_message_suggestions.confidence IS 'AI confidence score (0-100) on message success likelihood';
COMMENT ON COLUMN assistente_financeiro_message_suggestions.context_data IS 'JSONB metadata used for personalization (days inactive, revenue, etc)';
