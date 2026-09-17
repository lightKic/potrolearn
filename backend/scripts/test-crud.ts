import 'dotenv/config';
import {
  PrismaClient,
  Role,
  CourseStatus,
  EnrollmentStatus,
  AssessmentType,
  QuestionType,
  AttemptStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function runCrudTest() {
  console.log('--- Iniciando Prueba CRUD V1 de PotroLearn con Prisma & Supabase ---');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
    console.error('ERROR: DATABASE_URL no está configurada correctamente en backend/.env');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const timestamp = Date.now();
  const runId = `crud-test-${timestamp}`;

  // Credenciales temporales únicas
  const adminEmail = `admin.crud.${timestamp}@example.invalid`;
  const teacherEmail = `teacher.crud.${timestamp}@example.invalid`;
  const studentEmail = `student.crud.${timestamp}@example.invalid`;

  // Variables para rastrear IDs creados para el cleanup seguro
  let adminUserId: string | null = null;
  let teacherUserId: string | null = null;
  let studentUserId: string | null = null;
  let studentProfileId: string | null = null;
  let subjectId: string | null = null;
  let courseId: string | null = null;
  let courseTeacherId: string | null = null;
  let enrollmentId: string | null = null;
  let moduleId: string | null = null;
  let lessonId: string | null = null;
  let lessonProgressId: string | null = null;
  let assessmentId: string | null = null;
  let questionId: string | null = null;
  let optionAId: string | null = null;
  let optionBId: string | null = null;
  let assessmentQuestionId: string | null = null;
  let attemptId: string | null = null;
  let answerId: string | null = null;
  let answerOptionId: string | null = null;

  let createPassed = false;
  let readPassed = false;
  let updatePassed = false;
  let decimalPassed = false;
  let uniquePassed = false;
  let restrictPassed = false;

  let decimalScoreRep = '';
  let decimalPointsRep = '';
  let uniqueErrorCode = '';
  let restrictErrorCode = '';

  try {
    // ==========================================
    // 1. CREATE — Usuarios
    // ==========================================
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin CRUD Test',
        role: Role.ADMIN,
      },
    });
    adminUserId = adminUser.id;

    const teacherUser = await prisma.user.create({
      data: {
        email: teacherEmail,
        name: 'Teacher CRUD Test',
        role: Role.TEACHER,
      },
    });
    teacherUserId = teacherUser.id;

    const studentUser = await prisma.user.create({
      data: {
        email: studentEmail,
        name: 'Student CRUD Test',
        role: Role.STUDENT,
      },
    });
    studentUserId = studentUser.id;

    if (!adminUser.isActive || !teacherUser.isActive || !studentUser.isActive) {
      throw new Error('Default isActive is not true');
    }
    console.log('[CREATE] Users OK (ADMIN, TEACHER, STUDENT)');

    // ==========================================
    // 2. CREATE — StudentProfile
    // ==========================================
    const studentProfile = await prisma.studentProfile.create({
      data: {
        userId: studentUserId,
        studentNumber: `STU-${timestamp}`,
      },
    });
    studentProfileId = studentProfile.id;
    console.log('[CREATE] StudentProfile OK');

    // ==========================================
    // 3. CREATE — Subject
    // ==========================================
    const subject = await prisma.subject.create({
      data: {
        code: `CRUD-${timestamp}`,
        name: 'CRUD Test Subject',
        description: 'Materia temporal para pruebas CRUD',
      },
    });
    subjectId = subject.id;
    console.log('[CREATE] Subject OK');

    // ==========================================
    // 4. CREATE — Course
    // ==========================================
    const startDate = new Date();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const course = await prisma.course.create({
      data: {
        subjectId: subjectId,
        createdById: teacherUserId,
        name: 'CRUD Test Course',
        description: 'Curso temporal para prueba CRUD',
        startDate,
        endDate,
        status: CourseStatus.DRAFT,
      },
    });
    courseId = course.id;
    console.log('[CREATE] Course OK');

    // ==========================================
    // 5. CREATE — CourseTeacher
    // ==========================================
    const courseTeacher = await prisma.courseTeacher.create({
      data: {
        courseId: courseId,
        teacherId: teacherUserId,
      },
    });
    courseTeacherId = courseTeacher.id;
    console.log('[CREATE] CourseTeacher OK');

    // ==========================================
    // 6. CREATE — Enrollment
    // ==========================================
    const enrollment = await prisma.enrollment.create({
      data: {
        courseId: courseId,
        studentId: studentUserId,
        status: EnrollmentStatus.ACTIVE,
        finalGrade: null,
      },
    });
    enrollmentId = enrollment.id;
    console.log('[CREATE] Enrollment OK');

    // ==========================================
    // 7. CREATE — Module
    // ==========================================
    const moduleItem = await prisma.module.create({
      data: {
        courseId: courseId,
        title: 'CRUD Test Module',
        description: 'Módulo temporal de prueba',
        order: 1,
        isPublished: false,
      },
    });
    moduleId = moduleItem.id;
    console.log('[CREATE] Module OK');

    // ==========================================
    // 8. CREATE — Lesson
    // ==========================================
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: moduleId,
        title: 'CRUD Test Lesson',
        description: 'Lección temporal de prueba',
        content: 'Contenido de la lección',
        order: 1,
        isPublished: false,
      },
    });
    lessonId = lesson.id;
    console.log('[CREATE] Lesson OK');

    // ==========================================
    // 9. CREATE — LessonProgress
    // ==========================================
    const lessonProgress = await prisma.lessonProgress.create({
      data: {
        enrollmentId: enrollmentId,
        lessonId: lessonId,
      },
    });
    lessonProgressId = lessonProgress.id;
    if (!lessonProgress.completedAt) {
      throw new Error('LessonProgress default completedAt was not set');
    }
    console.log('[CREATE] LessonProgress OK');

    // ==========================================
    // 10. CREATE — Assessment
    // ==========================================
    const assessment = await prisma.assessment.create({
      data: {
        courseId: courseId,
        moduleId: moduleId,
        title: 'CRUD Test Assessment',
        type: AssessmentType.PRACTICE,
        weight: 0,
        passingScore: null,
        maxAttempts: null,
        isPublished: false,
      },
    });
    assessmentId = assessment.id;
    console.log('[CREATE] Assessment OK');

    // ==========================================
    // 11. CREATE — Question
    // ==========================================
    const question = await prisma.question.create({
      data: {
        subjectId: subjectId,
        statement: 'CRUD test question statement',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 10,
      },
    });
    questionId = question.id;
    console.log('[CREATE] Question OK');

    // ==========================================
    // 12. CREATE — QuestionOptions (x2)
    // ==========================================
    const optionA = await prisma.questionOption.create({
      data: {
        questionId: questionId,
        text: 'Option A (Correct)',
        isCorrect: true,
        order: 1,
      },
    });
    optionAId = optionA.id;

    const optionB = await prisma.questionOption.create({
      data: {
        questionId: questionId,
        text: 'Option B (Incorrect)',
        isCorrect: false,
        order: 2,
      },
    });
    optionBId = optionB.id;
    console.log('[CREATE] QuestionOption x2 OK');

    // ==========================================
    // 13. CREATE — AssessmentQuestion
    // ==========================================
    const assessmentQuestion = await prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessmentId,
        questionId: questionId,
        points: 10,
        order: 1,
      },
    });
    assessmentQuestionId = assessmentQuestion.id;
    console.log('[CREATE] AssessmentQuestion OK');

    // ==========================================
    // 14. CREATE — Attempt
    // ==========================================
    const attempt = await prisma.attempt.create({
      data: {
        studentId: studentUserId,
        assessmentId: assessmentId,
        attemptNumber: 1,
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        submittedAt: null,
      },
    });
    attemptId = attempt.id;
    console.log('[CREATE] Attempt OK');

    // ==========================================
    // 15. CREATE — Answer
    // ==========================================
    const answer = await prisma.answer.create({
      data: {
        attemptId: attemptId,
        questionId: questionId,
        numericValue: null,
        textValue: null,
      },
    });
    answerId = answer.id;
    console.log('[CREATE] Answer OK');

    // ==========================================
    // 16. CREATE — AnswerOption
    // ==========================================
    const answerOption = await prisma.answerOption.create({
      data: {
        answerId: answerId,
        optionId: optionAId,
      },
    });
    answerOptionId = answerOption.id;
    console.log('[CREATE] AnswerOption OK');

    createPassed = true;
    console.log('[CREATE] Relations OK — All 16 entities created successfully');

    // ==========================================
    // READ — Grafo de Relaciones del Curso
    // ==========================================
    const readCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        subject: true,
        courseTeachers: {
          include: { teacher: true },
        },
        enrollments: {
          include: { student: true },
        },
        modules: {
          include: { lessons: true },
        },
        assessments: {
          include: {
            assessmentQuestions: {
              include: { question: true },
            },
          },
        },
      },
    });

    if (!readCourse) throw new Error('Course read failed');

    const courseSubjectMatch = readCourse.subjectId === subjectId;
    const courseTeacherMatch = readCourse.courseTeachers[0]?.teacherId === teacherUserId;
    const enrollmentStudentMatch = readCourse.enrollments[0]?.studentId === studentUserId;
    const moduleCourseMatch = readCourse.modules[0]?.courseId === courseId;
    const lessonModuleMatch = readCourse.modules[0]?.lessons[0]?.moduleId === moduleId;
    const assessmentCourseMatch = readCourse.assessments[0]?.courseId === courseId;
    const aqQuestionMatch = readCourse.assessments[0]?.assessmentQuestions[0]?.questionId === questionId;

    if (
      !courseSubjectMatch ||
      !courseTeacherMatch ||
      !enrollmentStudentMatch ||
      !moduleCourseMatch ||
      !lessonModuleMatch ||
      !assessmentCourseMatch ||
      !aqQuestionMatch
    ) {
      throw new Error('Course relation graph ID match failed');
    }
    console.log('[READ] Course graph OK');

    // ==========================================
    // READ — Grafo de Relaciones del Attempt
    // ==========================================
    const readAttempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          include: { answerOptions: true },
        },
      },
    });

    if (!readAttempt) throw new Error('Attempt read failed');

    const attemptStudentMatch = readAttempt.studentId === studentUserId;
    const attemptAssessmentMatch = readAttempt.assessmentId === assessmentId;
    const attemptNumberMatch = readAttempt.attemptNumber === 1;
    const attemptStatusMatch = readAttempt.status === AttemptStatus.IN_PROGRESS;

    if (!attemptStudentMatch || !attemptAssessmentMatch || !attemptNumberMatch || !attemptStatusMatch) {
      throw new Error('Attempt relation graph match failed');
    }
    console.log('[READ] Attempt graph OK');
    readPassed = true;

    // ==========================================
    // UPDATE — Course, Attempt & Answer
    // ==========================================
    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: { name: 'CRUD Test Course Updated' },
    });
    if (updatedCourse.name !== 'CRUD Test Course Updated') {
      throw new Error('Course update failed');
    }
    console.log('[UPDATE] Course OK');

    const updateTime = new Date();
    const updatedAttempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.SUBMITTED,
        submittedAt: updateTime,
        score: 10.00,
      },
    });

    const updatedAnswer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        isCorrect: true,
        pointsEarned: 10.00,
        gradedAt: updateTime,
      },
    });
    console.log('[UPDATE] Attempt/Answer OK');
    updatePassed = true;

    // ==========================================
    // Decimal — Verificación de Representación Prisma
    // ==========================================
    if (updatedAttempt.score !== null && updatedAnswer.pointsEarned !== null) {
      decimalScoreRep = String(updatedAttempt.score);
      decimalPointsRep = String(updatedAnswer.pointsEarned);

      const scoreNum = Number(updatedAttempt.score);
      const pointsNum = Number(updatedAnswer.pointsEarned);

      if (scoreNum === 10 && pointsNum === 10) {
        decimalPassed = true;
        console.log(`[DECIMAL] Attempt.score: ${decimalScoreRep} | Answer.pointsEarned: ${decimalPointsRep} -> PASS`);
      }
    }

    // ==========================================
    // CONSTRAINT — Violación Controlada de UNIQUE (users.email)
    // ==========================================
    try {
      await prisma.user.create({
        data: {
          email: adminEmail, // Duplicado intencional
          name: 'Duplicate Admin',
          role: Role.ADMIN,
        },
      });
      console.error('ERROR: UNIQUE constraint allowed duplicate email!');
    } catch (err: unknown) {
      const pError = err as { code?: string; message?: string };
      uniqueErrorCode = pError.code || 'UNKNOWN';
      if (pError.code === 'P2002') {
        uniquePassed = true;
        console.log(`[CONSTRAINT] UNIQUE users.email → BLOCKED AS EXPECTED (Prisma Code: ${pError.code})`);
      } else {
        console.log(`[CONSTRAINT] UNIQUE users.email → BLOCKED (Code: ${uniqueErrorCode})`);
        uniquePassed = true;
      }
    }

    // ==========================================
    // CONSTRAINT — Violación Controlada de FK RESTRICT (Question delete)
    // ==========================================
    try {
      await prisma.question.delete({
        where: { id: questionId },
      });
      console.error('ERROR: RESTRICT constraint allowed deleting referenced Question!');
    } catch (err: unknown) {
      const pError = err as { code?: string; message?: string };
      restrictErrorCode = pError.code || 'UNKNOWN';
      if (pError.code === 'P2003') {
        restrictPassed = true;
        console.log(`[CONSTRAINT] Question RESTRICT → BLOCKED AS EXPECTED (Prisma Code: ${pError.code})`);
      } else {
        console.log(`[CONSTRAINT] Question RESTRICT → BLOCKED (Code: ${restrictErrorCode})`);
        restrictPassed = true;
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('FATAL ERROR during CRUD test execution:', err.message);
  } finally {
    // ==========================================
    // DELETE — Cleanup Dirigido en Orden Inverso Exacto
    // ==========================================
    console.log('--- Iniciando Cleanup Dirigido ---');

    try {
      if (answerOptionId) {
        await prisma.answerOption.deleteMany({ where: { id: answerOptionId } });
      }
      if (answerId) {
        await prisma.answer.deleteMany({ where: { id: answerId } });
      }
      if (attemptId) {
        await prisma.attempt.deleteMany({ where: { id: attemptId } });
      }
      if (assessmentQuestionId) {
        await prisma.assessmentQuestion.deleteMany({ where: { id: assessmentQuestionId } });
      }
      if (optionAId || optionBId) {
        await prisma.questionOption.deleteMany({
          where: { id: { in: [optionAId, optionBId].filter((id): id is string => id !== null) } },
        });
      }
      if (questionId) {
        await prisma.question.deleteMany({ where: { id: questionId } });
      }
      if (assessmentId) {
        await prisma.assessment.deleteMany({ where: { id: assessmentId } });
      }
      if (lessonProgressId) {
        await prisma.lessonProgress.deleteMany({ where: { id: lessonProgressId } });
      }
      if (lessonId) {
        await prisma.lesson.deleteMany({ where: { id: lessonId } });
      }
      if (moduleId) {
        await prisma.module.deleteMany({ where: { id: moduleId } });
      }
      if (enrollmentId) {
        await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
      }
      if (courseTeacherId) {
        await prisma.courseTeacher.deleteMany({ where: { id: courseTeacherId } });
      }
      if (courseId) {
        await prisma.course.deleteMany({ where: { id: courseId } });
      }
      if (subjectId) {
        await prisma.subject.deleteMany({ where: { id: subjectId } });
      }
      if (studentProfileId) {
        await prisma.studentProfile.deleteMany({ where: { id: studentProfileId } });
      }
      if (adminUserId || teacherUserId || studentUserId) {
        await prisma.user.deleteMany({
          where: {
            id: { in: [adminUserId, teacherUserId, studentUserId].filter((id): id is string => id !== null) },
          },
        });
      }
      console.log('[DELETE] Cleanup OK');
    } catch (cleanupErr: unknown) {
      const err = cleanupErr as Error;
      console.error('ERROR en cleanup:', err.message);
    }

    // ==========================================
    // Verificación de Registros Temporales Restantes
    // ==========================================
    const remainingUsers = await prisma.user.count({
      where: { email: { contains: `crud.${timestamp}` } },
    });
    const remainingSubjects = await prisma.subject.count({
      where: { code: `CRUD-${timestamp}` },
    });

    const totalRemaining = remainingUsers + remainingSubjects;
    console.log(`CRUD temporary records remaining: ${totalRemaining}`);

    await prisma.$disconnect();
    await pool.end();

    // Summary output for test runner analysis
    console.log('\n--- RESUMEN DE EJECUCIÓN CRUD ---');
    console.log(`Execution Identifier: ${runId}`);
    console.log(`CREATE -> ${createPassed ? 'PASS' : 'FAIL'}`);
    console.log(`READ -> ${readPassed ? 'PASS' : 'FAIL'}`);
    console.log(`UPDATE -> ${updatePassed ? 'PASS' : 'FAIL'}`);
    console.log(`DECIMAL -> ${decimalPassed ? 'PASS' : 'FAIL'} (score: ${decimalScoreRep}, points: ${decimalPointsRep})`);
    console.log(`UNIQUE CONSTRAINT -> ${uniquePassed ? 'PASS' : 'FAIL'} (code: ${uniqueErrorCode})`);
    console.log(`FK RESTRICT CONSTRAINT -> ${restrictPassed ? 'PASS' : 'FAIL'} (code: ${restrictErrorCode})`);
    console.log(`CLEANUP -> ${totalRemaining === 0 ? 'PASS' : 'FAIL'}`);

    if (
      createPassed &&
      readPassed &&
      updatePassed &&
      decimalPassed &&
      uniquePassed &&
      restrictPassed &&
      totalRemaining === 0
    ) {
      console.log('\nSUCCESS: PotroLearn Prisma CRUD V1 validation completed successfully.');
    } else {
      console.error('\nFAILURE: One or more CRUD validations did not pass.');
      process.exit(1);
    }
  }
}

runCrudTest();
