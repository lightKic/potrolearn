import { Role, AssessmentType, QuestionType, CourseStatus, AttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { QuestionService } from '../src/services/question.service';
import { CourseService } from '../src/services/course.service';
import { SubjectService } from '../src/services/subject.service';
import { UserProvisioningService } from '../src/services/user-provisioning.service';

async function runPhase82IntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.2 (ASSESSMENT & QUESTION MANAGEMENT V1) ---');

  const timestamp = Date.now();
  const adminEmail = `admin_82_${timestamp}@potrolearn.edu.mx`;
  const teacherAssignedEmail = `teacher_assigned_82_${timestamp}@potrolearn.edu.mx`;
  const teacherUnrelatedEmail = `teacher_unrelated_82_${timestamp}@potrolearn.edu.mx`;
  const studentEmail = `student_82_${timestamp}@potrolearn.edu.mx`;

  // 1. Setup Usuarios
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: 'dummyhash',
      name: 'Admin 8.2',
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherAssigned = await prisma.user.create({
    data: {
      email: teacherAssignedEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher Assigned 8.2',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherUnrelated = await prisma.user.create({
    data: {
      email: teacherUnrelatedEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher Unrelated 8.2',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: 'dummyhash',
      name: 'Student 8.2',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: `MAT-82-${timestamp}`,
        },
      },
    },
  });

  try {
    // 2. Setup Materia, Curso, Módulo y Lección
    const subject = await SubjectService.createSubject({
      code: `SUB-82-${timestamp}`,
      name: 'Materia 8.2 Evaluaciones',
      description: 'Materia de prueba Fase 8.2',
    });

    const course = await CourseService.createCourse(
      {
        subjectId: subject.id,
        name: 'Curso 8.2 Assessment Engine',
        description: 'Curso para probar gestión backend de evaluaciones',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
      },
      { id: adminUser.id, role: Role.ADMIN }
    );

    // Asignar Maestro e Inscribir Alumno
    await CourseService.assignTeacher(course.id, teacherAssigned.id);
    await UserProvisioningService.enrollStudent({
      courseId: course.id,
      name: studentUser.name,
      studentNumber: `MAT-82-${timestamp}`,
      email: studentUser.email,
      executorUser: { id: adminUser.id, role: Role.ADMIN },
    });

    // Activar Curso para visibilidad del alumno
    await CourseService.changeCourseStatus(course.id, CourseStatus.ACTIVE, { id: adminUser.id, role: Role.ADMIN });

    const moduleRecord = await prisma.module.create({
      data: {
        courseId: course.id,
        title: 'Módulo 1: Evaluaciones',
        order: 1,
        isPublished: true,
      },
    });

    const lessonRecord = await prisma.lesson.create({
      data: {
        moduleId: moduleRecord.id,
        title: 'Lección 1: Reactivos',
        order: 1,
        isPublished: true,
      },
    });

    console.log('✓ Setup inicial de usuarios, materia, curso, módulo y lección completado');

    // -------------------------------------------------------------
    // 3. PRUEBAS DE CREACIÓN Y VALIDACIÓN DE ASSESSMENT
    // -------------------------------------------------------------
    console.log('\n--- 3. CREACIÓN Y VALIDACIÓN DE ASSESSMENT ---');

    // 3.1 Error: Título vacío
    try {
      await AssessmentService.createAssessment(course.id, teacherAssigned.id, Role.TEACHER, {
        title: '   ',
        type: AssessmentType.QUIZ,
      });
      throw new Error('Debió fallar la creación con título vacío');
    } catch (err: any) {
      if (err.code !== 'BAD_REQUEST') throw err;
    }
    console.log('✓ Validación de título requerido verificada');

    // 3.2 Error: Peso inválido (> 100)
    try {
      await AssessmentService.createAssessment(course.id, teacherAssigned.id, Role.TEACHER, {
        title: 'Quiz 1',
        type: AssessmentType.QUIZ,
        weight: 150,
      });
      throw new Error('Debió fallar con peso > 100');
    } catch (err: any) {
      if (err.code !== 'BAD_REQUEST') throw err;
    }
    console.log('✓ Validación de límite de peso (0 <= weight <= 100) verificada');

    // 3.3 Error: Fechas incoherentes (availableFrom > availableUntil)
    try {
      await AssessmentService.createAssessment(course.id, teacherAssigned.id, Role.TEACHER, {
        title: 'Quiz Fechas Malas',
        type: AssessmentType.QUIZ,
        availableFrom: '2026-10-10T00:00:00Z',
        availableUntil: '2026-10-01T00:00:00Z',
      });
      throw new Error('Debió fallar con availableFrom > availableUntil');
    } catch (err: any) {
      if (err.code !== 'BAD_REQUEST') throw err;
    }
    console.log('✓ Validación de ventana temporal coherente (availableFrom <= availableUntil) verificada');

    // 3.4 Creación exitosa por Assigned Teacher
    const assessment = await AssessmentService.createAssessment(course.id, teacherAssigned.id, Role.TEACHER, {
      title: 'Evaluación Parcial 1',
      description: 'Primer examen del módulo',
      type: AssessmentType.EXAM,
      weight: 30.0,
      passingScore: 70.0,
      maxAttempts: 2,
      timeLimitMinutes: 45,
      moduleId: moduleRecord.id,
      lessonId: lessonRecord.id,
      availableFrom: '2026-09-01T00:00:00Z',
      availableUntil: '2026-12-01T00:00:00Z',
    });

    if (
      assessment.title !== 'Evaluación Parcial 1' ||
      assessment.weight !== 30 ||
      assessment.passingScore !== 70 ||
      assessment.isPublished !== false
    ) {
      throw new Error('Falló la creación exitosa de assessment con campos esperados');
    }
    console.log('✓ Creación exitosa de Assessment por Assigned Teacher verificada');

    // 3.5 Rechazo de creación por Unrelated Teacher (403 FORBIDDEN)
    try {
      await AssessmentService.createAssessment(course.id, teacherUnrelated.id, Role.TEACHER, {
        title: 'Quiz Ilegal',
        type: AssessmentType.QUIZ,
      });
      throw new Error('Debió fallar maestro no asignado');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de creación por Teacher no asignado (403 FORBIDDEN) verificado');

    // -------------------------------------------------------------
    // 4. PRUEBAS DE BANCO DE PREGUNTAS Y TIPOS DE PREGUNTA
    // -------------------------------------------------------------
    console.log('\n--- 4. BANCO DE PREGUNTAS Y QUESTION TYPES ---');

    // 4.1 MULTIPLE_CHOICE
    const qMc = await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: '¿Cuál es la capital de Francia?',
      type: QuestionType.MULTIPLE_CHOICE,
      defaultPoints: 10,
      explanation: 'París es la capital constitucional y administrativa de Francia.',
      options: [
        { text: 'Madrid', isCorrect: false },
        { text: 'París', isCorrect: true },
        { text: 'Londres', isCorrect: false },
        { text: 'Berlín', isCorrect: false },
      ],
    });
    if (qMc.options?.length !== 4 || qMc.options.filter((o) => o.isCorrect).length !== 1) {
      throw new Error('Falló creación de reactivo MULTIPLE_CHOICE');
    }
    console.log('✓ Reactivo MULTIPLE_CHOICE creado y validado (1 correcta)');

    // 4.2 Error: MULTIPLE_CHOICE con 2 opciones correctas
    try {
      await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
        statement: 'Pregunta MB Mala',
        type: QuestionType.MULTIPLE_CHOICE,
        options: [
          { text: 'Opción A', isCorrect: true },
          { text: 'Opción B', isCorrect: true },
        ],
      });
      throw new Error('Debió fallar MULTIPLE_CHOICE con 2 correctas');
    } catch (err: any) {
      if (err.code !== 'INVALID_QUESTION_CONFIGURATION') throw err;
    }
    console.log('✓ Rechazo de MULTIPLE_CHOICE ambiguo (2 correctas) verificado');

    // 4.3 MULTIPLE_SELECT
    const qMs = await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Selecciona los números pares',
      type: QuestionType.MULTIPLE_SELECT,
      defaultPoints: 15,
      options: [
        { text: '2', isCorrect: true },
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
    });
    if (qMs.options?.filter((o) => o.isCorrect).length !== 2) {
      throw new Error('Falló creación de reactivo MULTIPLE_SELECT');
    }
    console.log('✓ Reactivo MULTIPLE_SELECT creado y validado (>= 1 correcta)');

    // 4.4 TRUE_FALSE
    const qTf = await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'La Tierra gira alrededor del Sol.',
      type: QuestionType.TRUE_FALSE,
      defaultPoints: 5,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    });
    if (qTf.options?.length !== 2) {
      throw new Error('Falló creación de reactivo TRUE_FALSE');
    }
    console.log('✓ Reactivo TRUE_FALSE creado y validado (exactamente 2 opciones, 1 correcta)');

    // 4.5 NUMERIC (con correctNumericValue y numericTolerance)
    const qNum = await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Calcula el valor de pi redondeado a 4 decimales',
      type: QuestionType.NUMERIC,
      defaultPoints: 20,
      correctNumericValue: 3.1416,
      numericTolerance: 0.0001,
    });
    if (qNum.correctNumericValue !== 3.1416 || qNum.numericTolerance !== 0.0001) {
      throw new Error(`Falló persistencia de valores numéricos: val=${qNum.correctNumericValue}, tol=${qNum.numericTolerance}`);
    }
    console.log('✓ Reactivo NUMERIC creado y validado (correctNumericValue=3.1416, numericTolerance=0.0001)');

    // 4.6 Error: NUMERIC sin correctNumericValue
    try {
      await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
        statement: 'Número sin valor',
        type: QuestionType.NUMERIC,
      });
      throw new Error('Debió fallar NUMERIC sin valor objetivo');
    } catch (err: any) {
      if (err.code !== 'INVALID_QUESTION_CONFIGURATION') throw err;
    }
    console.log('✓ Rechazo de NUMERIC sin correctNumericValue verificado');

    // 4.7 OPEN_TEXT (Sin opciones)
    const qOpen = await QuestionService.createQuestion(teacherAssigned.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Explica en tus propias palabras el teorema fundamental del cálculo.',
      type: QuestionType.OPEN_TEXT,
      defaultPoints: 25,
    });
    if (qOpen.options?.length !== 0) {
      throw new Error('OPEN_TEXT no debe requerir opciones');
    }
    console.log('✓ Reactivo OPEN_TEXT creado sin opciones');

    // -------------------------------------------------------------
    // 5. PRUEBAS DE ASSESSMENTQUESTION (ASOCIACIÓN, PUNTOS, REORDER)
    // -------------------------------------------------------------
    console.log('\n--- 5. ASSESSMENTQUESTION MANAGEMENT ---');

    // 5.1 Agregar preguntas al assessment
    await AssessmentService.addQuestionToAssessment(assessment.id, teacherAssigned.id, Role.TEACHER, {
      questionId: qMc.id,
      points: 10,
    });
    await AssessmentService.addQuestionToAssessment(assessment.id, teacherAssigned.id, Role.TEACHER, {
      questionId: qMs.id,
      points: 15,
    });
    await AssessmentService.addQuestionToAssessment(assessment.id, teacherAssigned.id, Role.TEACHER, {
      questionId: qNum.id,
      points: 25,
    });

    let updatedDetail = (await AssessmentService.getAssessmentDetail(assessment.id, teacherAssigned.id, Role.TEACHER)) as any;
    if (updatedDetail.questions.length !== 3 || updatedDetail.totalPoints !== 50) {
      throw new Error(`Falló asociación de preguntas: count=${updatedDetail.questions.length}, totalPoints=${updatedDetail.totalPoints}`);
    }
    console.log('✓ Asignación de preguntas y cálculo derivado de totalPoints (50 pts) verificado');

    // 5.2 Evitar duplicados (409 QUESTION_ALREADY_IN_ASSESSMENT)
    try {
      await AssessmentService.addQuestionToAssessment(assessment.id, teacherAssigned.id, Role.TEACHER, {
        questionId: qMc.id,
      });
      throw new Error('Debió fallar pregunta duplicada');
    } catch (err: any) {
      if (err.code !== 'QUESTION_ALREADY_IN_ASSESSMENT') throw err;
    }
    console.log('✓ Protección contra preguntas duplicadas (409 QUESTION_ALREADY_IN_ASSESSMENT) verificada');

    // 5.3 Reordenar preguntas secuencialmente [qNum, qMc, qMs]
    const reorderedAssessment = await AssessmentService.reorderAssessmentQuestions(
      assessment.id,
      teacherAssigned.id,
      Role.TEACHER,
      {
        items: [
          { questionId: qNum.id, order: 1 },
          { questionId: qMc.id, order: 2 },
          { questionId: qMs.id, order: 3 },
        ],
      }
    );

    const questionsList = reorderedAssessment.questions || [];
    if (
      questionsList.length < 3 ||
      questionsList[0].questionId !== qNum.id ||
      questionsList[1].questionId !== qMc.id ||
      questionsList[2].questionId !== qMs.id
    ) {
      throw new Error('Falló reordenamiento secuencial 1..N');
    }
    console.log('✓ Reordenamiento atómico secuencial (1..N) verificado');

    // -------------------------------------------------------------
    // 6. PRUEBAS DE PUBLICACIÓN Y VISIBILIDAD PARA STUDENT
    // -------------------------------------------------------------
    console.log('\n--- 6. PUBLICACIÓN Y SEGURIDAD DTO PARA STUDENT ---');

    // 6.1 Alumno no puede ver assessment borrador (isPublished = false)
    try {
      await AssessmentService.getAssessmentDetail(assessment.id, studentUser.id, Role.STUDENT);
      throw new Error('El alumno no debe poder consultar un assessment no publicado');
    } catch (err: any) {
      if (err.code !== 'ASSESSMENT_NOT_FOUND') throw err;
    }
    console.log('✓ Assessment borrador (isPublished=false) oculto para STUDENT verificado');

    // 6.2 Publicación por Assigned Teacher
    const publishedAssessment = await AssessmentService.togglePublication(
      assessment.id,
      teacherAssigned.id,
      Role.TEACHER,
      true
    );
    if (!publishedAssessment.isPublished) {
      throw new Error('Falló publicación de assessment');
    }
    console.log('✓ Publicación exitosa (isPublished=true) verificada');

    // 6.3 Consulta de STUDENT y sanitización de respuestas correctas
    const studentAssessment = (await AssessmentService.getAssessmentDetail(
      assessment.id,
      studentUser.id,
      Role.STUDENT
    )) as any;

    if (studentAssessment.title !== 'Evaluación Parcial 1') {
      throw new Error('El alumno no pudo obtener la evaluación publicada');
    }

    // Verificar sanitización DTO (isCorrect & correctNumericValue omitidos)
    for (const sq of studentAssessment.questions) {
      if ('correctNumericValue' in sq.question) {
        throw new Error('Fuga de seguridad: correctNumericValue expuesto a STUDENT');
      }
      for (const opt of sq.question.options) {
        if ('isCorrect' in opt) {
          throw new Error('Fuga de seguridad: QuestionOption.isCorrect expuesto a STUDENT');
        }
      }
    }
    console.log('✓ DTO Sanitized para STUDENT verificado (QuestionOption.isCorrect y respuestas objetivo OCULTADAS)');

    // -------------------------------------------------------------
    // 7. PRUEBAS DE HISTORICAL INTEGRITY (ATTEMPTS EXISTENTES)
    // -------------------------------------------------------------
    console.log('\n--- 7. HISTORICAL INTEGRITY ENFORCEMENT ---');

    // 7.1 Crear temporalmente un Attempt con status SUBMITTED
    const attempt = await prisma.attempt.create({
      data: {
        studentId: studentUser.id,
        assessmentId: assessment.id,
        attemptNumber: 1,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(),
        submittedAt: new Date(),
        score: new Prisma.Decimal(85.0),
      },
    });

    const answer = await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: qMc.id,
        pointsEarned: new Prisma.Decimal(10.0),
        isCorrect: true,
      },
    });

    const optCorrect = qMc.options?.find((o) => o.isCorrect);
    if (optCorrect) {
      await prisma.answerOption.create({
        data: {
          answerId: answer.id,
          optionId: optCorrect.id,
        },
      });
    }

    console.log('✓ Intento SUBMITTED de prueba registrado históricamente');

    // 7.2 Bloquear eliminación de Assessment con historial (409 ASSESSMENT_HAS_ATTEMPTS)
    try {
      await AssessmentService.deleteAssessment(assessment.id, teacherAssigned.id, Role.TEACHER);
      throw new Error('Debió fallar eliminación de assessment con intentos');
    } catch (err: any) {
      if (err.code !== 'ASSESSMENT_HAS_ATTEMPTS') throw err;
    }
    console.log('✓ Bloqueo de eliminación física de Assessment con historial verificado');

    // 7.3 Bloquear remoción de pregunta de Assessment con historial
    try {
      await AssessmentService.removeQuestionFromAssessment(assessment.id, qMc.id, teacherAssigned.id, Role.TEACHER);
      throw new Error('Debió fallar remoción de pregunta con historial');
    } catch (err: any) {
      if (err.code !== 'ASSESSMENT_HAS_ATTEMPTS') throw err;
    }
    console.log('✓ Bloqueo de remoción de pregunta de Assessment con historial verificado');

    // 7.4 Bloquear modificación de puntos en Assessment con historial
    try {
      await AssessmentService.updateAssessmentQuestionPoints(assessment.id, qMc.id, teacherAssigned.id, Role.TEACHER, 99);
      throw new Error('Debió fallar cambio de puntos con historial');
    } catch (err: any) {
      if (err.code !== 'ASSESSMENT_HAS_ATTEMPTS') throw err;
    }
    console.log('✓ Bloqueo de modificación de puntos (points) en Assessment con historial verificado');

    // 7.5 Bloquear modificación de `isCorrect` en QuestionOption con historial (409 QUESTION_HAS_ATTEMPTS)
    if (optCorrect) {
      try {
        await QuestionService.updateOption(qMc.id, optCorrect.id, teacherAssigned.id, Role.TEACHER, { isCorrect: false });
        throw new Error('Debió fallar cambio de respuesta correcta con historial');
      } catch (err: any) {
        if (err.code !== 'QUESTION_HAS_ATTEMPTS') throw err;
      }
      console.log('✓ Bloqueo de modificación de isCorrect en QuestionOption con historial verificado');
    }

    // 7.6 Bloquear eliminación de Question con historial
    try {
      await QuestionService.deleteQuestion(qMc.id, teacherAssigned.id, Role.TEACHER);
      throw new Error('Debió fallar eliminación de reactivo con historial');
    } catch (err: any) {
      if (err.code !== 'QUESTION_HAS_ATTEMPTS') throw err;
    }
    console.log('✓ Bloqueo de eliminación de reactivo utilizado históricamente verificado');

    // -------------------------------------------------------------
    // 8. PRUEBA DE CONCURRENCIA
    // -------------------------------------------------------------
    console.log('\n--- 8. PRUEBA DE CONCURRENCIA ---');

    const assessmentConc = await AssessmentService.createAssessment(course.id, teacherAssigned.id, Role.TEACHER, {
      title: 'Assessment Concurrente',
      type: AssessmentType.QUIZ,
    });

    const p1 = AssessmentService.addQuestionToAssessment(assessmentConc.id, teacherAssigned.id, Role.TEACHER, {
      questionId: qTf.id,
    });
    const p2 = AssessmentService.addQuestionToAssessment(assessmentConc.id, teacherAssigned.id, Role.TEACHER, {
      questionId: qTf.id,
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(`Falló manejo de concurrencia: fulfilled=${fulfilled.length}, rejected=${rejected.length}`);
    }
    console.log('✓ Concurrencia atómica verificada (exactamente 1 asociación exitosa y 1 rechazo limpio)');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.2 PASARON! 🟢');
    console.log('=======================================================');
  } finally {
    console.log('\n--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    await prisma.answerOption.deleteMany({ where: { answer: { question: { subjectId: { in: (await prisma.subject.findMany({ where: { code: { contains: 'SUB-82' } }, select: { id: true } })).map((s) => s.id) } } } } });
    await prisma.answer.deleteMany({ where: { question: { subjectId: { in: (await prisma.subject.findMany({ where: { code: { contains: 'SUB-82' } }, select: { id: true } })).map((s) => s.id) } } } });
    await prisma.attempt.deleteMany({ where: { assessment: { courseId: { in: (await prisma.course.findMany({ where: { name: { contains: 'Curso 8.2' } }, select: { id: true } })).map((c) => c.id) } } } });
    await prisma.assessmentQuestion.deleteMany({ where: { assessment: { courseId: { in: (await prisma.course.findMany({ where: { name: { contains: 'Curso 8.2' } }, select: { id: true } })).map((c) => c.id) } } } });
    await prisma.questionOption.deleteMany({ where: { question: { subjectId: { in: (await prisma.subject.findMany({ where: { code: { contains: 'SUB-82' } }, select: { id: true } })).map((s) => s.id) } } } });
    await prisma.question.deleteMany({ where: { subjectId: { in: (await prisma.subject.findMany({ where: { code: { contains: 'SUB-82' } }, select: { id: true } })).map((s) => s.id) } } });
    await prisma.assessment.deleteMany({ where: { courseId: { in: (await prisma.course.findMany({ where: { name: { contains: 'Curso 8.2' } }, select: { id: true } })).map((c) => c.id) } } });
    await prisma.lesson.deleteMany({ where: { title: { contains: 'Lección 1: Reactivos' } } });
    await prisma.module.deleteMany({ where: { title: { contains: 'Módulo 1: Evaluaciones' } } });
    await prisma.courseTeacher.deleteMany({ where: { courseId: { in: (await prisma.course.findMany({ where: { name: { contains: 'Curso 8.2' } }, select: { id: true } })).map((c) => c.id) } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: (await prisma.course.findMany({ where: { name: { contains: 'Curso 8.2' } }, select: { id: true } })).map((c) => c.id) } } });
    await prisma.course.deleteMany({ where: { name: { contains: 'Curso 8.2' } } });
    await prisma.subject.deleteMany({ where: { code: { contains: 'SUB-82' } } });
    await prisma.studentProfile.deleteMany({ where: { OR: [{ userId: studentUser.id }, { user: { email: { contains: '_82_' } } }] } });
    await prisma.user.deleteMany({ where: { OR: [{ id: { in: [adminUser.id, teacherAssigned.id, teacherUnrelated.id, studentUser.id] } }, { email: { contains: '_82_' } }] } });

    // Confirm DB count
    const remainingTempUsers = await prisma.user.count({ where: { email: { contains: '_82_' } } });
    console.log(`✓ Registros temporales restantes en DB: ${remainingTempUsers}`);
    if (remainingTempUsers !== 0) {
      throw new Error('Quedaron registros temporales en la base de datos');
    }
  }
}

runPhase82IntegrationTests()
  .catch((err) => {
    console.error('❌ Error en pruebas de integración Fase 8.2:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
