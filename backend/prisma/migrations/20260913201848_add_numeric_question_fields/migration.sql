-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "correctNumericValue" DECIMAL(10,4),
ADD COLUMN     "numericTolerance" DECIMAL(10,4) NOT NULL DEFAULT 0.0001;
