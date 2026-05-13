-- CreateTable assistente_financeiro_subscriptions
CREATE TABLE "assistente_financeiro_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tier" VARCHAR(50) NOT NULL DEFAULT 'starter',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "trial_started_at" TIMESTAMP(3),
    "trial_expires_at" TIMESTAMP(3),
    "recovery_actions_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistente_financeiro_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable assistente_financeiro_customers
CREATE TABLE "assistente_financeiro_customers" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "crm_id" VARCHAR(255) NOT NULL,
    "crm_source" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "last_activity_date" DATE,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_transaction_date" DATE,
    "churn_risk_score" DECIMAL(5,2),
    "churn_risk_prediction" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistente_financeiro_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable assistente_financeiro_recovery_actions
CREATE TABLE "assistente_financeiro_recovery_actions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "suggested_message" TEXT,
    "actual_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_by" VARCHAR(50),
    "discount_offered" DECIMAL(5,2),
    "customer_responded" BOOLEAN,
    "response_at" TIMESTAMP(3),
    "customer_returned" BOOLEAN,
    "returned_at" TIMESTAMP(3),
    "revenue_recovered" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistente_financeiro_recovery_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable assistente_financeiro_ai_metrics
CREATE TABLE "assistente_financeiro_ai_metrics" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "customers_analyzed" INTEGER NOT NULL DEFAULT 0,
    "total_suggestions" INTEGER NOT NULL DEFAULT 0,
    "successful_suggestions" INTEGER NOT NULL DEFAULT 0,
    "accuracy_score" DECIMAL(5,2),
    "last_retraining_at" TIMESTAMP(3),
    "model_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistente_financeiro_ai_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable assistente_financeiro_integrations
CREATE TABLE "assistente_financeiro_integrations" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "integration_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" VARCHAR(50) NOT NULL DEFAULT 'idle',
    "sync_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistente_financeiro_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable assistente_financeiro_monthly_metrics
CREATE TABLE "assistente_financeiro_monthly_metrics" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "month_year" VARCHAR(7) NOT NULL,
    "goal_amount" DECIMAL(12,2),
    "revenue_actual" DECIMAL(12,2),
    "revenue_projected" DECIMAL(12,2),
    "customers_lost" INTEGER,
    "customers_recovered" INTEGER,
    "recovery_success_rate" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistente_financeiro_monthly_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistente_financeiro_subscriptions_organization_id_key" ON "assistente_financeiro_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "assistente_financeiro_subscriptions_organization_id_idx" ON "assistente_financeiro_subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistente_financeiro_customers_subscription_id_crm_id_crm_s_key" ON "assistente_financeiro_customers"("subscription_id", "crm_id", "crm_source");

-- CreateIndex
CREATE INDEX "assistente_financeiro_customers_subscription_id_churn_risk_p_idx" ON "assistente_financeiro_customers"("subscription_id", "churn_risk_prediction");

-- CreateIndex
CREATE INDEX "assistente_financeiro_customers_last_activity_date_idx" ON "assistente_financeiro_customers"("last_activity_date");

-- CreateIndex
CREATE INDEX "assistente_financeiro_recovery_actions_subscription_id_created_idx" ON "assistente_financeiro_recovery_actions"("subscription_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "assistente_financeiro_recovery_actions_customer_returned_idx" ON "assistente_financeiro_recovery_actions"("customer_returned");

-- CreateIndex
CREATE UNIQUE INDEX "assistente_financeiro_ai_metrics_subscription_id_key" ON "assistente_financeiro_ai_metrics"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistente_financeiro_integrations_subscription_id_integration_key" ON "assistente_financeiro_integrations"("subscription_id", "integration_type");

-- CreateIndex
CREATE INDEX "assistente_financeiro_integrations_subscription_id_idx" ON "assistente_financeiro_integrations"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistente_financeiro_monthly_metrics_subscription_id_month_ye_key" ON "assistente_financeiro_monthly_metrics"("subscription_id", "month_year");

-- CreateIndex
CREATE INDEX "assistente_financeiro_monthly_metrics_subscription_id_idx" ON "assistente_financeiro_monthly_metrics"("subscription_id");

-- AddForeignKey
ALTER TABLE "assistente_financeiro_subscriptions" ADD CONSTRAINT "assistente_financeiro_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_customers" ADD CONSTRAINT "assistente_financeiro_customers_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assistente_financeiro_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_recovery_actions" ADD CONSTRAINT "assistente_financeiro_recovery_actions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "assistente_financeiro_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_recovery_actions" ADD CONSTRAINT "assistente_financeiro_recovery_actions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assistente_financeiro_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_ai_metrics" ADD CONSTRAINT "assistente_financeiro_ai_metrics_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assistente_financeiro_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_integrations" ADD CONSTRAINT "assistente_financeiro_integrations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assistente_financeiro_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_financeiro_monthly_metrics" ADD CONSTRAINT "assistente_financeiro_monthly_metrics_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "assistente_financeiro_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
