-- CreateEnum
CREATE TYPE "TrainingProgramType" AS ENUM ('ONBOARDING', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "TrainingTargetUnit" AS ENUM ('DAYS', 'HOURS');

-- CreateEnum
CREATE TYPE "TrainingCourseStatus" AS ENUM ('DRAFT');

-- CreateEnum
CREATE TYPE "TrainingLessonType" AS ENUM ('TEXT', 'DOCUMENT', 'VIDEO', 'KNOWLEDGE', 'QUIZ');

-- CreateTable
CREATE TABLE "training_programs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "type" "TrainingProgramType" NOT NULL,
    "target_duration" INTEGER NOT NULL,
    "target_unit" "TrainingTargetUnit" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TrainingCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_courses" (
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,

    CONSTRAINT "program_courses_pkey" PRIMARY KEY ("tenant_id","program_id","course_id")
);

-- CreateTable
CREATE TABLE "training_modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "training_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_lessons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "type" "TrainingLessonType" NOT NULL,
    "body" TEXT,
    "video_url" TEXT,
    "file_id" UUID,
    "knowledge_id" UUID,
    "quiz_id" UUID,

    CONSTRAINT "training_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "name" TEXT NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_programs_tenant_id_id_key" ON "training_programs"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "training_courses_tenant_id_id_key" ON "training_courses"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "program_courses_tenant_id_course_id_idx" ON "program_courses"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "training_modules_tenant_id_course_id_position_idx" ON "training_modules"("tenant_id", "course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "training_modules_tenant_id_id_key" ON "training_modules"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "training_lessons_tenant_id_module_id_position_idx" ON "training_lessons"("tenant_id", "module_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "training_lessons_tenant_id_id_key" ON "training_lessons"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_tenant_id_id_key" ON "quizzes"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_courses" ADD CONSTRAINT "program_courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_courses" ADD CONSTRAINT "program_courses_tenant_id_program_id_fkey" FOREIGN KEY ("tenant_id", "program_id") REFERENCES "training_programs"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_courses" ADD CONSTRAINT "program_courses_tenant_id_course_id_fkey" FOREIGN KEY ("tenant_id", "course_id") REFERENCES "training_courses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_tenant_id_course_id_fkey" FOREIGN KEY ("tenant_id", "course_id") REFERENCES "training_courses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_tenant_id_module_id_fkey" FOREIGN KEY ("tenant_id", "module_id") REFERENCES "training_modules"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_tenant_id_file_id_fkey" FOREIGN KEY ("tenant_id", "file_id") REFERENCES "file_objects"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_tenant_id_knowledge_id_fkey" FOREIGN KEY ("tenant_id", "knowledge_id") REFERENCES "knowledge_items"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_tenant_id_quiz_id_fkey" FOREIGN KEY ("tenant_id", "quiz_id") REFERENCES "quizzes"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;


ALTER TABLE training_programs ADD CHECK (target_duration > 0);
ALTER TABLE training_modules ADD CHECK (position >= 0);
ALTER TABLE training_lessons ADD CHECK (position >= 0 AND duration_minutes > 0);
ALTER TABLE training_lessons ADD CHECK (
  num_nonnulls(body, video_url, file_id, knowledge_id, quiz_id) = 1
  AND CASE type
    WHEN 'TEXT' THEN body IS NOT NULL
    WHEN 'DOCUMENT' THEN file_id IS NOT NULL
    WHEN 'VIDEO' THEN file_id IS NOT NULL OR video_url IS NOT NULL
    WHEN 'KNOWLEDGE' THEN knowledge_id IS NOT NULL
    WHEN 'QUIZ' THEN quiz_id IS NOT NULL
  END
);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['training_programs', 'training_courses', 'program_courses', 'training_modules', 'training_lessons', 'quizzes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT ON %I TO educore36_tenant', table_name);
    EXECUTE format('CREATE POLICY training_tenant ON %I TO educore36_tenant USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
    EXECUTE format('CREATE TRIGGER immutable_tenant BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id()', table_name);
  END LOOP;
END $$;

GRANT INSERT, UPDATE ON training_programs, training_courses, training_modules, training_lessons TO educore36_tenant;
GRANT INSERT, DELETE ON program_courses TO educore36_tenant;
GRANT DELETE ON training_modules, training_lessons TO educore36_tenant;
