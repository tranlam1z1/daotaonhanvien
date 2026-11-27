ALTER TABLE "training_programs" ADD COLUMN "template_source" JSONB;
ALTER TABLE "training_courses" ADD COLUMN "template_source" JSONB;
ALTER TABLE "training_modules" ADD COLUMN "template_source" JSONB;
ALTER TABLE "training_lessons" ADD COLUMN "template_source" JSONB;

ALTER TABLE "program_courses" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
GRANT UPDATE ("position") ON "program_courses" TO educore36_tenant;
WITH ordered AS (
  SELECT "tenant_id", "program_id", "course_id",
         ROW_NUMBER() OVER (PARTITION BY "tenant_id", "program_id" ORDER BY "course_id") - 1 AS position
  FROM "program_courses"
)
UPDATE "program_courses" AS pc
SET "position" = ordered.position
FROM ordered
WHERE pc."tenant_id" = ordered."tenant_id"
  AND pc."program_id" = ordered."program_id"
  AND pc."course_id" = ordered."course_id";

CREATE FUNCTION mark_training_template_customized() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  field TEXT;
  previous JSONB := to_jsonb(OLD);
  updated JSONB := to_jsonb(NEW);
BEGIN
  IF OLD.template_source IS NULL OR OLD.template_source->>'customized' = 'true' THEN
    RETURN NEW;
  END IF;

  FOREACH field IN ARRAY TG_ARGV LOOP
    IF previous->field IS DISTINCT FROM updated->field THEN
      NEW.template_source = jsonb_set(OLD.template_source, '{customized}', 'true');
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_training_program_customization
BEFORE UPDATE ON "training_programs"
FOR EACH ROW EXECUTE FUNCTION mark_training_template_customized(
  'name', 'description', 'audience', 'type', 'target_duration', 'target_unit'
);

CREATE TRIGGER track_training_course_customization
BEFORE UPDATE ON "training_courses"
FOR EACH ROW EXECUTE FUNCTION mark_training_template_customized(
  'name', 'description', 'completion', 'learning_mode'
);

CREATE TRIGGER track_training_module_customization
BEFORE UPDATE ON "training_modules"
FOR EACH ROW EXECUTE FUNCTION mark_training_template_customized('name', 'position');

CREATE TRIGGER track_training_lesson_customization
BEFORE UPDATE ON "training_lessons"
FOR EACH ROW EXECUTE FUNCTION mark_training_template_customized(
  'name', 'position', 'duration_minutes', 'type', 'body', 'video_url', 'file_id', 'knowledge_id', 'quiz_id'
);

CREATE FUNCTION mark_template_parent_customized() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  child RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    child := OLD;
  ELSE
    child := NEW;
  END IF;

  IF TG_TABLE_NAME = 'program_courses' THEN
    UPDATE "training_programs"
    SET "template_source" = jsonb_set("template_source", '{customized}', 'true')
    WHERE "tenant_id" = child.tenant_id AND "id" = child.program_id
      AND "template_source"->>'customized' = 'false';
  ELSIF TG_TABLE_NAME = 'training_modules' THEN
    UPDATE "training_courses"
    SET "template_source" = jsonb_set("template_source", '{customized}', 'true')
    WHERE "tenant_id" = child.tenant_id AND "id" = child.course_id
      AND "template_source"->>'customized' = 'false';
  ELSIF TG_TABLE_NAME = 'training_lessons' THEN
    UPDATE "training_modules"
    SET "template_source" = jsonb_set("template_source", '{customized}', 'true')
    WHERE "tenant_id" = child.tenant_id AND "id" = child.module_id
      AND "template_source"->>'customized' = 'false';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER track_program_course_membership
AFTER INSERT OR DELETE ON "program_courses"
FOR EACH ROW EXECUTE FUNCTION mark_template_parent_customized();

CREATE TRIGGER track_program_course_order
AFTER UPDATE OF "position" ON "program_courses"
FOR EACH ROW WHEN (OLD."position" IS DISTINCT FROM NEW."position")
EXECUTE FUNCTION mark_template_parent_customized();

CREATE TRIGGER track_course_module_membership
AFTER INSERT OR DELETE ON "training_modules"
FOR EACH ROW EXECUTE FUNCTION mark_template_parent_customized();

CREATE TRIGGER track_module_lesson_membership
AFTER INSERT OR DELETE ON "training_lessons"
FOR EACH ROW EXECUTE FUNCTION mark_template_parent_customized();

CREATE TRIGGER track_course_module_order
AFTER UPDATE OF "position" ON "training_modules"
FOR EACH ROW WHEN (OLD."position" IS DISTINCT FROM NEW."position")
EXECUTE FUNCTION mark_template_parent_customized();

CREATE TRIGGER track_module_lesson_order
AFTER UPDATE OF "position" ON "training_lessons"
FOR EACH ROW WHEN (OLD."position" IS DISTINCT FROM NEW."position")
EXECUTE FUNCTION mark_template_parent_customized();
