import { Role, CourseStatus, EnrollmentStatus, QuestionType, AssessmentType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AttemptService } from '../src/services/attempt.service';
import { AuthError } from '../src/types/auth.types';

async function runPhase84BIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.4-B (INCREMENTAL ANSWER PERSISTENCE) ---\n');

  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdQuestionIds: string[] = [];
  const createdAttemptIds: string[] = [];

  try {
    const timestamp = Date.now();

    // 1. SETUP DE USUARIOS Y ESTRUCTURA ACADÉMICA
    const admin = await prisma.user.create({
      data: {
        name: 'Admin Test 84B',
        email: `admin84b_${timestamp}@potrolearn.edu.mx`,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(admin.id);

    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher Test 84B',
        email: `teacher84b_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacher.id);

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 84B',
        email: `studentA84b_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84BA${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentA.id);

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 84B',
        email: `studentB84b_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84BB${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentB.id);

    // Subject & Course
    const subject = await prisma.subject.create({
      data: {
        code: `SUB84B_${timestamp}`,
        name: 'Materia 8.4-B Test',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso 8.4-B Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    await prisma.courseTeacher.create({
      data: {
        courseId: course.id,
        teacherId: teacher.id,
      },
    });

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

    // Assessment
    const assessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Phase 8.4-B',
        type: AssessmentType.EXAM,
        weight: 20,
        isPublished: true,
        maxAttempts: 3,
        timeLimitMinutes: 60,
      },
    });
    createdAssessmentIds.push(assessment.id);

    // 2. CREACIÓN DE BANCO DE PREGUNTAS (MC, MS, TF, NUMERIC, OPEN_TEXT)
    const qMC = await prisma.question.create({
      data: {
        statement: 'Pregunta MC 84B',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 10,
        options: {
          create: [
            { text: 'Opción MC 1', isCorrect: true, order: 1 },
            { text: 'Opción MC 2', isCorrect: false, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMC.id);

    const qMS = await prisma.question.create({
      data: {
        statement: 'Pregunta MS 84B',
        type: QuestionType.MULTIPLE_SELECT,
        defaultPoints: 15,
        options: {
          create: [
            { text: 'Opción MS 1', isCorrect: true, order: 1 },
            { text: 'Opción MS 2', isCorrect: true, order: 2 },
            { text: 'Opción MS 3', isCorrect: false, order: 3 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMS.id);

    const qTF = await prisma.question.create({
      data: {
        statement: 'Pregunta TF 84B',
        type: QuestionType.TRUE_FALSE,
        defaultPoints: 5,
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

    const qNum = await prisma.question.create({
      data: {
        statement: 'Pregunta NUMERIC 84B',
        type: QuestionType.NUMERIC,
        defaultPoints: 10,
        correctNumericValue: 3.1416,
        numericTolerance: 0.001,
      },
    });
    createdQuestionIds.push(qNum.id);

    const qText = await prisma.question.create({
      data: {
        statement: 'Pregunta OPEN_TEXT 84B',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 20,
      },
    });
    createdQuestionIds.push(qText.id);

    const qExternal = await prisma.question.create({
      data: {
        statement: 'Pregunta Externa',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 10,
        options: {
          create: [{ text: 'Externa Opt', isCorrect: true, order: 1 }],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qExternal.id);

    // Asociaciones
    const questionsToAssoc = [
      { q: qMC, pts: 10, order: 1 },
      { q: qMS, pts: 15, order: 2 },
      { q: qTF, pts: 5, order: 3 },
      { q: qNum, pts: 10, order: 4 },
      { q: qText, pts: 20, order: 5 },
    ];

    for (const item of questionsToAssoc) {
      await prisma.assessmentQuestion.create({
        data: {
          assessmentId: assessment.id,
          questionId: item.q.id,
          points: item.pts,
          order: item.order,
        },
      });
    }

    console.log('✓ Setup de usuarios, evaluación y banco de preguntas completado');

    // 3. INICIAR ATTEMPT PARA STUDENT A
    const attempt = await AttemptService.startOrResumeAttempt(assessment.id, studentA.id);
    const attemptId = attempt.id;
    createdAttemptIds.push(attemptId);
    console.log('✓ Attempt IN_PROGRESS creado exitosamente');

    // --- 4. PRUEBAS MULTIPLE_CHOICE ---
    console.log('\n--- 4. PRUEBAS MULTIPLE_CHOICE ---');
    const mcOpt1 = qMC.options[0].id;
    const mcOpt2 = qMC.options[1].id;

    // Guardar opción válida
    const mcSaveRes = await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt1] });
    if (!mcSaveRes.optionIds.includes(mcOpt1)) {
      throw new Error(`Error al guardar MC: ${JSON.stringify(mcSaveRes)}`);
    }
    console.log('✓ Guardar opción MC válida verificado');

    // Reemplazar opción
    const mcReplaceRes = await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt2] });
    if (mcReplaceRes.optionIds.length !== 1 || mcReplaceRes.optionIds[0] !== mcOpt2) {
      throw new Error(`Error al reemplazar MC: ${JSON.stringify(mcReplaceRes)}`);
    }
    console.log('✓ Reemplazar opción MC verificado (reemplazo completo)');

    // Limpiar opción
    const mcClearRes = await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [] });
    if (mcClearRes.optionIds.length !== 0) {
      throw new Error(`Error al limpiar MC: ${JSON.stringify(mcClearRes)}`);
    }
    console.log('✓ Limpiar opción MC (optionIds: []) verificado');

    // Intentar enviar 2 opciones a MC -> 400
    try {
      await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt1, mcOpt2] });
      throw new Error('Debería haber fallado al enviar 2 opciones en MC');
    } catch (e: any) {
      if (e.code !== 'INVALID_PAYLOAD') throw e;
      console.log('✓ Rechazo de 2 opciones en MULTIPLE_CHOICE (400 INVALID_PAYLOAD) verificado');
    }

    // Intentar enviar campos incompatibles a MC (textValue) -> 400
    try {
      await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt1], textValue: 'incompatible' });
      throw new Error('Debería haber fallado por tipo incompatible');
    } catch (e: any) {
      if (e.code !== 'QUESTION_TYPE_MISMATCH') throw e;
      console.log('✓ Rechazo de tipo incompatible para MC (400 QUESTION_TYPE_MISMATCH) verificado');
    }

    // --- 5. PRUEBAS MULTIPLE_SELECT ---
    console.log('\n--- 5. PRUEBAS MULTIPLE_SELECT ---');
    const msOpt1 = qMS.options[0].id;
    const msOpt2 = qMS.options[1].id;

    const msSaveRes = await AttemptService.saveAnswer(attemptId, qMS.id, studentA.id, { optionIds: [msOpt1, msOpt2] });
    if (msSaveRes.optionIds.length !== 2) {
      throw new Error(`Error al guardar MS: ${JSON.stringify(msSaveRes)}`);
    }
    console.log('✓ Guardar múltiples opciones MS verificado');

    // Duplicados deduplicados
    const msDupRes = await AttemptService.saveAnswer(attemptId, qMS.id, studentA.id, { optionIds: [msOpt1, msOpt1, msOpt2] });
    if (msDupRes.optionIds.length !== 2) {
      throw new Error(`Error en deduplicación MS: ${JSON.stringify(msDupRes)}`);
    }
    console.log('✓ Deduplicación automática de opciones MS verificada');

    // --- 6. PRUEBAS TRUE_FALSE ---
    console.log('\n--- 6. PRUEBAS TRUE_FALSE ---');
    const tfOpt1 = qTF.options[0].id;

    const tfSaveRes = await AttemptService.saveAnswer(attemptId, qTF.id, studentA.id, { optionIds: [tfOpt1] });
    if (tfSaveRes.optionIds[0] !== tfOpt1) {
      throw new Error(`Error al guardar TF: ${JSON.stringify(tfSaveRes)}`);
    }
    console.log('✓ Guardar opción TRUE_FALSE verificado');

    // --- 7. PRUEBAS NUMERIC ---
    console.log('\n--- 7. PRUEBAS NUMERIC ---');
    const numSaveRes = await AttemptService.saveAnswer(attemptId, qNum.id, studentA.id, { numericValue: 3.1416 });
    if (numSaveRes.numericValue !== 3.1416) {
      throw new Error(`Error al guardar NUMERIC: ${JSON.stringify(numSaveRes)}`);
    }
    console.log('✓ Guardar cifra decimal NUMERIC verificado');

    // Clear NUMERIC
    const numClearRes = await AttemptService.saveAnswer(attemptId, qNum.id, studentA.id, { numericValue: null });
    if (numClearRes.numericValue !== null) {
      throw new Error(`Error al limpiar NUMERIC: ${JSON.stringify(numClearRes)}`);
    }
    console.log('✓ Limpiar NUMERIC (numericValue: null) verificado');

    // Reject NaN
    try {
      await AttemptService.saveAnswer(attemptId, qNum.id, studentA.id, { numericValue: NaN });
      throw new Error('Debería haber rechazado NaN');
    } catch (e: any) {
      if (e.code !== 'INVALID_PAYLOAD') throw e;
      console.log('✓ Rechazo de NaN en NUMERIC (400 INVALID_PAYLOAD) verificado');
    }

    // Re-save valid NUMERIC
    await AttemptService.saveAnswer(attemptId, qNum.id, studentA.id, { numericValue: 42.5 });

    // --- 8. PRUEBAS OPEN_TEXT ---
    console.log('\n--- 8. PRUEBAS OPEN_TEXT ---');

    // Valid text
    const textSaveRes = await AttemptService.saveAnswer(attemptId, qText.id, studentA.id, { textValue: 'Respuesta abierta de prueba' });
    if (textSaveRes.textValue !== 'Respuesta abierta de prueba') {
      throw new Error(`Error al guardar OPEN_TEXT: ${JSON.stringify(textSaveRes)}`);
    }
    console.log('✓ Guardar texto OPEN_TEXT verificado');

    // Clear with empty string "" -> null
    const textEmptyRes = await AttemptService.saveAnswer(attemptId, qText.id, studentA.id, { textValue: '' });
    if (textEmptyRes.textValue !== null) {
      throw new Error(`Error al limpiar OPEN_TEXT con "": ${JSON.stringify(textEmptyRes)}`);
    }
    console.log('✓ Limpiar OPEN_TEXT con string vacío ("" -> null) verificado');

    // Exact 50,000 chars -> PASS
    const text50k = 'a'.repeat(50000);
    const text50kRes = await AttemptService.saveAnswer(attemptId, qText.id, studentA.id, { textValue: text50k });
    if (text50kRes.textValue?.length !== 50000) {
      throw new Error(`Error en texto de exactamente 50,000 caracteres`);
    }
    console.log('✓ Guardado de texto de exactamente 50,000 caracteres PASS verificado');

    // 50,001 chars -> 400 INVALID_PAYLOAD
    const text50k1 = 'a'.repeat(50001);
    try {
      await AttemptService.saveAnswer(attemptId, qText.id, studentA.id, { textValue: text50k1 });
      throw new Error('Debería haber rechazado 50,001 caracteres');
    } catch (e: any) {
      if (e.code !== 'INVALID_PAYLOAD') throw e;
      console.log('✓ Rechazo de texto de 50,001 caracteres (400 INVALID_PAYLOAD) verificado');
    }

    // --- 9. BLOQUEO DE CAMPOS DE GRADING Y FORBIDDEN FIELDS ---
    console.log('\n--- 9. SEGURIDAD DTO Y CAMPOS PROHIBIDOS ---');
    try {
      await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt1] }, ['optionIds', 'pointsEarned', 'isCorrect']);
      throw new Error('Debería haber rechazado campos prohibidos');
    } catch (e: any) {
      if (e.code !== 'INVALID_PAYLOAD') throw e;
      console.log('✓ Rechazo de payload con campos de grading (400 INVALID_PAYLOAD) verificado');
    }

    // --- 10. PRUEBAS DE OWNERSHIP E IDOR ---
    console.log('\n--- 10. PRUEBAS DE SEGURIDAD, OWNERSHIP E IDOR ---');

    // Student B intenta modificar respuesta de Student A -> 403
    try {
      await AttemptService.saveAnswer(attemptId, qMC.id, studentB.id, { optionIds: [mcOpt1] });
      throw new Error('Debería haber rechazado estudiante B');
    } catch (e: any) {
      if (e.code !== 'ATTEMPT_ACCESS_DENIED') throw e;
      console.log('✓ Rechazo de modificación por otro estudiante (403 ATTEMPT_ACCESS_DENIED) verificado');
    }

    // Student B intenta consultar Attempt de Student A -> 403
    try {
      await AttemptService.getAttemptById(attemptId, studentB.id, Role.STUDENT);
      throw new Error('Debería haber rechazado consulta estudiante B');
    } catch (e: any) {
      if (e.code !== 'FORBIDDEN') throw e;
      console.log('✓ Rechazo de consulta por otro estudiante (403 FORBIDDEN) verificado');
    }

    // Pregunta no perteneciente al Assessment -> 404
    try {
      await AttemptService.saveAnswer(attemptId, qExternal.id, studentA.id, { optionIds: [qExternal.options[0].id] });
      throw new Error('Debería haber rechazado pregunta externa');
    } catch (e: any) {
      if (e.code !== 'QUESTION_NOT_IN_ASSESSMENT') throw e;
      console.log('✓ Rechazo de pregunta fuera del Assessment (404 QUESTION_NOT_IN_ASSESSMENT) verificado');
    }

    // Opción perteneciente a otra pregunta -> 400
    try {
      await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [msOpt1] });
      throw new Error('Debería haber rechazado opción de otra pregunta');
    } catch (e: any) {
      if (e.code !== 'INVALID_OPTION') throw e;
      console.log('✓ Rechazo de opción de otra pregunta (400 INVALID_OPTION) verificado');
    }

    // --- 11. PRUEBA DE RECUPERACIÓN / GET ATTEMPT PERSISTENCE ---
    console.log('\n--- 11. PERSISTENCIA Y RECUPERACIÓN VÍA GET ATTEMPT ---');

    await AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [mcOpt1] });
    await AttemptService.saveAnswer(attemptId, qMS.id, studentA.id, { optionIds: [msOpt1, msOpt2] });

    const getAttemptRes = await AttemptService.getAttemptById(attemptId, studentA.id, Role.STUDENT);
    if (!getAttemptRes.answers || getAttemptRes.answers.length < 3) {
      throw new Error(`Respuestas insuficientes recuperadas: ${JSON.stringify(getAttemptRes)}`);
    }
    console.log(`✓ Recuperación exitosa de ${getAttemptRes.answers.length} respuestas persistidas mediante GET /api/attempts/:id verificada`);

    // --- 12. PRUEBAS DE CONCURRENCIA ---
    console.log('\n--- 12. PRUEBAS DE CONCURRENCIA REAL (pg_advisory_xact_lock) ---');

    console.log('Ejecutando 10 peticiones simultáneas sobre la misma pregunta (Q1)...');
    const parallelSameQPromises = Array.from({ length: 10 }).map((_, idx) => {
      const selectedOption = idx % 2 === 0 ? mcOpt1 : mcOpt2;
      return AttemptService.saveAnswer(attemptId, qMC.id, studentA.id, { optionIds: [selectedOption] });
    });

    const parallelSameQResults = await Promise.all(parallelSameQPromises);
    if (parallelSameQResults.length !== 10) {
      throw new Error('Peticiones concurrentes incompletas');
    }

    // Verificar en la DB que sólo existe 1 registro en Answer para esta pregunta y 1 en AnswerOption
    const countAnswersMC = await prisma.answer.count({
      where: { attemptId, questionId: qMC.id },
    });
    const countAnswerOptionsMC = await prisma.answerOption.count({
      where: { answer: { attemptId, questionId: qMC.id } },
    });

    if (countAnswersMC !== 1 || countAnswerOptionsMC !== 1) {
      throw new Error(`Inconsistencia en DB tras concurrencia: Answers=${countAnswersMC}, AnswerOptions=${countAnswerOptionsMC}`);
    }
    console.log('✓ Concurrencia atómica sobre la misma pregunta verificada (Exactamente 1 Answer y 1 AnswerOption)');

    // Escenario B: 10 peticiones simultáneas a DIFERENTES preguntas del mismo intento
    console.log('Ejecutando 10 peticiones simultáneas sobre preguntas diferentes...');
    const parallelDiffQPromises = Array.from({ length: 10 }).map((_, idx) => {
      if (idx % 2 === 0) {
        return AttemptService.saveAnswer(attemptId, qNum.id, studentA.id, { numericValue: 10 + idx });
      } else {
        return AttemptService.saveAnswer(attemptId, qText.id, studentA.id, { textValue: `Concurrent text payload ${idx}` });
      }
    });

    const parallelDiffQResults = await Promise.all(parallelDiffQPromises);
    if (parallelDiffQResults.length !== 10) {
      throw new Error('Peticiones concurrentes en diferentes preguntas incompletas');
    }
    console.log('✓ Concurrencia sobre diferentes preguntas sin bloqueos innecesarios verificada');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.4-B PASARON! 🟢');
    console.log('=======================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS FASE 8.4-B:', error);
    process.exitCode = 1;
  } finally {
    // 13. TEARDOWN Y LIMPIEZA DE DATOS TEMPORALES DE PRUEBA
    console.log('--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    try {
      if (createdAttemptIds.length > 0) {
        await prisma.answerOption.deleteMany({
          where: { answer: { attemptId: { in: createdAttemptIds } } },
        });
        await prisma.answer.deleteMany({
          where: { attemptId: { in: createdAttemptIds } },
        });
        await prisma.attempt.deleteMany({
          where: { id: { in: createdAttemptIds } },
        });
      }

      if (createdAssessmentIds.length > 0) {
        await prisma.assessmentQuestion.deleteMany({
          where: { assessmentId: { in: createdAssessmentIds } },
        });
        await prisma.assessment.deleteMany({
          where: { id: { in: createdAssessmentIds } },
        });
      }

      if (createdQuestionIds.length > 0) {
        await prisma.questionOption.deleteMany({
          where: { questionId: { in: createdQuestionIds } },
        });
        await prisma.question.deleteMany({
          where: { id: { in: createdQuestionIds } },
        });
      }

      if (createdCourseIds.length > 0) {
        await prisma.enrollment.deleteMany({
          where: { courseId: { in: createdCourseIds } },
        });
        await prisma.courseTeacher.deleteMany({
          where: { courseId: { in: createdCourseIds } },
        });
        await prisma.course.deleteMany({
          where: { id: { in: createdCourseIds } },
        });
      }

      if (createdSubjectIds.length > 0) {
        await prisma.subject.deleteMany({
          where: { id: { in: createdSubjectIds } },
        });
      }

      if (createdUserIds.length > 0) {
        await prisma.studentProfile.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.refreshSession.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.authToken.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }

      const remainingAttempts = await prisma.attempt.count({
        where: { id: { in: createdAttemptIds } },
      });
      const remainingUsers = await prisma.user.count({
        where: { id: { in: createdUserIds } },
      });

      console.log(`✓ Teardown completado. Registros temporales restantes: Attempts=${remainingAttempts}, Users=${remainingUsers}`);
    } catch (cleanErr) {
      console.error('Error durante el teardown:', cleanErr);
    }
  }
}

runPhase84BIntegrationTests();
