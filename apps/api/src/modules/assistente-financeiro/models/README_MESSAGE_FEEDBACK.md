# MessageFeedback Model

## Overview

The `AssisteFinanceiroMessageFeedback` model tracks feedback and outcomes from sent message suggestions. It's a critical part of the learning loop that improves AI-generated messages over time.

## Purpose

- **Track Message Effectiveness**: Did the message result in a customer response or purchase?
- **Measure Recovery Success**: How much revenue was recovered from the recovery attempt?
- **Learning Loop Input**: Feedback data trains the AI to generate better messages in the future
- **Business Intelligence**: Enables analytics on message success rates and ROI

## Database Schema

```sql
CREATE TABLE "assistente_financeiro_message_feedbacks" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_suggestion_id" UUID NOT NULL FOREIGN KEY ON DELETE CASCADE,
  "customer_responded" BOOLEAN,
  "response_at" TIMESTAMPTZ,
  "customer_returned" BOOLEAN,
  "returned_at" TIMESTAMPTZ,
  "revenue_recovered" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (>= 0),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | No | Primary key, auto-generated |
| `messageSuggestionId` | UUID | No | Foreign key to MessageSuggestion (CASCADE delete) |
| `customerResponded` | Boolean | Yes | Did the customer respond to the message? (null = unknown) |
| `responseAt` | DateTime | Yes | Timestamp when customer responded |
| `customerReturned` | Boolean | Yes | Did the customer make a return purchase? (null = unknown) |
| `returnedAt` | DateTime | Yes | Timestamp when customer made the return purchase |
| `revenueRecovered` | Decimal(12,2) | No | Revenue amount recovered (default: 0, min: 0) |
| `notes` | Text | Yes | Admin notes about this feedback |
| `createdAt` | DateTime | No | Feedback creation timestamp |

## Relationships

### Parent: MessageSuggestion
- **Cardinality**: Many feedback records per suggestion
- **Delete Behavior**: CASCADE (deleting a suggestion deletes all its feedback)
- **Access**: `feedback.messageSuggestion` → `AssisteFinanceiroMessageSuggestion`

### Indirect Relationship: Customer
- Accessed via: `feedback.messageSuggestion.customer`
- Allows analysis of customer's feedback across all messages

## Key Constraints

1. **revenueRecovered >= 0**: Cannot have negative revenue
2. **Nullable Feedback Fields**: Allows partial feedback (we may know response before return)
3. **Cascade Delete**: When a message suggestion is deleted, all its feedback is removed
4. **Indexes**:
   - `messageSuggestionId`: Fast lookup of feedback for a suggestion
   - `createdAt DESC`: Fast retrieval of recent feedback

## Utility Functions

### `getFeedbackStatus(customerResponded?, customerReturned?): FeedbackStatus`
Returns the current lifecycle status of feedback:
- `PENDING`: No feedback data yet
- `RESPONDED`: Customer responded but didn't return
- `RETURNED`: Customer made a return purchase
- `NO_RESPONSE`: Customer explicitly didn't respond

### `isSuccessfulRecovery(customerReturned?, revenueRecovered?): boolean`
Determines if this was a successful recovery:
- Returns `true` only if both `customerReturned === true` AND `revenueRecovered > 0`
- Otherwise returns `false`

### `calculateMessageEffectiveness(customerResponded?, customerReturned?): number`
Calculates effectiveness score (0-100):
- 100: Customer returned (full success)
- 50: Customer responded but didn't return (partial success)
- 0: No response or unknown

## Usage Examples

### Creating Feedback with Full Data
```typescript
const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
  data: {
    messageSuggestionId: suggestion.id,
    customerResponded: true,
    responseAt: new Date(),
    customerReturned: true,
    returnedAt: new Date(),
    revenueRecovered: 250.50,
    notes: 'Customer responded positively and made a purchase',
  },
});
```

### Creating Partial Feedback
```typescript
// We know customer responded but don't know about return yet
const feedback = await prisma.assisteFinanceiroMessageFeedback.create({
  data: {
    messageSuggestionId: suggestion.id,
    customerResponded: true,
    responseAt: new Date(),
    // customerReturned and returnedAt left null
  },
});

// Later, when we learn about the return:
const updated = await prisma.assisteFinanceiroMessageFeedback.update({
  where: { id: feedback.id },
  data: {
    customerReturned: true,
    returnedAt: new Date(),
    revenueRecovered: 150.00,
  },
});
```

### Analyzing Message Effectiveness
```typescript
const feedback = await prisma.assisteFinanceiroMessageFeedback.findUnique({
  where: { id: feedbackId },
});

const status = getFeedbackStatus(feedback.customerResponded, feedback.customerReturned);
const isSuccess = isSuccessfulRecovery(feedback.customerReturned, feedback.revenueRecovered);
const effectiveness = calculateMessageEffectiveness(
  feedback.customerResponded,
  feedback.customerReturned
);
```

## Testing

Two test files are provided:

1. **message-feedback.spec.ts** (Integration tests requiring database)
   - Creates feedback with all fields
   - Tests response/return tracking
   - Tests null field handling
   - Tests cascade delete
   - Tests relationships

2. **message-feedback-types.spec.ts** (Unit tests for logic)
   - FeedbackStatus enum validation
   - getFeedbackStatus() function
   - isSuccessfulRecovery() function
   - calculateMessageEffectiveness() function

## Migration

The migration creates the table with:
- UUID primary key with auto-generation
- Foreign key to message_suggestions with CASCADE delete
- CHECK constraint on revenueRecovered (>= 0)
- Indexes on messageSuggestionId and createdAt for query performance

## Future Enhancements

1. Add `sentAt` field to track message delivery time
2. Add `clickedAt` for tracking email link clicks
3. Add `replyContent` to capture customer response text
4. Add `sentiment` analysis of customer response
5. Add batch feedback update operations for bulk processing
6. Add analytics queries for A/B testing message effectiveness
