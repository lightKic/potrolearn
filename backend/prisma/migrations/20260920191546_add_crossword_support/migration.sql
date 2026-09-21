-- AlterEnum
ALTER TYPE "AssessmentType" ADD VALUE 'CROSSWORD';

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'CROSSWORD_CLUE';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "crosswordLayout" JSONB;
