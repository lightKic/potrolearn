-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "assessments_isPublished_scheduledPublishAt_idx" ON "assessments"("isPublished", "scheduledPublishAt");

-- CreateIndex
CREATE INDEX "lessons_isPublished_scheduledPublishAt_idx" ON "lessons"("isPublished", "scheduledPublishAt");

-- CreateIndex
CREATE INDEX "modules_isPublished_scheduledPublishAt_idx" ON "modules"("isPublished", "scheduledPublishAt");
