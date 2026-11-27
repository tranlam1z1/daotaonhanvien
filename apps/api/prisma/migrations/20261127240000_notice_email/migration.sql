ALTER TABLE users ADD COLUMN muted_email_groups text[] NOT NULL DEFAULT '{}';
ALTER TABLE workspace_notices ADD COLUMN email_handled_at timestamptz(3),
  ADD COLUMN email_claimed_at timestamptz(3);
CREATE INDEX workspace_notices_unsent_idx ON workspace_notices (tenant_id, created_at) WHERE email_handled_at IS NULL;
