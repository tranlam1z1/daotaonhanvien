BEGIN;

ALTER TABLE lesson_progress ADD COLUMN quiz_score DOUBLE PRECISION CHECK (quiz_score BETWEEN 0 AND 100);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  enrollment_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  number INTEGER NOT NULL CHECK (number > 0),
  questions JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  passing_score INTEGER NOT NULL CHECK (passing_score BETWEEN 0 AND 100),
  show_answers BOOLEAN NOT NULL,
  started_at TIMESTAMPTZ(3) NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL CHECK (expires_at > started_at),
  submitted_at TIMESTAMPTZ(3),
  score DOUBLE PRECISION CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN,
  CONSTRAINT quiz_attempts_lesson_number_key UNIQUE (tenant_id, enrollment_id, lesson_id, number),
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK ((submitted_at IS NULL AND score IS NULL AND passed IS NULL)
      OR (submitted_at IS NOT NULL AND score IS NOT NULL AND passed IS NOT NULL))
);
CREATE UNIQUE INDEX quiz_attempts_one_open
  ON quiz_attempts(tenant_id, enrollment_id, lesson_id) WHERE submitted_at IS NULL;
CREATE INDEX quiz_attempts_due
  ON quiz_attempts(tenant_id, expires_at) WHERE submitted_at IS NULL;

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON quiz_attempts TO educore36_tenant;
CREATE POLICY quiz_attempts_tenant ON quiz_attempts TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();

-- Capture configured quizzes on pre-existing releases once. Unconfigured legacy
-- quiz placeholders become usable after configuring and publishing a revision.
ALTER TABLE training_releases NO FORCE ROW LEVEL SECURITY;
ALTER TABLE quizzes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions NO FORCE ROW LEVEL SECURITY;

WITH quiz_definitions AS (
  SELECT q.tenant_id, q.id, jsonb_build_object(
    'selectionMode', q.selection_mode, 'randomCount', q.random_count,
    'timeLimitMinutes', q.time_limit_minutes, 'passingScore', q.passing_score,
    'maxAttempts', q.max_attempts, 'shuffleQuestions', q.shuffle_questions,
    'shuffleOptions', q.shuffle_options, 'showAnswers', q.show_answers,
    'questions', jsonb_agg(jsonb_build_object(
      'type', aq.type, 'prompt', aq.prompt, 'options', aq.options,
      'correctOptions', aq.correct_options, 'explanation', aq.explanation
    ) ORDER BY qq.position)
  ) AS definition
  FROM quizzes q
  JOIN quiz_questions qq ON qq.tenant_id = q.tenant_id AND qq.quiz_id = q.id
  JOIN assessment_questions aq ON aq.tenant_id = qq.tenant_id AND aq.id = qq.question_id
  WHERE q.selection_mode IS NOT NULL
  GROUP BY q.id
), release_quizzes AS (
  SELECT r.id, jsonb_object_agg(q.id::text, q.definition) AS definitions
  FROM training_releases r
  CROSS JOIN LATERAL jsonb_array_elements(r.content->'modules') AS m(value)
  CROSS JOIN LATERAL jsonb_array_elements(m.value->'lessons') AS l(value)
  JOIN quiz_definitions q ON q.tenant_id = r.tenant_id AND q.id::text = l.value->>'quizId'
  WHERE r.course_id IS NOT NULL
  GROUP BY r.id
)
UPDATE training_releases r
SET content = jsonb_set(r.content, '{quizDefinitions}', release_quizzes.definitions)
FROM release_quizzes WHERE r.id = release_quizzes.id;

ALTER TABLE training_releases FORCE ROW LEVEL SECURITY;
ALTER TABLE quizzes FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions FORCE ROW LEVEL SECURITY;

COMMIT;
