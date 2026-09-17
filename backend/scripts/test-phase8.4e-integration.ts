import { Role, CourseStatus, EnrollmentStatus, QuestionType, AssessmentType, AttemptStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AttemptService } from '../src/services/attempt.service';

async function runPhase84eIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.4-E (MANUAL GRADING & TEACHER REVIEW) ---\n');

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
        name: 'Admin 84E Test',
        email: `admin84e_${timestamp}@potrolearn.edu.mx`,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(admin.id);

    const teacher1 = await prisma.user.create({
      data: {
        name: 'Teacher 1 Assigned 84E',
        email: `teacher1_84e_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacher1.id);

    const teacher2 = await prisma.user.create({
      data: {
        name: 'Teacher 2 Unassigned 84E',
        email: `teacher2_84e_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacher2.id);

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 84E',
        email: `studentA84e_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84EA${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentA.id);

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 84E',
        email: `studentB84e_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84EB${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentB.id);

    // Subject & Course
    const subject = await prisma.subject.create({
      data: {
        code: `SUB84E_${timestamp}`,
        name: 'Materia 8.4-E Test',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso 8.4-E Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    // Assign Teacher 1 to Course
    await prisma.courseTeacher.create({
      data: {
        courseId: course.id,
        teacherId: teacher1.id,
      },
    });

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

    // Questions (1 MC, 2 OPEN_TEXT)
    const qMC = await prisma.question.create({
      data: {
        statement: 'Pregunta MC (10 pts)',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 10,
        options: {
          create: [
            { text: 'Opción Correcta', isCorrect: true, order: 1 },
            { text: 'Opción Incorrecta', isCorrect: false, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMC.id);

    const qOpen1 = await prisma.question.create({
      data: {
        statement: 'Pregunta Abierta 1 (10 pts)',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 10,
      },
    });
    createdQuestionIds.push(qOpen1.id);

    const qOpen2 = await prisma.question.create({
      data: {
        statement: 'Pregunta Abierta 2 (10 pts)',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 10,
      },
    });
    createdQuestionIds.push(qOpen2.id);

    // Mixed Assessment (30 total points, passing score = 70.0)
    const assessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación 8.4-E Manual Grading',
        type: AssessmentType.EXAM,
        isPublished: true,
        passingScore: 70,
      },
    });
    createdAssessmentIds.push(assessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: assessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: assessment.id, questionId: qOpen1.id, points: 10, order: 2 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: assessment.id, questionId: qOpen2.id, points: 10, order: 3 },
    });

    console.log('✓ Setup de datos temporales completado exitosamente\n');

    // --- 2. PRUEBAS DE AUTORIZACIÓN PARA LISTAR E INSPECCIONAR INTENTOS ---
    console.log('--- 2. PRUEBAS DE AUTORIZACIÓN PARA LISTAR E INSPECCIONAR INTENTOS ---');
    
    // Iniciar y enviar un intento por Student A
    const attemptA = await AttemptService.startOrResumeAttempt(assessment.id, studentA.id);
    const mcOpt = qMC.options.find((o) => o.isCorrect)!;
    await AttemptService.saveAnswer(attemptA.id, qMC.id, studentA.id, { optionIds: [mcOpt.id] });
    await AttemptService.saveAnswer(attemptA.id, qOpen1.id, studentA.id, { textValue: 'Respuesta abierta 1...' });
    await AttemptService.saveAnswer(attemptA.id, qOpen2.id, studentA.id, { textValue: 'Respuesta abierta 2...' });
    await AttemptService.submitAttempt(attemptA.id, studentA.id, Role.STUDENT);

    // Listar intentos como Admin
    const adminList = await AttemptService.getAssessmentAttemptsForReview(assessment.id, admin.id, Role.ADMIN);
    if (adminList.length !== 1 || adminList[0].pendingOpenTextCount !== 2) {
      throw new Error('Admin debió poder listar el intento con 2 OPEN_TEXT pendientes');
    }

    // Listar intentos como Teacher 1 (asignado)
    const teacher1List = await AttemptService.getAssessmentAttemptsForReview(assessment.id, teacher1.id, Role.TEACHER);
    if (teacher1List.length !== 1) {
      throw new Error('Teacher 1 asignado debió listar 1 intento');
    }

    // Rechazo a Teacher 2 (no asignado)
    try {
      await AttemptService.getAssessmentAttemptsForReview(assessment.id, teacher2.id, Role.TEACHER);
      throw new Error('Teacher 2 no asignado debió ser rechazado');
    } catch (err: any) {
      if (err.code !== 'COURSE_ACCESS_DENIED') {
        throw new Error(`Se esperaba COURSE_ACCESS_DENIED y se obtuvo ${err.code}`);
      }
    }

    // Rechazo a Student A
    try {
      await AttemptService.getAssessmentAttemptsForReview(assessment.id, studentA.id, Role.STUDENT);
      throw new Error('Estudiante debió ser rechazado');
    } catch (err: any) {
      if (err.code !== 'ONLY_TEACHERS_OR_ADMINS_CAN_REVIEW') {
        throw new Error(`Se esperaba ONLY_TEACHERS_OR_ADMINS_CAN_REVIEW y se obtuvo ${err.code}`);
      }
    }
    console.log('✓ Autorización de listado por roles verificado exitosamente\n');

    // --- 3. PRUEBA DE RESTRICCIÓN DE TIPO DE PREGUNTA EN GRADING ---
    console.log('--- 3. PRUEBA DE RESTRICCIÓN DE TIPO DE PREGUNTA ---');
    try {
      await AttemptService.gradeAnswer(attemptA.id, qMC.id, teacher1.id, Role.TEACHER, { pointsEarned: 10 }, []);
      throw new Error('No se debió permitir calificación manual sobre pregunta MC');
    } catch (err: any) {
      if (err.code !== 'QUESTION_NOT_MANUALLY_GRADEABLE') {
        throw new Error(`Se esperaba QUESTION_NOT_MANUALLY_GRADEABLE y se obtuvo ${err.code}`);
      }
    }
    console.log('✓ Rechazo de calificación manual en pregunta objetiva (MC) verificado\n');

    // --- 4. PRUEBAS DE VALIDACIÓN DE PUNTOS Y CAMPOS PROTEGIDOS ---
    console.log('--- 4. PRUEBAS DE VALIDACIÓN DE PUNTOS Y CAMPOS PROTEGIDOS ---');
    // Puntos negativos
    try {
      await AttemptService.gradeAnswer(attemptA.id, qOpen1.id, teacher1.id, Role.TEACHER, { pointsEarned: -5 }, []);
      throw new Error('Puntos negativos debieron ser rechazados');
    } catch (err: any) {
      if (err.code !== 'INVALID_PAYLOAD') {
        throw new Error(`Se esperaba INVALID_PAYLOAD y se obtuvo ${err.code}`);
      }
    }

    // Puntos superiores al máximo
    try {
      await AttemptService.gradeAnswer(attemptA.id, qOpen1.id, teacher1.id, Role.TEACHER, { pointsEarned: 15 }, []);
      throw new Error('Puntos superiores al máximo debieron ser rechazados');
    } catch (err: any) {
      if (err.code !== 'INVALID_PAYLOAD') {
        throw new Error(`Se esperaba INVALID_PAYLOAD y se obtuvo ${err.code}`);
      }
    }

    // Intento de inyectar campo protegido (isCorrect / score)
    try {
      await AttemptService.gradeAnswer(attemptA.id, qOpen1.id, teacher1.id, Role.TEACHER, { pointsEarned: 8 }, ['isCorrect']);
      throw new Error('Campo protegido isCorrect debió ser rechazado');
    } catch (err: any) {
      if (err.code !== 'INVALID_PAYLOAD') {
        throw new Error(`Se esperaba INVALID_PAYLOAD y se obtuvo ${err.code}`);
      }
    }
    console.log('✓ Validaciones de límites de puntos y campos protegidos verificadas\n');

    // --- 5. PRUEBA DE FLUKO COMPLETO DE GRADING Y TRANSICIÓN DE ESTADO ---
    console.log('--- 5. PRUEBAS DE FLUKO DE GRADING Y TRANSICIÓN DE ESTADO ---');
    
    // Calificar primera pregunta abierta QOpen1 con 7.50 pts
    const grade1Result = await AttemptService.gradeAnswer(
      attemptA.id,
      qOpen1.id,
      teacher1.id,
      Role.TEACHER,
      { pointsEarned: 7.50, feedback: '  Buen intento  ' },
      ['pointsEarned', 'feedback']
    );

    if (grade1Result.status !== AttemptStatus.SUBMITTED) {
      throw new Error(`El intento debió continuar en SUBMITTED y se obtuvo ${grade1Result.status}`);
    }
    if (grade1Result.score !== null) {
      throw new Error(`El score debió continuar como null y se obtuvo ${grade1Result.score}`);
    }
    if (grade1Result.pendingOpenTextCount !== 1) {
      throw new Error(`Debió quedar 1 OPEN_TEXT pendiente y se obtuvo ${grade1Result.pendingOpenTextCount}`);
    }
    const ansQOpen1 = grade1Result.answers.find((a) => a.questionId === qOpen1.id)!;
    if (ansQOpen1.feedback !== 'Buen intento' || ansQOpen1.pointsEarned !== 7.50 || !ansQOpen1.gradedAt) {
      throw new Error('La respuesta QOpen1 no guardó correctamente puntos, feedback o gradedAt');
    }
    console.log('✓ Calificación parcial (1 de 2 OPEN_TEXT): status = SUBMITTED, score = null verificado');

    // Calificar segunda pregunta abierta QOpen2 con 10.00 pts -> Debe cambiar a GRADED
    const grade2Result = await AttemptService.gradeAnswer(
      attemptA.id,
      qOpen2.id,
      teacher1.id,
      Role.TEACHER,
      { pointsEarned: 10.00, feedback: 'Excelente' },
      ['pointsEarned', 'feedback']
    );

    if (grade2Result.status !== AttemptStatus.GRADED) {
      throw new Error(`El intento debió cambiar a GRADED y se obtuvo ${grade2Result.status}`);
    }
    // Total obtenido: QMC = 10, QOpen1 = 7.5, QOpen2 = 10.0 -> 27.5 / 30 = 91.67%
    if (grade2Result.score !== 91.67) {
      throw new Error(`Se esperaba score 91.67 y se obtuvo ${grade2Result.score}`);
    }
    if (grade2Result.isPassed !== true) {
      throw new Error('isPassed debió calcularse como true');
    }
    console.log('✓ Calificación final (2 de 2 OPEN_TEXT): status = GRADED, score = 91.67, isPassed = true verificado\n');

    // --- 6. PRUEBA DE RE-CALIFICACIÓN (REGRADING) ---
    console.log('--- 6. PRUEBAS DE RE-CALIFICACIÓN (REGRADING) ---');
    const time1 = new Date(ansQOpen1.gradedAt!).getTime();
    
    // Esperar 10ms para asegurar diferencia en timestamp
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Re-calificar QOpen1 cambiando nota de 7.50 a 9.00
    const regradeResult = await AttemptService.gradeAnswer(
      attemptA.id,
      qOpen1.id,
      teacher1.id,
      Role.TEACHER,
      { pointsEarned: 9.00, feedback: 'Revisión aceptada: 9.00' },
      ['pointsEarned', 'feedback']
    );

    if (regradeResult.status !== AttemptStatus.GRADED) {
      throw new Error(`El intento debió mantenerse en GRADED tras regrading`);
    }
    // Total obtenido: QMC = 10, QOpen1 = 9.0, QOpen2 = 10.0 -> 29.0 / 30 = 96.67%
    if (regradeResult.score !== 96.67) {
      throw new Error(`Se esperaba score 96.67 tras regrading y se obtuvo ${regradeResult.score}`);
    }
    const regradedAns = regradeResult.answers.find((a) => a.questionId === qOpen1.id)!;
    const time2 = new Date(regradedAns.gradedAt!).getTime();
    if (time2 <= time1) {
      throw new Error('gradedAt debió actualizarse a un nuevo timestamp tras regrading');
    }

    // Confirmar en BD que solo existe 1 fila Answer para qOpen1
    const dbAnswersCount = await prisma.answer.count({
      where: { attemptId: attemptA.id, questionId: qOpen1.id },
    });
    if (dbAnswersCount !== 1) {
      throw new Error(`Se esperaba exactamente 1 fila Answer y se encontraron ${dbAnswersCount}`);
    }
    console.log('✓ Regrading: score recalculado a 96.67, gradedAt actualizado, 0 duplicados en BD verificado\n');

    // --- 7. PRUEBA DE MISSING OPEN_TEXT ANSWER ---
    console.log('--- 7. PRUEBAS DE OPEN_TEXT OMITIDA (MISSING ANSWER) ---');
    const attemptB = await AttemptService.startOrResumeAttempt(assessment.id, studentB.id);
    // Student B responde MC pero NO responde OPEN_TEXT 1 ni OPEN_TEXT 2
    await AttemptService.saveAnswer(attemptB.id, qMC.id, studentB.id, { optionIds: [mcOpt.id] });
    await AttemptService.submitAttempt(attemptB.id, studentB.id, Role.STUDENT);

    // Calificar omisión QOpen1 con 0.00 pts
    await AttemptService.gradeAnswer(attemptB.id, qOpen1.id, teacher1.id, Role.TEACHER, { pointsEarned: 0, feedback: 'Sin respuesta' }, ['pointsEarned', 'feedback']);
    // Calificar omisión QOpen2 con 5.00 pts
    const missingGradedResult = await AttemptService.gradeAnswer(attemptB.id, qOpen2.id, teacher1.id, Role.TEACHER, { pointsEarned: 5.00, feedback: 'Respuesta parcial' }, ['pointsEarned', 'feedback']);

    if (missingGradedResult.status !== AttemptStatus.GRADED) {
      throw new Error('Attempt con respuestas omitidas debió pasar a GRADED tras ser evaluado');
    }
    // Total obtenido: QMC = 10, QOpen1 = 0, QOpen2 = 5 -> 15 / 30 = 50.00%
    if (missingGradedResult.score !== 50.00) {
      throw new Error(`Se esperaba score 50.00 y se obtuvo ${missingGradedResult.score}`);
    }
    console.log('✓ Calificación de respuestas omitidas procesada y finalizada correctamente\n');

    // --- 8. PRUEBA DE CONCURRENCIA (pg_advisory_xact_lock) ---
    console.log('--- 8. PRUEBA DE CONCURRENCIA ATÓMICA DE GRADING (pg_advisory_xact_lock) ---');
    const attemptConc = await AttemptService.startOrResumeAttempt(assessment.id, studentA.id);
    await AttemptService.submitAttempt(attemptConc.id, studentA.id, Role.STUDENT);

    console.log('Disparando 10 peticiones simultáneas de gradeAnswer...');
    const concPromises = Array.from({ length: 10 }).map((_, idx) =>
      AttemptService.gradeAnswer(
        attemptConc.id,
        idx % 2 === 0 ? qOpen1.id : qOpen2.id,
        teacher1.id,
        Role.TEACHER,
        { pointsEarned: 8.00, feedback: `Conc ${idx}` },
        ['pointsEarned', 'feedback']
      )
    );

    const concResults = await Promise.all(concPromises);
    const lastResult = concResults[concResults.length - 1];
    if (lastResult.status !== AttemptStatus.GRADED) {
      throw new Error('El intento debió finalizar en GRADED tras la ejecución concurrente');
    }
    console.log('✓ Concurrencia atómica de grading verificada: 10 peticiones simultáneas finalizaron sin deadlocks\n');

    console.log('=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.4-E PASARON! 🟢');
    console.log('=======================================================\n');

  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 8.4-E:', error);
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
      await prisma.courseTeacher.deleteMany({ where: { courseId: { in: createdCourseIds } } });
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

runPhase84eIntegrationTests();
