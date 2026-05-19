-- AlterTable: Add Google OAuth ID to users
ALTER TABLE "users" ADD COLUMN "google_id" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
