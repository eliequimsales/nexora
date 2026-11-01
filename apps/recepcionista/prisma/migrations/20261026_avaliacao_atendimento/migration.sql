-- Aditiva: não classifica conversas antigas como resolvidas.
CREATE TABLE IF NOT EXISTS "ConversationEvaluation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'OWNER',
  "note" TEXT NOT NULL DEFAULT '',
  "anchorMessageId" TEXT NOT NULL,
  "anchorAt" TIMESTAMP(3) NOT NULL,
  "context" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationEvaluation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationEvaluation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationEvaluation_companyId_requestId_key" ON "ConversationEvaluation"("companyId", "requestId");
CREATE INDEX IF NOT EXISTS "ConversationEvaluation_companyId_conversationId_createdAt_idx" ON "ConversationEvaluation"("companyId", "conversationId", "createdAt");
