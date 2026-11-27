CREATE TYPE "EnrollmentStatus" AS ENUM (
  'NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'FAILED', 'CANCELLED'
);
CREATE TYPE "EnrollmentSource" AS ENUM ('MANUAL', 'AUTOMATIC');

ALTER TABLE training_releases
  ADD CONSTRAINT training_releases_tenant_id_course_id_id_key
  UNIQUE (tenant_id, course_id, id);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  course_version_id UUID NOT NULL,
  program_id UUID,
  rule_id UUID,
  previous_enrollment_id UUID,
  assigned_by_id UUID,
  source "EnrollmentSource" NOT NULL,
  status "EnrollmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  assigned_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMPTZ(3) NOT NULL,
  started_at TIMESTAMPTZ(3),
  completed_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3) NOT NULL,
  UNIQUE (tenant_id, id),
  CONSTRAINT enrollments_tenant_user_course_id_key UNIQUE (tenant_id, user_id, course_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, course_id) REFERENCES training_courses(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, course_id, course_version_id)
    REFERENCES training_releases(tenant_id, course_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, program_id) REFERENCES training_programs(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, assigned_by_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, user_id, course_id, previous_enrollment_id)
    REFERENCES enrollments(tenant_id, user_id, course_id, id) ON UPDATE CASCADE,
  CHECK (previous_enrollment_id IS DISTINCT FROM id),
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX enrollments_one_active_per_course
  ON enrollments (tenant_id, user_id, course_id)
  WHERE status IN ('NOT_STARTED', 'IN_PROGRESS', 'OVERDUE');
CREATE INDEX enrollments_tenant_id_user_id_due_at_idx ON enrollments(tenant_id, user_id, due_at);
CREATE INDEX enrollments_tenant_id_course_id_status_idx ON enrollments(tenant_id, course_id, status);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON enrollments TO educore36_tenant;
CREATE POLICY enrollments_tenant ON enrollments TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();

CREATE FUNCTION prevent_enrollment_retarget() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.course_id, NEW.course_version_id, NEW.previous_enrollment_id)
     IS DISTINCT FROM
     (OLD.id, OLD.user_id, OLD.course_id, OLD.course_version_id, OLD.previous_enrollment_id) THEN
    RAISE EXCEPTION 'enrollment identity and assigned course version are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER immutable_enrollment_identity BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION prevent_enrollment_retarget();
