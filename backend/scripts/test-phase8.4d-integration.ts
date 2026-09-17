import { Role, CourseStatus, EnrollmentStatus, QuestionType, AssessmentType, AttemptStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AttemptService } from '../src/services/attempt.service';

async function runPhase84dIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.4-D (SUBMIT & EXPIRATION ENGINE) ---\n');

  const createdUserIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdQuestionIds: string[] = [];

  try {
    // 1. SETUP DE DATOS TEMPORALES DE PRUEBA
    const timestamp = Date.now();
    const admin = await prisma.user.create({
      data: {
        name: 'Admin 84D Test',
        email: `admin84d_${timestamp}@potrolearn.edu.mx`,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(admin.id);

    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher 84D Test',
        email: `teacher84d_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacher.id);

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 84D',
        email: `studentA84d_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84DA${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentA.id);

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 84D',
        email: `studentB84d_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84DB${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentB.id);

    // Subject & Course
    const subject = await prisma.subject.create({
      data: {
        code: `SUB84D_${timestamp}`,
        name: 'Materia 8.4-D Test',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso 8.4-D Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    // Enrollments
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        studentId: studentA.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        studentId: studentB.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    // Questions
    const qMC = await prisma.question.create({
      data: {
        statement: '¿Cuál es la capital de México?',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 10,
        options: {
          create: [
            { text: 'CDMX', isCorrect: true, order: 1 },
            { text: 'Guadalajara', isCorrect: false, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMC.id);

    const qTF = await prisma.question.create({
      data: {
        statement: 'El agua hierve a 100°C',
        type: QuestionType.TRUE_FALSE,
        defaultPoints: 10,
        options: {
          create: [
            { text: 'Verdadero', isCorrect: true, order: 1 },
            { text: 'Falso', isCorrect: false, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qTF.id);

    const qOpen = await prisma.question.create({
      data: {
        statement: 'Explica el proceso de fotosíntesis',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 10,
      },
    });
    createdQuestionIds.push(qOpen.id);

    // Objective-Only Assessment
    const objAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Objetiva 8.4-D',
        type: AssessmentType.QUIZ,
        isPublished: true,
        passingScore: 70,
        timeLimitMinutes: 15,
      },
    });
    createdAssessmentIds.push(objAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qTF.id, points: 10, order: 2 },
    });

    console.log('✓ Setup de datos temporales completado exitosamente\n');

    // --- 2. PRUEBA DE SUBMIT NORMAL (OBJECTIVE-ONLY) ---
    console.log('--- 2. PRUEBA DE SUBMIT NORMAL (OBJECTIVE-ONLY) ---');
    const attempt1 = await AttemptService.startOrResumeAttempt(objAssessment.id, studentA.id);
    const mcCorrectOpt = qMC.options.find((o) => o.isCorrect)!;
    const tfCorrectOpt = qTF.options.find((o) => o.isCorrect)!;

    await AttemptService.saveAnswer(attempt1.id, qMC.id, studentA.id, { optionIds: [mcCorrectOpt.id] });
    await AttemptService.saveAnswer(attempt1.id, qTF.id, studentA.id, { optionIds: [tfCorrectOpt.id] });

    const submitResult1 = await AttemptService.submitAttempt(attempt1.id, studentA.id, Role.STUDENT);
    if (submitResult1.status !== AttemptStatus.GRADED) {
      throw new Error(`Se esperaba status GRADED y se obtuvo ${submitResult1.status}`);
    }
    if (!submitResult1.submittedAt) {
      throw new Error('submittedAt debería estar establecido tras el submit');
    }
    if (submitResult1.score !== 100.00) {
      throw new Error(`Se esperaba score 100.00 y se obtuvo ${submitResult1.score}`);
    }
    console.log('✓ Submit normal objetiva: status = GRADED, submittedAt persistido, score = 100.00 verificado\n');

    // --- 3. PRUEBA DE SUBMIT MIXTO (CON OPEN_TEXT) ---
    console.log('--- 3. PRUEBA DE SUBMIT MIXTO (CON OPEN_TEXT) ---');
    const mixedAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Mixta 8.4-D',
        type: AssessmentType.EXAM,
        isPublished: true,
        passingScore: 60,
      },
    });
    createdAssessmentIds.push(mixedAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: mixedAssessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: mixedAssessment.id, questionId: qOpen.id, points: 10, order: 2 },
    });

    const attemptMixed = await AttemptService.startOrResumeAttempt(mixedAssessment.id, studentA.id);
    const submitMixedResult = await AttemptService.submitAttempt(attemptMixed.id, studentA.id, Role.STUDENT);

    if (submitMixedResult.status !== AttemptStatus.SUBMITTED) {
      throw new Error(`Se esperaba status SUBMITTED para evaluación mixta y se obtuvo ${submitMixedResult.status}`);
    }
    if (submitMixedResult.score !== null) {
      throw new Error(`Se esperaba score null para evaluación con OPEN_TEXT y se obtuvo ${submitMixedResult.score}`);
    }
    console.log('✓ Submit de evaluación mixta: status = SUBMITTED, score = null verificado\n');

    // --- 4. PRUEBAS DE TIME LIMIT Y GRACE PERIOD (+30s) ---
    console.log('--- 4. PRUEBAS DE TIME LIMIT Y GRACE PERIOD (+30s) ---');
    
    const timedAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Con Tiempo 8.4-D',
        type: AssessmentType.QUIZ,
        isPublished: true,
        timeLimitMinutes: 10,
      },
    });
    createdAssessmentIds.push(timedAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: timedAssessment.id, questionId: qTF.id, points: 10, order: 1 },
    });

    // Caso A: Envío dentro del grace period (+15s después de hardExpiration)
    const attemptGrace = await AttemptService.startOrResumeAttempt(timedAssessment.id, studentA.id);
    const tenMinFifteenSecsAgo = new Date(Date.now() - (10 * 60 * 1000 + 15 * 1000));
    await prisma.attempt.update({
      where: { id: attemptGrace.id },
      data: { startedAt: tenMinFifteenSecsAgo },
    });

    const graceSubmitResult = await AttemptService.submitAttempt(attemptGrace.id, studentA.id, Role.STUDENT);
    if (graceSubmitResult.status !== AttemptStatus.GRADED) {
      throw new Error(`Se esperaba submit exitoso en grace period y se obtuvo status ${graceSubmitResult.status}`);
    }
    console.log('✓ Envío dentro del grace period de +30s (+15s tarde) -> Submit exitoso verificado');

    // Caso B: Envío expirado (> +30s después de hardExpiration)
    const attemptExpired = await AttemptService.startOrResumeAttempt(timedAssessment.id, studentB.id);
    const elevenMinAgo = new Date(Date.now() - (11 * 60 * 1000));
    await prisma.attempt.update({
      where: { id: attemptExpired.id },
      data: { startedAt: elevenMinAgo },
    });

    try {
      await AttemptService.submitAttempt(attemptExpired.id, studentB.id, Role.STUDENT);
      throw new Error('Debería haber fallado con ATTEMPT_EXPIRED');
    } catch (err: any) {
      if (err.code !== 'ATTEMPT_EXPIRED') {
        throw new Error(`Se esperaba error ATTEMPT_EXPIRED y se obtuvo: ${err.code}`);
      }
    }

    const dbExpiredAttempt = await prisma.attempt.findUnique({ where: { id: attemptExpired.id } });
    if (dbExpiredAttempt?.status !== AttemptStatus.GRADED || !dbExpiredAttempt.submittedAt) {
      throw new Error('El intento expirado debió quedar en estado GRADED con submittedAt registrado');
    }
    console.log('✓ Envío después de +30s -> Rechazado con ATTEMPT_EXPIRED y auto-submitted en BD verificado\n');

    // --- 5. PRUEBA DE availableUntil ---
    console.log('--- 5. PRUEBA DE REGLA availableUntil ---');
    const closedAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Cerrada',
        type: AssessmentType.QUIZ,
        isPublished: true,
        availableUntil: new Date(Date.now() - 3600 * 1000), // Cerró hace 1 hora
      },
    });
    createdAssessmentIds.push(closedAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: closedAssessment.id, questionId: qTF.id, points: 10, order: 1 },
    });

    const attemptInClosed = await prisma.attempt.create({
      data: {
        studentId: studentA.id,
        assessmentId: closedAssessment.id,
        attemptNumber: 1,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 1800 * 1000),
      },
    });

    const submitClosedResult = await AttemptService.submitAttempt(attemptInClosed.id, studentA.id, Role.STUDENT);
    if (submitClosedResult.status !== AttemptStatus.GRADED) {
      throw new Error('availableUntil no debió bloquear el submit de un intento existente');
    }
    console.log('✓ Confirmado: availableUntil NO bloquea el submit de un intento ya iniciado en progreso\n');

    // --- 6. PRUEBA DE AUTO-SUBMIT POR EXPIRACIÓN (submitExpiredAttempt) ---
    console.log('--- 6. PRUEBA DE AUTO-SUBMIT POR EXPIRACIÓN ---');
    const autoExpiredAttempt = await prisma.attempt.create({
      data: {
        studentId: studentA.id,
        assessmentId: timedAssessment.id,
        attemptNumber: 2,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 2 * 3600 * 1000), // Hace 2 horas
      },
    });

    const autoExpiredResult = await AttemptService.submitExpiredAttempt(autoExpiredAttempt.id);
    if (autoExpiredResult.status !== AttemptStatus.GRADED || !autoExpiredResult.submittedAt) {
      throw new Error('submitExpiredAttempt debió autocalificar y marcar submittedAt');
    }
    console.log('✓ Método submitExpiredAttempt autocalificó intento expirado exitosamente\n');

    // --- 7. PRUEBA DE IDEMPOTENCIA EN SUBMIT ---
    console.log('--- 7. PRUEBA DE IDEMPOTENCIA EN SUBMIT ---');
    const idempotenceResult1 = await AttemptService.submitAttempt(attempt1.id, studentA.id, Role.STUDENT);
    const idempotenceResult2 = await AttemptService.submitAttempt(attempt1.id, studentA.id, Role.STUDENT);

    const time1 = idempotenceResult1.submittedAt ? new Date(idempotenceResult1.submittedAt).getTime() : null;
    const time2 = idempotenceResult2.submittedAt ? new Date(idempotenceResult2.submittedAt).getTime() : null;

    if (
      idempotenceResult1.status !== idempotenceResult2.status ||
      idempotenceResult1.score !== idempotenceResult2.score ||
      time1 !== time2
    ) {
      throw new Error('Submit no fue idempotente: resultados difieren en invocaciones subsecuentes');
    }
    console.log('✓ Idempotencia de submit comprobada: múltiples llamadas devuelven idéntico DTO\n');

    // --- 8. PRUEBAS DE SEGURIDAD Y AUTORIZACIÓN ---
    console.log('--- 8. PRUEBAS DE SEGURIDAD Y AUTORIZACIÓN ---');
    const attemptForSec = await AttemptService.startOrResumeAttempt(objAssessment.id, studentB.id);

    try {
      await AttemptService.submitAttempt(attemptForSec.id, studentA.id, Role.STUDENT);
      throw new Error('Estudiante no propietario debió ser rechazado');
    } catch (err: any) {
      if (err.code !== 'ATTEMPT_ACCESS_DENIED') {
        throw new Error(`Se esperaba ATTEMPT_ACCESS_DENIED y se obtuvo: ${err.code}`);
      }
    }

    try {
      await AttemptService.submitAttempt(attemptForSec.id, teacher.id, Role.TEACHER);
      throw new Error('Rol TEACHER debió ser rechazado en endpoint de submit de estudiante');
    } catch (err: any) {
      if (err.code !== 'ONLY_STUDENTS_CAN_SUBMIT') {
        throw new Error(`Se esperaba ONLY_STUDENTS_CAN_SUBMIT y se obtuvo: ${err.code}`);
      }
    }
    console.log('✓ Control de acceso de propiedad y roles verificado exitosamente\n');

    // --- 9. PRUEBA DE CONCURRENCIA EN SUBMIT ---
    console.log('--- 9. PRUEBA DE CONCURRENCIA ATÓMICA DE SUBMIT (pg_advisory_xact_lock) ---');
    const concAttempt = await AttemptService.startOrResumeAttempt(objAssessment.id, studentA.id);

    console.log('Disparando 10 peticiones simultáneas de submitAttempt sobre el mismo intento...');
    const concPromises = Array.from({ length: 10 }).map(() =>
      AttemptService.submitAttempt(concAttempt.id, studentA.id, Role.STUDENT)
    );

    const concResults = await Promise.all(concPromises);
    const firstStatus = concResults[0].status;
    const firstScore = concResults[0].score;

    for (const r of concResults) {
      if (r.status !== firstStatus || r.score !== firstScore) {
        throw new Error('Divergencia en peticiones concurrentes de submit');
      }
    }
    console.log('✓ Concurrencia atómica de submit verificada: 10 solicitudes finalizaron limpiamente con resultado consistente\n');

    console.log('=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.4-D PASARON! 🟢');
    console.log('=======================================================\n');

  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 8.4-D:', error);
    process.exit(1);
  } finally {
    console.log('--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    // Teardown
    if (createdAssessmentIds.length > 0) {
      const attempts = await prisma.attempt.findMany({
        where: { assessmentId: { in: createdAssessmentIds } },
        select: { id: true },
      });
      const attemptIds = attempts.map((a) => a.id);

      if (attemptIds.length > 0) {
        const answers = await prisma.answer.findMany({
          where: { attemptId: { in: attemptIds } },
          select: { id: true },
        });
        const answerIds = answers.map((ans) => ans.id);

        if (answerIds.length > 0) {
          await prisma.answerOption.deleteMany({ where: { answerId: { in: answerIds } } });
          await prisma.answer.deleteMany({ where: { id: { in: answerIds } } });
        }
        await prisma.attempt.deleteMany({ where: { id: { in: attemptIds } } });
      }

      await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: { in: createdAssessmentIds } } });
      if (createdQuestionIds.length > 0) {
        await prisma.questionOption.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
        await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
      }

      await prisma.assessment.deleteMany({ where: { id: { in: createdAssessmentIds } } });
    }

    if (createdCourseIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
      await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    }

    if (createdSubjectIds.length > 0) {
      await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
    }

    if (createdUserIds.length > 0) {
      await prisma.studentProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    const remainingAttempts = await prisma.attempt.count({ where: { id: { in: createdUserIds } } });
    const remainingUsers = await prisma.user.count({ where: { id: { in: createdUserIds } } });

    console.log(`✓ Teardown completado. Registros temporales restantes: Attempts=${remainingAttempts}, Users=${remainingUsers}\n`);
    await prisma.$disconnect();
  }
}

runPhase84dIntegrationTests();
