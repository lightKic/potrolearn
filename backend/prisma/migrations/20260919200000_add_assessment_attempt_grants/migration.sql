-- CreateTable
CREATE TABLE "assessment_attempt_grants" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_attempt_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_attempt_grants_studentId_assessmentId_idx" ON "assessment_attempt_grants"("studentId", "assessmentId");

-- CreateIndex
CREATE INDEX "assessment_attempt_grants_assessmentId_idx" ON "assessment_attempt_grants"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_attempt_grants_grantedById_idx" ON "assessment_attempt_grants"("grantedById");

-- AddForeignKey
ALTER TABLE "assessment_attempt_grants" ADD CONSTRAINT "assessment_attempt_grants_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempt_grants" ADD CONSTRAINT "assessment_attempt_grants_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempt_grants" ADD CONSTRAINT "assessment_attempt_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
