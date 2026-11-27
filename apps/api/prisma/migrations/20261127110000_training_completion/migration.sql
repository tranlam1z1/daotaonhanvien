CREATE TYPE "TrainingLearningMode" AS ENUM ('SEQUENTIAL', 'FREE');

ALTER TABLE "training_courses"
  ADD COLUMN "completion" JSONB,
  ADD COLUMN "learning_mode" "TrainingLearningMode" NOT NULL DEFAULT 'SEQUENTIAL';
