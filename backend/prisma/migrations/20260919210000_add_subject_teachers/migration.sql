-- CreateTable
CREATE TABLE "subject_teachers" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_teachers_subjectId_idx" ON "subject_teachers"("subjectId");

-- CreateIndex
CREATE INDEX "subject_teachers_teacherId_idx" ON "subject_teachers"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_teachers_subjectId_teacherId_key" ON "subject_teachers"("subjectId", "teacherId");

-- AddForeignKey
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed initial subject_teachers from existing course_teachers
INSERT INTO "subject_teachers" ("id", "subjectId", "teacherId", "assignedAt")
SELECT DISTINCT
    gen_random_uuid(),
    c."subjectId",
    ct."teacherId",
    MIN(ct."assignedAt")
FROM "course_teachers" ct
JOIN "courses" c ON ct."courseId" = c."id"
GROUP BY c."subjectId", ct."teacherId"
ON CONFLICT ("subjectId", "teacherId") DO NOTHING;
