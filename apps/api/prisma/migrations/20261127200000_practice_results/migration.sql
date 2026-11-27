CREATE TABLE practice_results (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  enrollment_id UUID NOT NULL,
  confirmed_by_id UUID NOT NULL,
  passed BOOLEAN NOT NULL,
  comment TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY (tenant_id, enrollment_id),
  CONSTRAINT practice_results_enrollment_key UNIQUE (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, confirmed_by_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE
);

ALTER TABLE practice_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_results FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON practice_results TO educore36_tenant;
CREATE POLICY practice_results_tenant ON practice_results TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON practice_results
  FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
