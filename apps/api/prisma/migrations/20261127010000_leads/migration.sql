CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'DEMOED', 'PILOT', 'NOT_SUITABLE');

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "job_title" VARCHAR(200) NOT NULL,
    "company_name" VARCHAR(300) NOT NULL,
    "company_size" VARCHAR(20) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "consent" BOOLEAN NOT NULL CHECK ("consent" = true),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assignee_id" UUID,
    "tenant_id" UUID,
    "ip" VARCHAR(45) NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notification_sent_at" TIMESTAMPTZ(3),
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leads_notification_sent_at_submitted_at_idx" ON "leads"("notification_sent_at", "submitted_at");
