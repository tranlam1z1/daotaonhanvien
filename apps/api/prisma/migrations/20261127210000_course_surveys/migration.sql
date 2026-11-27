CREATE TABLE course_survey_responses (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  enrollment_id UUID NOT NULL,
  ratings JSONB NOT NULL,
  feedback TEXT NOT NULL,
  submitted_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, enrollment_id),
  CONSTRAINT course_survey_responses_enrollment_key UNIQUE (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE course_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_survey_responses FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON course_survey_responses TO educore36_tenant;
CREATE POLICY course_survey_responses_tenant ON course_survey_responses TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
