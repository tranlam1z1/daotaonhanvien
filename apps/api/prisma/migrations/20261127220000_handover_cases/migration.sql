CREATE TABLE handover_cases (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  departure_on date NOT NULL,
  due_on date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz(3),
  CONSTRAINT handover_cases_tenant_id_employee_id_fkey
    FOREIGN KEY (tenant_id, employee_id) REFERENCES users (tenant_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX handover_cases_tenant_id_employee_id_key
  ON handover_cases (tenant_id, employee_id);

ALTER TABLE handover_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_cases FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON handover_cases TO educore36_tenant;
CREATE POLICY tenant_handover_cases ON handover_cases TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
