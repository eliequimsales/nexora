# Database Migrations - Task 6: IA Message Generation

## Migration Order

Migrations must be applied in this order:

1. `2026-05-13-message-suggestion.sql` - Creates assistente_financeiro_message_suggestions table
2. `2026-05-13-message-feedback.sql` - Creates assistente_financeiro_message_feedbacks table (depends on #1)
3. `2026-05-13-update-ai-metrics.sql` - Adds success_rate and accuracy_score to ai_metrics

## Prerequisites

- PostgreSQL 13+ with `pgcrypto` extension (for gen_random_uuid())
- Existing tables:
  - `assistente_financeiro_customers`
  - `assistente_financeiro_ai_metrics`

## How to Apply

### Option 1: Via Prisma (Recommended)
```bash
npx prisma db push
# OR for production
npx prisma migrate deploy
```

### Option 2: Manual via psql
```bash
psql $DATABASE_URL < migrations/2026-05-13-message-suggestion.sql
psql $DATABASE_URL < migrations/2026-05-13-message-feedback.sql
psql $DATABASE_URL < migrations/2026-05-13-update-ai-metrics.sql
```

## Schema Constraints

### assistente_financeiro_message_suggestions
- `confidence`: 0-100 (CHECK constraint)
- `channel`: 'whatsapp' or 'email' only (CHECK constraint)
- `customer_id`: CASCADE delete from `assistente_financeiro_customers`

### assistente_financeiro_message_feedbacks
- `revenue_recovered`: >= 0 (CHECK constraint)
- `message_suggestion_id`: CASCADE delete from `assistente_financeiro_message_suggestions`

### ai_metrics
- `success_rate`: 0-100 (CHECK constraint)
- `accuracy_score`: 0-100 (CHECK constraint)

## Rollback

```sql
DROP TABLE IF EXISTS assistente_financeiro_message_feedbacks;
DROP TABLE IF EXISTS assistente_financeiro_message_suggestions;
ALTER TABLE assistente_financeiro_ai_metrics
  DROP COLUMN IF EXISTS success_rate,
  DROP COLUMN IF EXISTS accuracy_score;
```

## Testing

After applying migrations, verify with:
```sql
\d assistente_financeiro_message_suggestions
\d assistente_financeiro_message_feedbacks
\d assistente_financeiro_ai_metrics
```
