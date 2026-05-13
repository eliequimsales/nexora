-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "niche" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "ai_prompts" JSONB NOT NULL DEFAULT '{}',
    "form_token" VARCHAR(64) NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'member',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    "stage_type" VARCHAR(20) NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "status" VARCHAR(30) NOT NULL DEFAULT 'new',
    "pipeline_stage_id" TEXT,
    "assigned_to" TEXT,
    "ai_score" SMALLINT,
    "ai_classification" VARCHAR(10),
    "follow_up_count" SMALLINT NOT NULL DEFAULT 0,
    "niche_data" JSONB NOT NULL DEFAULT '{}',
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "created_by" TEXT,
    "assigned_to" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_executions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "trigger_type" VARCHAR(100) NOT NULL,
    "action_type" VARCHAR(20) NOT NULL,
    "prompt_version" VARCHAR(50) NOT NULL,
    "lead_variables_used" JSONB NOT NULL,
    "llm_response" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "tokens_input" INTEGER,
    "tokens_output" INTEGER,
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" VARCHAR(50) NOT NULL,
    "trigger_conditions" JSONB NOT NULL DEFAULT '{}',
    "action_type" VARCHAR(50) NOT NULL,
    "action_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "triggered_by" VARCHAR(100) NOT NULL,
    "result" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "token" VARCHAR(64),
    "note" TEXT,
    "valid_until" TIMESTAMPTZ,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ,
    "viewed_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_webhooks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "events" TEXT[],
    "signing_secret" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbound_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "channel" VARCHAR(30) NOT NULL,
    "config" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "channel" VARCHAR(30) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "webhook_id" TEXT,
    "target_url" VARCHAR(500),
    "http_status" SMALLINT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "error_msg" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_email" VARCHAR(255) NOT NULL,
    "actor_role" VARCHAR(20) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(36),
    "resource_name" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_sub_id" TEXT,
    "plan" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "limits" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_views" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_form_token_key" ON "organizations"("form_token");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_org_id_email_key" ON "users"("org_id", "email");

-- CreateIndex
CREATE INDEX "pipeline_stages_org_id_position_idx" ON "pipeline_stages"("org_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_org_id_position_key" ON "pipeline_stages"("org_id", "position");

-- CreateIndex
CREATE INDEX "leads_org_id_status_idx" ON "leads"("org_id", "status");

-- CreateIndex
CREATE INDEX "leads_org_id_pipeline_stage_id_idx" ON "leads"("org_id", "pipeline_stage_id");

-- CreateIndex
CREATE INDEX "leads_org_id_assigned_to_idx" ON "leads"("org_id", "assigned_to");

-- CreateIndex
CREATE INDEX "leads_org_id_created_at_idx" ON "leads"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_org_id_ai_classification_idx" ON "leads"("org_id", "ai_classification");

-- CreateIndex
CREATE INDEX "tasks_org_id_status_idx" ON "tasks"("org_id", "status");

-- CreateIndex
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_status_idx" ON "tasks"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "tasks_org_id_due_date_idx" ON "tasks"("org_id", "due_date");

-- CreateIndex
CREATE INDEX "activity_log_lead_id_created_at_idx" ON "activity_log"("lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_org_id_created_at_idx" ON "activity_log"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_org_id_type_created_at_idx" ON "activity_log"("org_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_executions_org_id_lead_id_idx" ON "ai_executions"("org_id", "lead_id");

-- CreateIndex
CREATE INDEX "ai_executions_org_id_status_idx" ON "ai_executions"("org_id", "status");

-- CreateIndex
CREATE INDEX "ai_executions_org_id_created_at_idx" ON "ai_executions"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_executions_lead_id_action_type_idx" ON "ai_executions"("lead_id", "action_type");

-- CreateIndex
CREATE INDEX "workflows_org_id_is_active_idx" ON "workflows"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "workflows_org_id_trigger_type_idx" ON "workflows"("org_id", "trigger_type");

-- CreateIndex
CREATE INDEX "workflows_org_id_trigger_type_is_active_idx" ON "workflows"("org_id", "trigger_type", "is_active");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_executed_at_idx" ON "workflow_executions"("workflow_id", "executed_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_executions_org_id_status_executed_at_idx" ON "workflow_executions"("org_id", "status", "executed_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_executions_lead_id_executed_at_idx" ON "workflow_executions"("lead_id", "executed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_token_key" ON "proposals"("token");

-- CreateIndex
CREATE INDEX "proposals_org_id_status_idx" ON "proposals"("org_id", "status");

-- CreateIndex
CREATE INDEX "proposals_org_id_lead_id_idx" ON "proposals"("org_id", "lead_id");

-- CreateIndex
CREATE INDEX "proposals_org_id_created_at_idx" ON "proposals"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "proposal_items_proposal_id_idx" ON "proposal_items"("proposal_id");

-- CreateIndex
CREATE INDEX "outbound_webhooks_org_id_is_active_idx" ON "outbound_webhooks"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "integration_configs_org_id_idx" ON "integration_configs"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_org_id_channel_key" ON "integration_configs"("org_id", "channel");

-- CreateIndex
CREATE INDEX "integration_logs_org_id_created_at_idx" ON "integration_logs"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "integration_logs_webhook_id_idx" ON "integration_logs"("webhook_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_created_at_idx" ON "audit_logs"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_org_id_action_idx" ON "audit_logs"("org_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_actor_id_idx" ON "audit_logs"("org_id", "actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "proposal_views_proposal_id_idx" ON "proposal_views"("proposal_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_stage_id_fkey" FOREIGN KEY ("pipeline_stage_id") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_webhooks" ADD CONSTRAINT "outbound_webhooks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "outbound_webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_views" ADD CONSTRAINT "proposal_views_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
