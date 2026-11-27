ALTER TABLE enrollments ADD COLUMN progress_inherited_at TIMESTAMPTZ(3);

CREATE TABLE lesson_progress (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  enrollment_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  resume_position DOUBLE PRECISION,
  video_duration DOUBLE PRECISION,
  watched_segments JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY (tenant_id, enrollment_id, lesson_id),
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON lesson_progress TO educore36_tenant;
CREATE POLICY lesson_progress_tenant ON lesson_progress TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
