-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('DIAGNOSTIC', 'PRACTICE', 'QUIZ', 'EXAM', 'FINAL');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'NUMERIC', 'OPEN_TEXT');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_teachers" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "finalGrade" DECIMAL(5,2),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER,
    "passingScore" DECIMAL(5,2),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT,
    "statement" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "defaultPoints" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "explanation" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "points" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "numericValue" DECIMAL(10,4),
    "textValue" TEXT,
    "pointsEarned" DECIMAL(5,2),
    "isCorrect" BOOLEAN,
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_studentNumber_key" ON "student_profiles"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "courses_subjectId_idx" ON "courses"("subjectId");

-- CreateIndex
CREATE INDEX "courses_createdById_idx" ON "courses"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "course_teachers_courseId_teacherId_key" ON "course_teachers"("courseId", "teacherId");

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_courseId_idx" ON "enrollments"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_courseId_studentId_key" ON "enrollments"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "modules_courseId_idx" ON "modules"("courseId");

-- CreateIndex
CREATE INDEX "lessons_moduleId_idx" ON "lessons"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollmentId_lessonId_key" ON "lesson_progress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "assessments_courseId_idx" ON "assessments"("courseId");

-- CreateIndex
CREATE INDEX "assessments_moduleId_idx" ON "assessments"("moduleId");

-- CreateIndex
CREATE INDEX "assessments_lessonId_idx" ON "assessments"("lessonId");

-- CreateIndex
CREATE INDEX "questions_subjectId_idx" ON "questions"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_questions_assessmentId_questionId_key" ON "assessment_questions"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "attempts_studentId_idx" ON "attempts"("studentId");

-- CreateIndex
CREATE INDEX "attempts_assessmentId_idx" ON "attempts"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_studentId_assessmentId_attemptNumber_key" ON "attempts"("studentId", "assessmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "answers_attemptId_idx" ON "answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attemptId_questionId_key" ON "answers"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "answer_options_answerId_optionId_key" ON "answer_options"("answerId", "optionId");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_teachers" ADD CONSTRAINT "course_teachers_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_teachers" ADD CONSTRAINT "course_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

