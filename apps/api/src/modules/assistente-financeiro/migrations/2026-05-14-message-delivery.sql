-- ============================================================================
-- Migration: Add assistente_financeiro_message_deliveries table
-- Date: 2026-05-14
-- Purpose: Track delivery attempts and status of AI-generated recovery messages
-- Dependencies: assistente_financeiro_message_suggestions table must exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistente_financeiro_message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_suggestion_id UUID NOT NULL REFERENCES assistente_financeiro_message_suggestions(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient VARCHAR(200) NOT NULL,
  external_id VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')
  ),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_af_message_deliveries_suggestion_id
  ON assistente_financeiro_message_deliveries(message_suggestion_id);

CREATE INDEX IF NOT EXISTS idx_af_message_deliveries_external_id
  ON assistente_financeiro_message_deliveries(external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_af_message_deliveries_status
  ON assistente_financeiro_message_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_af_message_deliveries_created_at
  ON assistente_financeiro_message_deliveries(created_at DESC);

COMMENT ON TABLE assistente_financeiro_message_deliveries IS
  'Tracks delivery attempts of AI-generated recovery messages via WhatsApp/Email';
COMMENT ON COLUMN assistente_financeiro_message_deliveries.external_id IS
  'Provider message ID for webhook correlation (Z-API messageId / Resend email id)';
COMMENT ON COLUMN assistente_financeiro_message_deliveries.attempt_count IS
  'Number of send retries via BullMQ exponential backoff';
