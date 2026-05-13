-- I1: Partial indexes - only index active/pending rows to reduce index size.
-- Run after Prisma migrations; these are outside Prisma's migration graph.

-- Active workflows only (most engine queries filter isActive = true)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_active_trigger
  ON workflows (org_id, trigger_type)
  WHERE is_active = true;

-- Pending/failed AI executions (retryable states)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_executions_retryable
  ON ai_executions (org_id, created_at DESC)
  WHERE status IN ('pending', 'failed');

-- Pending workflow executions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_pending
  ON workflow_executions (org_id, executed_at DESC)
  WHERE status = 'pending';

-- I2: CHECK constraints - enforce valid enum values at DB level.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_leads_status'
      AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT chk_leads_status
      CHECK (status IN ('new', 'contacted', 'qualified', 'disqualified', 'closed_won', 'closed_lost'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_proposals_status'
      AND conrelid = 'proposals'::regclass
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT chk_proposals_status
      CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ai_executions_status'
      AND conrelid = 'ai_executions'::regclass
  ) THEN
    ALTER TABLE ai_executions
      ADD CONSTRAINT chk_ai_executions_status
      CHECK (status IN ('pending', 'success', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_workflow_executions_status'
      AND conrelid = 'workflow_executions'::regclass
  ) THEN
    ALTER TABLE workflow_executions
      ADD CONSTRAINT chk_workflow_executions_status
      CHECK (status IN ('pending', 'success', 'failed', 'skipped'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_subscriptions_plan'
      AND conrelid = 'subscriptions'::regclass
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT chk_subscriptions_plan
      CHECK (plan IN ('free', 'starter', 'pro', 'business'));
  END IF;
END $$;

-- Note: CONCURRENTLY cannot run inside a transaction block.
-- Run this file manually: psql $DATABASE_URL -f this_file.sql
