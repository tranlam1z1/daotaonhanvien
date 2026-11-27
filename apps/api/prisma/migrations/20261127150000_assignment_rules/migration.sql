CREATE TABLE assignment_rules (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  course_id UUID,
  program_id UUID,
  department_id UUID,
  position_id UUID,
  new_hire_days INTEGER,
  due_days INTEGER NOT NULL,
  scope_department_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT assignment_rules_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_rules_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT assignment_rules_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT assignment_rules_tenant_id_course_id_fkey FOREIGN KEY (tenant_id, course_id)
    REFERENCES training_courses (tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT assignment_rules_tenant_id_program_id_fkey FOREIGN KEY (tenant_id, program_id)
    REFERENCES training_programs (tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT assignment_rules_tenant_id_department_id_fkey FOREIGN KEY (tenant_id, department_id)
    REFERENCES departments (tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT assignment_rules_tenant_id_position_id_fkey FOREIGN KEY (tenant_id, position_id)
    REFERENCES positions (tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT assignment_rules_target_check CHECK ((course_id IS NULL) <> (program_id IS NULL)),
  CONSTRAINT assignment_rules_condition_check CHECK (
    (department_id IS NOT NULL OR position_id IS NOT NULL OR new_hire_days IS NOT NULL)
    AND (cardinality(scope_department_ids) = 0 OR (
      department_id IS NOT NULL AND department_id = ANY(scope_department_ids)
    ))
    AND (new_hire_days IS NULL OR new_hire_days BETWEEN 0 AND 3650)
    AND due_days BETWEEN 1 AND 3650
  )
);
CREATE INDEX assignment_rules_tenant_id_enabled_idx ON assignment_rules (tenant_id, enabled);

ALTER TABLE enrollments ADD CONSTRAINT enrollments_tenant_id_rule_id_fkey
  FOREIGN KEY (tenant_id, rule_id) REFERENCES assignment_rules (tenant_id, id)
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY assignment_rules_tenant ON assignment_rules TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON assignment_rules TO educore36_tenant;
