import { Role, CourseStatus, EnrollmentStatus, QuestionType, AssessmentType, AttemptStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AttemptService } from '../src/services/attempt.service';

async function runPhase84CIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.4-C (AUTO-GRADING ENGINE) ---\n');

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
        name: 'Admin Test 84C',
        email: `admin84c_${timestamp}@potrolearn.edu.mx`,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(admin.id);

    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher Test 84C',
        email: `teacher84c_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacher.id);

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 84C',
        email: `studentA84c_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84CA${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentA.id);

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 84C',
        email: `studentB84c_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S84CB${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentB.id);

    // Subject & Course
    const subject = await prisma.subject.create({
      data: {
        code: `SUB84C_${timestamp}`,
        name: 'Materia 8.4-C Test',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso 8.4-C Test',
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

    // Assessment Objetiva Pura (Passing score = 70.00)
    const objAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Objetiva 8.4-C',
        type: AssessmentType.QUIZ,
        weight: 30,
        isPublished: true,
        maxAttempts: 3,
        passingScore: 70.0,
      },
    });
    createdAssessmentIds.push(objAssessment.id);

    // 2. CREACIÓN DE BANCO DE PREGUNTAS CON PUNTOS DIVERGENTES (Question.defaultPoints != AssessmentQuestion.points)

    // Q1: MULTIPLE_CHOICE (AssessmentPoints = 10, defaultPoints = 100)
    const qMC = await prisma.question.create({
      data: {
        statement: 'Pregunta MC 84C',
        type: QuestionType.MULTIPLE_CHOICE,
        defaultPoints: 100,
        options: {
          create: [
            { text: 'Opción Correcta MC', isCorrect: true, order: 1 },
            { text: 'Opción Incorrecta MC', isCorrect: false, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMC.id);

    // Q2: MULTIPLE_SELECT (AssessmentPoints = 10)
    const qMS = await prisma.question.create({
      data: {
        statement: 'Pregunta MS 84C',
        type: QuestionType.MULTIPLE_SELECT,
        defaultPoints: 100,
        options: {
          create: [
            { text: 'Opción MS Correcta 1', isCorrect: true, order: 1 },
            { text: 'Opción MS Correcta 2', isCorrect: true, order: 2 },
            { text: 'Opción MS Incorrecta', isCorrect: false, order: 3 },
          ],
        },
      },
      include: { options: true },
    });
    createdQuestionIds.push(qMS.id);

    // Q3: TRUE_FALSE (AssessmentPoints = 10)
    const qTF = await prisma.question.create({
      data: {
        statement: 'Pregunta TF 84C',
        type: QuestionType.TRUE_FALSE,
        defaultPoints: 100,
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

    // Q4: NUMERIC (AssessmentPoints = 10, target = 3.1416, tolerance = 0.0001)
    const qNum = await prisma.question.create({
      data: {
        statement: 'Pregunta NUMERIC 84C',
        type: QuestionType.NUMERIC,
        defaultPoints: 100,
        correctNumericValue: 3.1416,
        numericTolerance: 0.0001,
      },
    });
    createdQuestionIds.push(qNum.id);

    // Asociar Q1, Q2, Q3, Q4 a objAssessment (Puntos totales = 10 + 10 + 10 + 10 = 40 pts)
    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qMS.id, points: 10, order: 2 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qTF.id, points: 10, order: 3 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: objAssessment.id, questionId: qNum.id, points: 10, order: 4 },
    });

    console.log('✓ Setup de usuarios y evaluación objetiva pura completado');

    // --- 3. PRUEBA DE AUTOCALIFICACIÓN DE MULTIPLE_CHOICE ---
    console.log('\n--- 3. PRUEBAS MULTIPLE_CHOICE ---');

    // Iniciar intento 1
    const att1 = await AttemptService.startOrResumeAttempt(objAssessment.id, studentA.id);
    createdAttemptIds.push(att1.id);

    // Responder MC correctamente
    const mcCorrectOptId = qMC.options.find((o) => o.isCorrect)!.id;
    await AttemptService.saveAnswer(att1.id, qMC.id, studentA.id, { optionIds: [mcCorrectOptId] });

    // Autocalificar
    const gradedAtt1 = await AttemptService.autoGradeAttempt(att1.id, studentA.id, Role.STUDENT);
    if (gradedAtt1.status !== AttemptStatus.GRADED) {
      throw new Error(`Estado inesperado tras autocalificar: ${gradedAtt1.status}`);
    }

    const ansMC = gradedAtt1.answers?.find((a) => a.questionId === qMC.id);
    if (!ansMC || ansMC.isCorrect !== true || ansMC.pointsEarned !== 10) {
      throw new Error(`Evaluación fallida para MC correcta: ${JSON.stringify(ansMC)}`);
    }
    console.log('✓ MULTIPLE_CHOICE correcta (100% de AssessmentQuestion.points = 10) verificado');

    // --- 4. PRUEBAS MULTIPLE_SELECT (EXACT SET MATCH & PARCIAL) ---
    console.log('\n--- 4. PRUEBAS MULTIPLE_SELECT ---');

    const att2 = await AttemptService.startOrResumeAttempt(objAssessment.id, studentA.id);
    createdAttemptIds.push(att2.id);

    const msCorrectOptIds = qMS.options.filter((o) => o.isCorrect).map((o) => o.id);
    const msIncorrectOptId = qMS.options.find((o) => !o.isCorrect)!.id;

    // A) Exact Set Match en orden inverso -> 100%
    await AttemptService.saveAnswer(att2.id, qMS.id, studentA.id, { optionIds: [msCorrectOptIds[1], msCorrectOptIds[0]] });
    let gradedAtt2 = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    let ansMS = gradedAtt2.answers?.find((a) => a.questionId === qMS.id);
    if (!ansMS || ansMS.isCorrect !== true || ansMS.pointsEarned !== 10) {
      throw new Error(`Evaluación fallida para MS Exact Set Match: ${JSON.stringify(ansMS)}`);
    }
    console.log('✓ MULTIPLE_SELECT Exact Set Match independiente de orden (10 pts) verificado');

    // B) Selección parcial -> 0%
    // Para probarlo, reseteamos el estado a IN_PROGRESS manualmente para simular prueba de algoritmo
    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qMS.id, studentA.id, { optionIds: [msCorrectOptIds[0]] });
    gradedAtt2 = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    ansMS = gradedAtt2.answers?.find((a) => a.questionId === qMS.id);
    if (!ansMS || ansMS.isCorrect !== false || ansMS.pointsEarned !== 0) {
      throw new Error(`Evaluación fallida para MS Selección Parcial: ${JSON.stringify(ansMS)}`);
    }
    console.log('✓ MULTIPLE_SELECT Selección Parcial rechazada (0 pts, No crédito parcial) verificado');

    // C) Opción extra -> 0%
    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qMS.id, studentA.id, { optionIds: [...msCorrectOptIds, msIncorrectOptId] });
    gradedAtt2 = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    ansMS = gradedAtt2.answers?.find((a) => a.questionId === qMS.id);
    if (!ansMS || ansMS.isCorrect !== false || ansMS.pointsEarned !== 0) {
      throw new Error(`Evaluación fallida para MS Opción Extra: ${JSON.stringify(ansMS)}`);
    }
    console.log('✓ MULTIPLE_SELECT Opción Extra rechazada (0 pts) verificado');

    // --- 5. PRUEBAS TRUE_FALSE ---
    console.log('\n--- 5. PRUEBAS TRUE_FALSE ---');
    const tfCorrectOptId = qTF.options.find((o) => o.isCorrect)!.id;

    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qTF.id, studentA.id, { optionIds: [tfCorrectOptId] });
    const gradedTF = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    const ansTF = gradedTF.answers?.find((a) => a.questionId === qTF.id);
    if (!ansTF || ansTF.isCorrect !== true || ansTF.pointsEarned !== 10) {
      throw new Error(`Evaluación fallida para TRUE_FALSE: ${JSON.stringify(ansTF)}`);
    }
    console.log('✓ TRUE_FALSE opción correcta (10 pts) verificado');

    // --- 6. PRUEBAS NUMERIC (PRECISIÓN DECIMAL, BOUNDARY Y TOLERANCIA) ---
    console.log('\n--- 6. PRUEBAS NUMERIC (DECIMAL.JS & TOLERANCIA) ---');
    // target = 3.1416, tolerance = 0.0001

    // A) En el límite superior de tolerancia (3.1417) -> Correcta (10 pts)
    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qNum.id, studentA.id, { numericValue: 3.1417 });
    let gradedNum = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    let ansNum = gradedNum.answers?.find((a) => a.questionId === qNum.id);
    if (!ansNum || ansNum.isCorrect !== true || ansNum.pointsEarned !== 10) {
      throw new Error(`Evaluación fallida para NUMERIC en límite superior 3.1417: ${JSON.stringify(ansNum)}`);
    }
    console.log('✓ NUMERIC en el límite exacto de tolerancia (3.1417) -> Correcta verificado');

    // B) En el límite inferior de tolerancia (3.1415) -> Correcta (10 pts)
    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qNum.id, studentA.id, { numericValue: 3.1415 });
    gradedNum = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    ansNum = gradedNum.answers?.find((a) => a.questionId === qNum.id);
    if (!ansNum || ansNum.isCorrect !== true || ansNum.pointsEarned !== 10) {
      throw new Error(`Evaluación fallida para NUMERIC en límite inferior 3.1415: ${JSON.stringify(ansNum)}`);
    }
    console.log('✓ NUMERIC en el límite exacto de tolerancia (3.1415) -> Correcta verificado');

    // C) Fuera de tolerancia (3.1414) -> Incorrecta (0 pts)
    await prisma.attempt.update({ where: { id: att2.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(att2.id, qNum.id, studentA.id, { numericValue: 3.1414 });
    gradedNum = await AttemptService.autoGradeAttempt(att2.id, studentA.id, Role.STUDENT);
    ansNum = gradedNum.answers?.find((a) => a.questionId === qNum.id);
    if (!ansNum || ansNum.isCorrect !== false || ansNum.pointsEarned !== 0) {
      throw new Error(`Evaluación fallida para NUMERIC fuera de tolerancia 3.1414: ${JSON.stringify(ansNum)}`);
    }
    console.log('✓ NUMERIC fuera de tolerancia (3.1414) -> Incorrecta (0 pts) verificado');

    // --- 7. PRUEBA DE PREGUNTAS OMITIDAS / MISSING ANSWERS ---
    console.log('\n--- 7. PRUEBA DE PREGUNTAS OMITIDAS / MISSING ANSWERS ---');

    // Crear un intento sin ninguna respuesta registrada previamente
    const attMissing = await AttemptService.startOrResumeAttempt(objAssessment.id, studentA.id);
    // Eliminar las respuestas para simular intento en blanco
    await prisma.answer.deleteMany({ where: { attemptId: attMissing.id } });

    const gradedMissing = await AttemptService.autoGradeAttempt(attMissing.id, studentA.id, Role.STUDENT);
    if (gradedMissing.score !== 0.0) {
      throw new Error(`Score esperado 0.00 para examen omitido, obtenido ${gradedMissing.score}`);
    }

    const missingAnswersCount = gradedMissing.answers?.length || 0;
    if (missingAnswersCount !== 4) {
      throw new Error(`Se esperaban 4 respuestas materializadas para preguntas omitidas, obtenidas ${missingAnswersCount}`);
    }

    const allZeroPoints = gradedMissing.answers?.every((a) => a.pointsEarned === 0 && a.isCorrect === false);
    if (!allZeroPoints) {
      throw new Error('Las respuestas omitidas deben registrar pointsEarned=0 e isCorrect=false');
    }
    console.log('✓ Materialización y autocalificación de 4 preguntas omitidas (Score 0.00) verificado');

    // --- 8. PRUEBA DE CÁLCULO DE SCORE CUALQUIER PROPORCIÓN DECIMAL Y PASSING SCORE ---
    console.log('\n--- 8. PRUEBA DE SCORE DECIMAL (ej. 25/30 = 83.33) Y ISPASSED ---');

    // Crear evaluación con maxPoints = 30 (Q1=10, Q2=10, Q3=10)
    const scoreAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Cálculo Score 30 pts',
        type: AssessmentType.EXAM,
        isPublished: true,
        passingScore: 70.0,
      },
    });
    createdAssessmentIds.push(scoreAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: scoreAssessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: scoreAssessment.id, questionId: qMS.id, points: 10, order: 2 },
    });
    await prisma.assessmentQuestion.create({
      data: { assessmentId: scoreAssessment.id, questionId: qTF.id, points: 10, order: 3 },
    });

    // Iniciar intento y contestar Q1 (10 pts) y Q2 (10 pts) correctamente, Q3 omitida (0 pts) -> 20/30 = 66.67%
    const attScore = await AttemptService.startOrResumeAttempt(scoreAssessment.id, studentA.id);
    createdAttemptIds.push(attScore.id);

    await AttemptService.saveAnswer(attScore.id, qMC.id, studentA.id, { optionIds: [mcCorrectOptId] });
    await AttemptService.saveAnswer(attScore.id, qMS.id, studentA.id, { optionIds: msCorrectOptIds });

    const gradedScoreAtt = await AttemptService.autoGradeAttempt(attScore.id, studentA.id, Role.STUDENT);
    if (gradedScoreAtt.score !== 66.67) {
      throw new Error(`Score de 20/30 esperado 66.67, obtenido ${gradedScoreAtt.score}`);
    }
    if (gradedScoreAtt.isPassed !== false) {
      throw new Error(`isPassed esperado false (66.67 < 70.0), obtenido ${gradedScoreAtt.isPassed}`);
    }
    console.log('✓ Cálculo exacto de score decimal (20/30 = 66.67%) e isPassed (false) verificado');

    // Contestando Q3 (10 pts más) -> 30/30 = 100.00%, isPassed = true
    await prisma.attempt.update({ where: { id: attScore.id }, data: { status: AttemptStatus.IN_PROGRESS } });
    await AttemptService.saveAnswer(attScore.id, qTF.id, studentA.id, { optionIds: [tfCorrectOptId] });

    const gradedFullScoreAtt = await AttemptService.autoGradeAttempt(attScore.id, studentA.id, Role.STUDENT);
    if (gradedFullScoreAtt.score !== 100.0) {
      throw new Error(`Score de 30/30 esperado 100.00, obtenido ${gradedFullScoreAtt.score}`);
    }
    if (gradedFullScoreAtt.isPassed !== true) {
      throw new Error(`isPassed esperado true (100.00 >= 70.0), obtenido ${gradedFullScoreAtt.isPassed}`);
    }
    console.log('✓ Cálculo exacto de score (30/30 = 100.00%) e isPassed (true) verificado');

    // --- 9. PRUEBAS EVALUACIÓN CON OPEN_TEXT (ESTADO SUBMITTED, SCORE NULL) ---
    console.log('\n--- 9. PRUEBA CON PREGUNTA OPEN_TEXT (ESTADO SUBMITTED & SCORE NULL) ---');

    const mixedAssessment = await prisma.assessment.create({
      data: {
        courseId: course.id,
        title: 'Evaluación Mixta con OPEN_TEXT',
        type: AssessmentType.EXAM,
        isPublished: true,
      },
    });
    createdAssessmentIds.push(mixedAssessment.id);

    // Q1 (MC, 10 pts) + Q5 (OPEN_TEXT, 20 pts)
    await prisma.assessmentQuestion.create({
      data: { assessmentId: mixedAssessment.id, questionId: qMC.id, points: 10, order: 1 },
    });
    const qOpenText = await prisma.question.create({
      data: {
        statement: 'Pregunta Ensayistica',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 20,
      },
    });
    createdQuestionIds.push(qOpenText.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: mixedAssessment.id, questionId: qOpenText.id, points: 20, order: 2 },
    });

    const attMixed = await AttemptService.startOrResumeAttempt(mixedAssessment.id, studentA.id);
    createdAttemptIds.push(attMixed.id);

    await AttemptService.saveAnswer(attMixed.id, qMC.id, studentA.id, { optionIds: [mcCorrectOptId] });
    await AttemptService.saveAnswer(attMixed.id, qOpenText.id, studentA.id, { textValue: 'Ensayo del alumno...' });

    const gradedMixed = await AttemptService.autoGradeAttempt(attMixed.id, studentA.id, Role.STUDENT);

    if (gradedMixed.status !== AttemptStatus.SUBMITTED) {
      throw new Error(`Estado esperado SUBMITTED para examen con OPEN_TEXT, obtenido ${gradedMixed.status}`);
    }
    if (gradedMixed.score !== null) {
      throw new Error(`Score esperado NULL para examen con OPEN_TEXT pendiente de revisión, obtenido ${gradedMixed.score}`);
    }

    const ansOpenText = gradedMixed.answers?.find((a) => a.questionId === qOpenText.id);
    if (!ansOpenText || ansOpenText.pointsEarned !== null || ansOpenText.isCorrect !== null) {
      throw new Error(`OPEN_TEXT no debe ser auto-evaluado: ${JSON.stringify(ansOpenText)}`);
    }
    console.log('✓ Evaluación mixta con OPEN_TEXT: status = SUBMITTED, score = null, OPEN_TEXT no evaluada verificado');

    // --- 10. PRUEBA DE IDEMPOTENCIA ---
    console.log('\n--- 10. PRUEBA DE IDEMPOTENCIA ---');

    const firstRun = await AttemptService.autoGradeAttempt(att1.id, studentA.id, Role.STUDENT);
    const secondRun = await AttemptService.autoGradeAttempt(att1.id, studentA.id, Role.STUDENT);

    if (firstRun.score !== secondRun.score || firstRun.status !== secondRun.status) {
      throw new Error('La ejecución idempotente devolvió resultados diferentes');
    }
    console.log('✓ Idempotencia verificada: Múltiples llamadas retornan idénticos resultados sin alteración de datos');

    // --- 11. PRUEBAS DE SEGURIDAD Y CONFIGURACIÓN INVÁLIDA ---
    console.log('\n--- 11. SEGURIDAD, OWNERSHIP Y CONFIGURACIÓN INVÁLIDA ---');

    // Estudiante B intenta autocalificar el intento de A -> 403
    try {
      await AttemptService.autoGradeAttempt(att1.id, studentB.id, Role.STUDENT);
      throw new Error('Debería haber rechazado autocalificación cruzada por IDOR');
    } catch (e: any) {
      if (e.code !== 'ATTEMPT_ACCESS_DENIED') throw e;
      console.log('✓ Rechazo de autocalificación de intento ajeno por estudiante (403 ATTEMPT_ACCESS_DENIED) verificado');
    }

    // Pregunta MC sin ninguna opción correcta en DB -> 400 QUESTION_INVALID_CONFIGURATION
    const qBadMC = await prisma.question.create({
      data: {
        statement: 'Pregunta MC sin opción correcta',
        type: QuestionType.MULTIPLE_CHOICE,
        options: {
          create: [
            { text: 'Opt A', isCorrect: false, order: 1 },
            { text: 'Opt B', isCorrect: false, order: 2 },
          ],
        },
      },
    });
    createdQuestionIds.push(qBadMC.id);

    const badAssessment = await prisma.assessment.create({
      data: { courseId: course.id, title: 'Bad Assessment', type: AssessmentType.QUIZ, isPublished: true },
    });
    createdAssessmentIds.push(badAssessment.id);

    await prisma.assessmentQuestion.create({
      data: { assessmentId: badAssessment.id, questionId: qBadMC.id, points: 10, order: 1 },
    });

    const attBad = await AttemptService.startOrResumeAttempt(badAssessment.id, studentA.id);
    createdAttemptIds.push(attBad.id);

    try {
      await AttemptService.autoGradeAttempt(attBad.id, studentA.id, Role.STUDENT);
      throw new Error('Debería haber rechazado autocalificación por pregunta mal configurada');
    } catch (e: any) {
      if (e.code !== 'QUESTION_INVALID_CONFIGURATION') throw e;
      console.log('✓ Rechazo de pregunta mal configurada (400 QUESTION_INVALID_CONFIGURATION) verificado');
    }

    // --- 12. PRUEBA DE CONCURRENCIA EN AUTOGRADED ATTEMPT ---
    console.log('\n--- 12. PRUEBA DE CONCURRENCIA ATÓMICA (pg_advisory_xact_lock en autoGradeAttempt) ---');

    console.log('Disparando 10 llamadas simultáneas a autoGradeAttempt sobre el mismo intento...');
    const concPromises = Array.from({ length: 10 }).map(() =>
      AttemptService.autoGradeAttempt(attScore.id, studentA.id, Role.STUDENT)
    );

    const concResults = await Promise.all(concPromises);
    const allSameScores = concResults.every((r) => r.score === 100.0);
    if (!allSameScores) {
      throw new Error('Peticiones concurrentes a autoGradeAttempt devolvieron scores inconsistentes');
    }

    // Verificar en DB que no se duplicaron filas en Answer
    const countAnswersScoreAtt = await prisma.answer.count({
      where: { attemptId: attScore.id },
    });
    if (countAnswersScoreAtt !== 3) {
      throw new Error(`Se esperaban exactamente 3 respuestas en el intento, encontradas ${countAnswersScoreAtt}`);
    }
    console.log('✓ Concurrencia atómica verificada: 10 autocalificaciones simultáneas finalizaron limpiamente con 0 duplicados');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.4-C PASARON! 🟢');
    console.log('=======================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS FASE 8.4-C:', error);
    process.exitCode = 1;
  } finally {
    // 13. TEARDOWN Y LIMPIEZA DE DATOS TEMPORALES
    console.log('--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    try {
      if (createdAssessmentIds.length > 0) {
        await prisma.answerOption.deleteMany({
          where: { answer: { attempt: { assessmentId: { in: createdAssessmentIds } } } },
        });
        await prisma.answer.deleteMany({
          where: { attempt: { assessmentId: { in: createdAssessmentIds } } },
        });
        await prisma.attempt.deleteMany({
          where: { assessmentId: { in: createdAssessmentIds } },
        });
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

runPhase84CIntegrationTests();
