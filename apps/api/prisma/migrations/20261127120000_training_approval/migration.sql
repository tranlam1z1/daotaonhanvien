ALTER TYPE "TrainingCourseStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "TrainingCourseStatus" ADD VALUE 'PUBLISHED';

ALTER TABLE training_courses
  ADD COLUMN author_id UUID,
  ADD COLUMN review_token UUID,
  ADD COLUMN rejection_reason TEXT,
  ADD CONSTRAINT training_courses_review_token CHECK ((status::text = 'IN_REVIEW') = (review_token IS NOT NULL));

ALTER TABLE training_programs
  ADD COLUMN status "TrainingCourseStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN author_id UUID,
  ADD COLUMN review_token UUID,
  ADD COLUMN rejection_reason TEXT,
  ADD CONSTRAINT training_programs_review_token CHECK ((status::text = 'IN_REVIEW') = (review_token IS NOT NULL));

CREATE TABLE training_releases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  course_id UUID,
  program_id UUID,
  department_id UUID,
  revision INTEGER NOT NULL,
  content JSONB NOT NULL,
  FOREIGN KEY (tenant_id, course_id) REFERENCES training_courses(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, program_id) REFERENCES training_programs(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (num_nonnulls(course_id, program_id) = 1),
  UNIQUE (tenant_id, course_id, revision),
  UNIQUE (tenant_id, program_id, revision)
);

CREATE TABLE training_rejections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX training_rejections_tenant_id_user_id_created_at_idx ON training_rejections(tenant_id, user_id, created_at);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['training_releases', 'training_rejections'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO educore36_tenant', table_name);
    EXECUTE format('CREATE POLICY training_tenant ON %I TO educore36_tenant USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
    EXECUTE format('CREATE TRIGGER immutable_tenant BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id()', table_name);
  END LOOP;
END $$;
