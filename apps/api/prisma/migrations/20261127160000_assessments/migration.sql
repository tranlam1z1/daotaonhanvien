CREATE TYPE "AssessmentQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE');
CREATE TYPE "QuizSelectionMode" AS ENUM ('FIXED', 'RANDOM');

ALTER TABLE quizzes
  ADD COLUMN selection_mode "QuizSelectionMode",
  ADD COLUMN random_count INTEGER,
  ADD COLUMN time_limit_minutes INTEGER,
  ADD COLUMN passing_score INTEGER,
  ADD COLUMN max_attempts INTEGER,
  ADD COLUMN shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN shuffle_options BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN show_answers BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT quiz_settings_check CHECK (
    (selection_mode IS NULL AND random_count IS NULL AND time_limit_minutes IS NULL
      AND passing_score IS NULL AND max_attempts IS NULL)
    OR
    (selection_mode IS NOT NULL AND time_limit_minutes IS NOT NULL AND time_limit_minutes > 0
      AND passing_score IS NOT NULL AND passing_score BETWEEN 0 AND 100
      AND max_attempts IS NOT NULL AND max_attempts > 0
      AND ((selection_mode = 'FIXED' AND random_count IS NULL)
        OR (selection_mode = 'RANDOM' AND random_count IS NOT NULL AND random_count > 0)))
  );

CREATE TABLE assessment_questions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  department_id UUID,
  course_id UUID,
  topic TEXT,
  type "AssessmentQuestionType" NOT NULL,
  prompt TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_options INTEGER[] NOT NULL,
  explanation TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, course_id) REFERENCES training_courses(tenant_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CHECK (num_nonnulls(course_id, topic) = 1),
  CHECK (cardinality(options) >= 2 AND cardinality(correct_options) >= 1)
);
CREATE INDEX assessment_questions_tenant_id_department_id_idx
  ON assessment_questions (tenant_id, department_id);
CREATE INDEX assessment_questions_tenant_id_course_id_idx
  ON assessment_questions (tenant_id, course_id);

CREATE TABLE quiz_questions (
  tenant_id UUID NOT NULL,
  quiz_id UUID NOT NULL,
  question_id UUID NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (tenant_id, quiz_id, question_id),
  UNIQUE (tenant_id, quiz_id, position),
  FOREIGN KEY (tenant_id, quiz_id) REFERENCES quizzes(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, question_id) REFERENCES assessment_questions(tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX quiz_questions_tenant_id_question_id_idx
  ON quiz_questions (tenant_id, question_id);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['assessment_questions', 'quiz_questions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO educore36_tenant', table_name);
    EXECUTE format('CREATE POLICY assessment_tenant ON %I TO educore36_tenant USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
    EXECUTE format('CREATE TRIGGER immutable_tenant BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id()', table_name);
  END LOOP;
END $$;

GRANT INSERT, UPDATE ON quizzes TO educore36_tenant;
