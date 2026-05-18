-- Nexora: track LGPD term acceptance per organization.
--
-- The barbershop must accept a data-processing agreement before sending any
-- recovery message. We store the timestamp, the user that clicked accept,
-- and the version of the term so future amendments can prompt re-acceptance.

ALTER TABLE "organizations"
  ADD COLUMN "lgpd_accepted_at"  TIMESTAMPTZ,
  ADD COLUMN "lgpd_accepted_by"  VARCHAR(255),
  ADD COLUMN "lgpd_term_version" VARCHAR(20);
