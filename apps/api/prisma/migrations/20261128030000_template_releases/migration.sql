CREATE TABLE "training_template_releases" (
  "sequence" SERIAL PRIMARY KEY,
  "version" TEXT NOT NULL UNIQUE,
  "program_id" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "position_group" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "questions" JSONB NOT NULL DEFAULT '[]',
  "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "training_template_releases_program_id_sequence_idx" ON "training_template_releases" ("program_id", "sequence");
GRANT SELECT ON "training_template_releases" TO educore36_tenant;
GRANT SELECT, INSERT ON "training_template_releases" TO educore36_platform;
GRANT USAGE ON SEQUENCE "training_template_releases_sequence_seq" TO educore36_platform;
