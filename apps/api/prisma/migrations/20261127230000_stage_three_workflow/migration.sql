ALTER TABLE handover_cases ADD COLUMN workflow jsonb NOT NULL DEFAULT '{}';
CREATE TABLE workspace_notices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  message text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at timestamptz(3),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX workspace_notices_tenant_id_user_id_event_key_key
  ON workspace_notices (tenant_id, user_id, event_key);
CREATE INDEX workspace_notices_tenant_id_user_id_created_at_idx
  ON workspace_notices (tenant_id, user_id, created_at);
ALTER TABLE workspace_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_notices FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON workspace_notices TO educore36_tenant;
CREATE POLICY tenant_workspace_notices ON workspace_notices TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
