-- Campo aditivo e idempotente. Não ativa atendimento nem modifica dados existentes.
ALTER TABLE "CompanyProfile"
  ADD COLUMN IF NOT EXISTS "atendenteConfiguracao" JSONB;
