DROP INDEX handover_cases_tenant_id_employee_id_key;
CREATE INDEX handover_cases_tenant_id_employee_id_idx ON handover_cases (tenant_id, employee_id);
CREATE UNIQUE INDEX handover_cases_one_open_per_employee
  ON handover_cases (tenant_id, employee_id) WHERE completed_at IS NULL;
