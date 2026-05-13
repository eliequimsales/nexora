-- ============================================================================
-- Migration: Update assistente_financeiro_ai_metrics with success rate fields
-- Date: 2026-05-13
-- Purpose: Add fields for tracking AI learning loop performance
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE assistente_financeiro_ai_metrics 
  ADD COLUMN IF NOT EXISTS success_rate INTEGER DEFAULT 0 
    CHECK (success_rate >= 0 AND success_rate <= 100);

ALTER TABLE assistente_financeiro_ai_metrics 
  ADD COLUMN IF NOT EXISTS accuracy_score INTEGER DEFAULT 50 
    CHECK (accuracy_score >= 0 AND accuracy_score <= 100);

COMMENT ON COLUMN assistente_financeiro_ai_metrics.success_rate IS 
  'Percentage (0-100) of contacted customers that responded/returned';

COMMENT ON COLUMN assistente_financeiro_ai_metrics.accuracy_score IS 
  'Accuracy score (0-100) measuring AI prediction quality vs actual outcomes';
