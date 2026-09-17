import { Role, CourseStatus, EnrollmentStatus, QuestionType, AssessmentType, AttemptStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { GradebookService } from '../src/services/gradebook.service';
import { AssessmentService } from '../src/services/assessment.service';
import { CourseService } from '../src/services/course.service';
import { AttemptService } from '../src/services/attempt.service';

async function runPhase85IntegrationTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.5 (GRADEBOOK & CALIFICACIÓN FINAL) ===\n');

  const createdUserIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdQuestionIds: string[] = [];

  try {
    const timestamp = Date.now();

    // 1. SETUP DE USUARIOS Y ROLES
    const admin = await prisma.user.create({
      data: {
        name: 'Admin 8.5 Test',
        email: `admin85_${timestamp}@potrolearn.edu.mx`,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(admin.id);

    const teacherAssigned = await prisma.user.create({
      data: {
        name: 'Teacher Assigned 8.5',
        email: `teacher_assigned85_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacherAssigned.id);

    const teacherUnassigned = await prisma.user.create({
      data: {
        name: 'Teacher Unassigned 8.5',
        email: `teacher_unassigned85_${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    createdUserIds.push(teacherUnassigned.id);

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 8.5',
        email: `studentA85_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S85A${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentA.id);

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 8.5',
        email: `studentB85_${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: `S85B${timestamp.toString().slice(-4)}`,
          },
        },
      },
    });
    createdUserIds.push(studentB.id);

    // 2. MATERIA Y CURSO
    const subject = await prisma.subject.create({
      data: {
        code: `SUB85_${timestamp}`,
        name: 'Materia 8.5 Test',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso 8.5 Gradebook Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    // Asignación de Maestro y Alumnos
    await prisma.courseTeacher.create({
      data: { courseId: course.id, teacherId: teacherAssigned.id },
    });

    await prisma.enrollment.create({
      data: { courseId: course.id, studentId: studentA.id, status: EnrollmentStatus.ACTIVE },
    });

    await prisma.enrollment.create({
      data: { courseId: course.id, studentId: studentB.id, status: EnrollmentStatus.ACTIVE },
    });

    console.log('✓ 1. Setup de usuarios, materia, curso e inscripciones completado.\n');

    // 3. PREGUNTAS Y EVALUACIONES
    const q1 = await prisma.question.create({
      data: {
        statement: 'Pregunta V/F 1',
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
    createdQuestionIds.push(q1.id);

    // Evaluación 1: Quiz 40% (Publicada)
    const assessment1 = await AssessmentService.createAssessment(course.id, admin.id, Role.ADMIN, {
      title: 'Quiz 1 (40%)',
      type: AssessmentType.QUIZ,
      weight: 40,
    });
    createdAssessmentIds.push(assessment1.id);
    await AssessmentService.addQuestionToAssessment(assessment1.id, admin.id, Role.ADMIN, { questionId: q1.id, points: 10 });
    await AssessmentService.togglePublication(assessment1.id, admin.id, Role.ADMIN, true);

    // Evaluación 2: Examen 60% (Publicada)
    const assessment2 = await AssessmentService.createAssessment(course.id, admin.id, Role.ADMIN, {
      title: 'Examen Final (60%)',
      type: AssessmentType.EXAM,
      weight: 60,
    });
    createdAssessmentIds.push(assessment2.id);
    await AssessmentService.addQuestionToAssessment(assessment2.id, admin.id, Role.ADMIN, { questionId: q1.id, points: 10 });
    await AssessmentService.togglePublication(assessment2.id, admin.id, Role.ADMIN, true);

    // Evaluación 3: Draft (10%)
    const assessment3 = await AssessmentService.createAssessment(course.id, admin.id, Role.ADMIN, {
      title: 'Proyecto Extra (10% Draft)',
      type: AssessmentType.QUIZ,
      weight: 10,
    });
    createdAssessmentIds.push(assessment3.id);
    await AssessmentService.addQuestionToAssessment(assessment3.id, admin.id, Role.ADMIN, { questionId: q1.id, points: 10 });

    console.log('✓ 2. Evaluaciones creadas (Quiz 40%, Examen 60%, Draft 10%).\n');

    // 4. VALIDACIÓN DE PESOS Y LÍMITES (> 100%)
    console.log('--- 4. PRUEBA DE VALIDACIÓN DE PESOS TOTALES (> 100%) ---');
    try {
      // Intentar publicar Assessment 3 (Total sería 40 + 60 + 10 = 110%)
      await AssessmentService.togglePublication(assessment3.id, admin.id, Role.ADMIN, true);
      throw new Error('Debió ser rechazado publicar Assessment 3 que excede el 100%');
    } catch (err: any) {
      if (err.code !== 'TOTAL_WEIGHT_EXCEEDED') {
        throw new Error(`Se esperaba TOTAL_WEIGHT_EXCEEDED y se obtuvo ${err.code}: ${err.message}`);
      }
      console.log('✓ Rechazo al intentar publicar evaluación que excede el 100% de peso (TOTAL_WEIGHT_EXCEEDED) verificado');
    }

    try {
      // Intentar actualizar el peso de Assessment 1 a 50% mientras está publicada (50 + 60 = 110%)
      await AssessmentService.updateAssessment(assessment1.id, admin.id, Role.ADMIN, { weight: 50 });
      throw new Error('Debió ser rechazado modificar peso a 50% que excede el 100%');
    } catch (err: any) {
      if (err.code !== 'TOTAL_WEIGHT_EXCEEDED') {
        throw new Error(`Se esperaba TOTAL_WEIGHT_EXCEEDED y se obtuvo ${err.code}: ${err.message}`);
      }
      console.log('✓ Rechazo al actualizar peso de evaluación publicada que excede 100% verificado\n');
    }

    // 5. REGISTRO DE INTENTOS Y BEST SCORE (MAX SCORE)
    console.log('--- 5. REGISTRO DE INTENTOS Y BEST SCORE (MAX SCORE) ---');
    const tfOptCorrect = q1.options.find((o) => o.isCorrect)!;
    const tfOptIncorrect = q1.options.find((o) => !o.isCorrect)!;

    // Student A en Assessment 1:
    // Intento 1: falla la pregunta -> score = 0
    const attA1_1 = await AttemptService.startOrResumeAttempt(assessment1.id, studentA.id);
    await AttemptService.saveAnswer(attA1_1.id, q1.id, studentA.id, { optionIds: [tfOptIncorrect.id] });
    await AttemptService.submitAttempt(attA1_1.id, studentA.id, Role.STUDENT);

    // Intento 2: acierta la pregunta -> score = 100
    const attA1_2 = await AttemptService.startOrResumeAttempt(assessment1.id, studentA.id);
    await AttemptService.saveAnswer(attA1_2.id, q1.id, studentA.id, { optionIds: [tfOptCorrect.id] });
    await AttemptService.submitAttempt(attA1_2.id, studentA.id, Role.STUDENT);

    // Student A en Assessment 2 (Examen):
    // Intento 1: acierta -> score = 100
    const attA2_1 = await AttemptService.startOrResumeAttempt(assessment2.id, studentA.id);
    await AttemptService.saveAnswer(attA2_1.id, q1.id, studentA.id, { optionIds: [tfOptCorrect.id] });
    await AttemptService.submitAttempt(attA2_1.id, studentA.id, Role.STUDENT);

    // Student B en Assessment 1 (Quiz):
    // Intento 1: acierta -> score = 100
    const attB1_1 = await AttemptService.startOrResumeAttempt(assessment1.id, studentB.id);
    await AttemptService.saveAnswer(attB1_1.id, q1.id, studentB.id, { optionIds: [tfOptCorrect.id] });
    await AttemptService.submitAttempt(attB1_1.id, studentB.id, Role.STUDENT);

    // Student B no realiza el Assessment 2 (NO_ATTEMPT).

    console.log('✓ Intentos completados. Student A: Quiz MAX=100, Examen MAX=100. Student B: Quiz MAX=100, Examen NO_ATTEMPT.\n');

    // 6. CÁLCULOS DE TEACHER GRADEBOOK DE CURSO ACTIVO
    console.log('--- 6. PRUEBA DE CÁLCULO DE TEACHER GRADEBOOK (CURSO ACTIVO) ---');
    const teacherGb = await GradebookService.getTeacherGradebook(course.id, teacherAssigned.id, Role.TEACHER);

    if (teacherGb.totalEvaluatedWeight !== 100) {
      throw new Error(`Se esperaba totalEvaluatedWeight = 100 y se obtuvo ${teacherGb.totalEvaluatedWeight}`);
    }

    const gbStudentA = teacherGb.students.find((s) => s.studentId === studentA.id)!;
    if (gbStudentA.currentGrade !== 100.00) {
      throw new Error(`Se esperaba Current Grade 100.00 para Student A y se obtuvo ${gbStudentA.currentGrade}`);
    }
    if (gbStudentA.finalGrade !== null) {
      throw new Error(`Se esperaba Final Grade null en curso ACTIVO para Student A y se obtuvo ${gbStudentA.finalGrade}`);
    }

    const gbStudentB = teacherGb.students.find((s) => s.studentId === studentB.id)!;
    // Student B sólo tiene evaluado el Quiz (40%). score = 100.
    // currentGrade = (100 * 40) / 40 = 100.00 (normalizado proporcional sobre lo evaluado).
    if (gbStudentB.currentGrade !== 100.00) {
      throw new Error(`Se esperaba Current Grade 100.00 para Student B y se obtuvo ${gbStudentB.currentGrade}`);
    }
    if (gbStudentB.finalGrade !== null) {
      throw new Error(`Se esperaba Final Grade null en curso ACTIVO para Student B y se obtuvo ${gbStudentB.finalGrade}`);
    }

    console.log('✓ Teacher Gradebook en curso ACTIVO verificado correctamente.\n');

    // 7. PRUEBAS DE AUTORIZACIÓN / ACCESO IDOR
    console.log('--- 7. PRUEBAS DE AUTORIZACIÓN Y CONTROL DE ACCESO ---');
    // Teacher no asignado
    try {
      await GradebookService.getTeacherGradebook(course.id, teacherUnassigned.id, Role.TEACHER);
      throw new Error('Teacher no asignado debió ser rechazado');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') {
        throw new Error(`Se esperaba FORBIDDEN y se obtuvo ${err.code}`);
      }
      console.log('✓ Rechazo de Teacher no asignado verificado');
    }

    // Student intentando acceder al Gradebook general
    try {
      await GradebookService.getTeacherGradebook(course.id, studentA.id, Role.STUDENT);
      throw new Error('Estudiante debió ser rechazado del Gradebook general');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') {
        throw new Error(`Se esperaba FORBIDDEN y se obtuvo ${err.code}`);
      }
      console.log('✓ Rechazo de Estudiante en Gradebook general verificado');
    }

    // 8. BOLETA INDIVIDUAL DE ESTUDIANTE (STUDENT GRADES DTO)
    console.log('--- 8. PRUEBA DE BOLETA INDIVIDUAL DE ESTUDIANTE ---');
    const studentAGrades = await GradebookService.getStudentGrades(course.id, studentA.id);
    if (studentAGrades.currentGrade !== 100.00 || studentAGrades.finalGrade !== null) {
      throw new Error('Boleta de Student A no coincide con los valores calculados');
    }
    const a1Detail = studentAGrades.assessments.find((a) => a.assessmentId === assessment1.id)!;
    if (a1Detail.bestScore !== 100.00 || a1Detail.weightContribution !== 40.00 || a1Detail.attemptsUsed !== 2) {
      throw new Error('Detalle de Quiz 1 para Student A incorrecto');
    }

    const studentBGrades = await GradebookService.getStudentGrades(course.id, studentB.id);
    const a2DetailB = studentBGrades.assessments.find((a) => a.assessmentId === assessment2.id)!;
    if (a2DetailB.status !== 'NO_ATTEMPT' || a2DetailB.bestScore !== null) {
      throw new Error('Detalle de Examen para Student B debió registrar status NO_ATTEMPT');
    }
    console.log('✓ Boleta individual de estudiante (StudentGradesDTO) verificada correctamente.\n');

    // 9. CONSOLIDACIÓN DE FINAL GRADE AL CONCLUIR CURSO (STATUS = FINISHED)
    console.log('--- 9. PRUEBA DE CONSOLIDACIÓN Y TRANSICIÓN DE CURSO A FINISHED ---');
    await CourseService.changeCourseStatus(course.id, CourseStatus.FINISHED, { id: admin.id, role: Role.ADMIN });

    const enrollmentA = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: studentA.id } },
    });
    if (enrollmentA?.status !== EnrollmentStatus.COMPLETED || enrollmentA.finalGrade?.toNumber() !== 100.00) {
      throw new Error(`Se esperaba finalGrade 100.00 y status COMPLETED para Student A. Se obtuvo grade=${enrollmentA?.finalGrade} status=${enrollmentA?.status}`);
    }

    const enrollmentB = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: studentB.id } },
    });
    // Student B tiene 100 en Quiz (40%) y 0 en Examen (60% no presentado).
    // Final Grade = (100 * 0.40) / 1.00 = 40.00.
    if (enrollmentB?.status !== EnrollmentStatus.COMPLETED || enrollmentB.finalGrade?.toNumber() !== 40.00) {
      throw new Error(`Se esperaba finalGrade 40.00 y status COMPLETED para Student B. Se obtuvo grade=${enrollmentB?.finalGrade} status=${enrollmentB?.status}`);
    }

    console.log('✓ Consolidación transaccional de Final Grade (Student A = 100.00, Student B = 40.00) al finalizar curso verificada.\n');

    // 10. BLOQUEO DE EDICIÓN EN CURSOS CERRADOS
    console.log('--- 10. PRUEBA DE BLOQUEO DE EDICIÓN EN CURSO FINALIZADO ---');
    try {
      await AssessmentService.updateAssessment(assessment1.id, admin.id, Role.ADMIN, { title: 'Nuevo Título' });
      throw new Error('No se debió permitir modificar un assessment en un curso FINISHED');
    } catch (err: any) {
      if (err.code !== 'COURSE_CONTENT_READ_ONLY') {
        throw new Error(`Se esperaba COURSE_CONTENT_READ_ONLY y se obtuvo ${err.code}`);
      }
      console.log('✓ Bloqueo de modificación de contenido en curso FINISHED verificado.\n');
    }

    // 11. PRUEBA DE EVALUACIÓN DIAGNÓSTICA / FORMATIVA (WEIGHT = 0.00%)
    console.log('--- 11. PRUEBA DE EVALUACIÓN CON WEIGHT = 0.00% ---');
    const courseActive0 = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso Weight 0 Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(courseActive0.id);

    await prisma.courseTeacher.create({
      data: { courseId: courseActive0.id, teacherId: teacherAssigned.id },
    });

    await prisma.enrollment.create({
      data: { courseId: courseActive0.id, studentId: studentA.id, status: EnrollmentStatus.ACTIVE },
    });

    const assessmentWeight0 = await AssessmentService.createAssessment(courseActive0.id, admin.id, Role.ADMIN, {
      title: 'Diagnóstico Sin Peso (0%)',
      type: AssessmentType.QUIZ,
      weight: 0,
    });
    createdAssessmentIds.push(assessmentWeight0.id);
    await AssessmentService.addQuestionToAssessment(assessmentWeight0.id, admin.id, Role.ADMIN, { questionId: q1.id, points: 10 });
    await AssessmentService.togglePublication(assessmentWeight0.id, admin.id, Role.ADMIN, true);

    const att0 = await AttemptService.startOrResumeAttempt(assessmentWeight0.id, studentA.id);
    await AttemptService.saveAnswer(att0.id, q1.id, studentA.id, { optionIds: [tfOptCorrect.id] });
    await AttemptService.submitAttempt(att0.id, studentA.id, Role.STUDENT);

    const gb0 = await GradebookService.getTeacherGradebook(courseActive0.id, teacherAssigned.id, Role.TEACHER);
    const gb0StudentA = gb0.students.find((s) => s.studentId === studentA.id)!;
    if (gb0StudentA.grades[assessmentWeight0.id]?.score !== 100) {
      throw new Error('La evaluación con weight=0 debe mostrar la nota obtenida (100)');
    }
    if (gb0StudentA.currentGrade !== null) {
      throw new Error('Un curso únicamente con evaluaciones de weight=0 debe devolver currentGrade null');
    }

    const stGrades0 = await GradebookService.getStudentGrades(courseActive0.id, studentA.id);
    const detail0 = stGrades0.assessments.find((a) => a.assessmentId === assessmentWeight0.id)!;
    if (detail0.weight !== 0 || detail0.weightContribution !== 0) {
      throw new Error('La contribución de peso para evaluación weight=0 debe ser 0');
    }
    console.log('✓ Evaluación con weight = 0.00% verificada (visible en DTO sin alterar promedios).\n');

    // 12. PRUEBA DE REGRADING EN CURSO FINALIZADO (STATUS = FINISHED)
    console.log('--- 12. PRUEBA DE REGRADING EN CURSO FINALIZADO ---');
    const courseRegrade = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso Regrade FINISHED Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(courseRegrade.id);

    await prisma.courseTeacher.create({
      data: { courseId: courseRegrade.id, teacherId: teacherAssigned.id },
    });

    const enrRegrade = await prisma.enrollment.create({
      data: { courseId: courseRegrade.id, studentId: studentA.id, status: EnrollmentStatus.ACTIVE },
    });

    const qOpen = await prisma.question.create({
      data: {
        statement: 'Pregunta Abierta Regrade',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 10,
      },
    });
    createdQuestionIds.push(qOpen.id);

    const assessmentRegrade = await AssessmentService.createAssessment(courseRegrade.id, admin.id, Role.ADMIN, {
      title: 'Examen Abierto 100%',
      type: AssessmentType.EXAM,
      weight: 100,
    });
    createdAssessmentIds.push(assessmentRegrade.id);
    await AssessmentService.addQuestionToAssessment(assessmentRegrade.id, admin.id, Role.ADMIN, { questionId: qOpen.id, points: 10 });
    await AssessmentService.togglePublication(assessmentRegrade.id, admin.id, Role.ADMIN, true);

    const attRegrade = await AttemptService.startOrResumeAttempt(assessmentRegrade.id, studentA.id);
    await AttemptService.saveAnswer(attRegrade.id, qOpen.id, studentA.id, { textValue: 'Respuesta ensayo...' });
    await AttemptService.submitAttempt(attRegrade.id, studentA.id, Role.STUDENT);

    // Primera calificación manual: 5.0 pts (50%)
    await AttemptService.gradeAnswer(
      attRegrade.id,
      qOpen.id,
      teacherAssigned.id,
      Role.TEACHER,
      { pointsEarned: 5, feedback: 'Calificación inicial' },
      ['pointsEarned', 'feedback']
    );

    // Finalizar el curso
    await CourseService.changeCourseStatus(courseRegrade.id, CourseStatus.FINISHED, { id: admin.id, role: Role.ADMIN });

    const enrCheck1 = await prisma.enrollment.findUnique({ where: { id: enrRegrade.id } });
    if (enrCheck1?.finalGrade?.toNumber() !== 50.00 || enrCheck1.status !== EnrollmentStatus.COMPLETED) {
      throw new Error(`Se esperaba finalGrade=50.00 antes del regrading. Se obtuvo ${enrCheck1?.finalGrade}`);
    }

    // Regrading posterior en curso FINISHED: cambiar nota de 5 pts (50%) a 9 pts (90%)
    await AttemptService.gradeAnswer(
      attRegrade.id,
      qOpen.id,
      teacherAssigned.id,
      Role.TEACHER,
      { pointsEarned: 9, feedback: 'Regrading aceptado' },
      ['pointsEarned', 'feedback']
    );

    const enrCheck2 = await prisma.enrollment.findUnique({ where: { id: enrRegrade.id } });
    if (enrCheck2?.finalGrade?.toNumber() !== 90.00) {
      throw new Error(`Se esperaba que finalGrade persistido se actualizara a 90.00 tras el regrading. Se obtuvo ${enrCheck2?.finalGrade}`);
    }

    const attCheck = await prisma.attempt.findUnique({ where: { id: attRegrade.id } });
    if (attCheck?.score?.toNumber() !== 90.00) {
      throw new Error(`Se esperaba Attempt.score = 90.00. Se obtuvo ${attCheck?.score}`);
    }

    const totalEnrollments = await prisma.enrollment.count({ where: { courseId: courseRegrade.id } });
    if (totalEnrollments !== 1) {
      throw new Error(`No debieron crearse duplicados de Enrollment. Total: ${totalEnrollments}`);
    }
    console.log('✓ Regrading en curso FINISHED verificado (Attempt.score y Enrollment.finalGrade persistidos a 90.00 sin duplicados).\n');

    // 13. PRUEBAS DE PENDING_GRADING Y BLOQUEO UNGRADED_ATTEMPTS_EXIST (TEST A, TEST B, TEST C)
    console.log('--- 13. PRUEBAS DE PENDING_GRADING Y BLOQUEO UNGRADED_ATTEMPTS_EXIST ---');

    // Escenario A & B: Curso con evaluación OPEN_TEXT
    const coursePending = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso Pending Grading Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(coursePending.id);

    await prisma.courseTeacher.create({
      data: { courseId: coursePending.id, teacherId: teacherAssigned.id },
    });

    const enrPending = await prisma.enrollment.create({
      data: { courseId: coursePending.id, studentId: studentA.id, status: EnrollmentStatus.ACTIVE },
    });

    const qOpenPending = await prisma.question.create({
      data: {
        statement: 'Pregunta Ensayo Pendiente',
        type: QuestionType.OPEN_TEXT,
        defaultPoints: 10,
      },
    });
    createdQuestionIds.push(qOpenPending.id);

    const assessmentPending = await AssessmentService.createAssessment(coursePending.id, admin.id, Role.ADMIN, {
      title: 'Examen Ensayo 100%',
      type: AssessmentType.EXAM,
      weight: 100,
    });
    createdAssessmentIds.push(assessmentPending.id);
    await AssessmentService.addQuestionToAssessment(assessmentPending.id, admin.id, Role.ADMIN, { questionId: qOpenPending.id, points: 10 });
    await AssessmentService.togglePublication(assessmentPending.id, admin.id, Role.ADMIN, true);

    // Student A entrega attempt con OPEN_TEXT
    const attPending = await AttemptService.startOrResumeAttempt(assessmentPending.id, studentA.id);
    await AttemptService.saveAnswer(attPending.id, qOpenPending.id, studentA.id, { textValue: 'Mi ensayo...' });
    await AttemptService.submitAttempt(attPending.id, studentA.id, Role.STUDENT);

    const attPendingState = await prisma.attempt.findUnique({ where: { id: attPending.id } });
    if (attPendingState?.status !== AttemptStatus.SUBMITTED) {
      throw new Error(`Se esperaba Attempt.status = SUBMITTED, obtenido: ${attPendingState?.status}`);
    }

    // TEST A: Intentar ACTIVE -> FINISHED (debe ser bloqueado por HTTP 400 UNGRADED_ATTEMPTS_EXIST)
    try {
      await CourseService.changeCourseStatus(coursePending.id, CourseStatus.FINISHED, { id: admin.id, role: Role.ADMIN });
      throw new Error('Debió ser rechazado finalizar el curso con entregas OPEN_TEXT pendientes');
    } catch (err: any) {
      if (err.code !== 'UNGRADED_ATTEMPTS_EXIST') {
        throw new Error(`Se esperaba UNGRADED_ATTEMPTS_EXIST y se obtuvo ${err.code}: ${err.message}`);
      }
      console.log('✓ TEST A: FINISHED bloqueado exitosamente por UNGRADED_ATTEMPTS_EXIST cuando existen entregas OPEN_TEXT pendientes');
    }

    // Confirmar estado intacto
    const coursePendingCheck = await prisma.course.findUnique({ where: { id: coursePending.id } });
    if (coursePendingCheck?.status !== CourseStatus.ACTIVE) {
      throw new Error(`El curso debió permanecer ACTIVE, obtenido: ${coursePendingCheck?.status}`);
    }
    const enrPendingCheck = await prisma.enrollment.findUnique({ where: { id: enrPending.id } });
    if (enrPendingCheck?.status !== EnrollmentStatus.ACTIVE || enrPendingCheck.finalGrade !== null) {
      throw new Error(`El enrollment debió permanecer ACTIVE y finalGrade null`);
    }

    // TEST B: Calificar el OPEN_TEXT y permitir FINISHED
    await AttemptService.gradeAnswer(
      attPending.id,
      qOpenPending.id,
      teacherAssigned.id,
      Role.TEACHER,
      { pointsEarned: 10, feedback: 'Excelente trabajo' },
      ['pointsEarned', 'feedback']
    );

    const attGradedState = await prisma.attempt.findUnique({ where: { id: attPending.id } });
    if (attGradedState?.status !== AttemptStatus.GRADED) {
      throw new Error(`Se esperaba Attempt.status = GRADED tras calificar, obtenido: ${attGradedState?.status}`);
    }

    await CourseService.changeCourseStatus(coursePending.id, CourseStatus.FINISHED, { id: admin.id, role: Role.ADMIN });

    const courseFinishedCheck = await prisma.course.findUnique({ where: { id: coursePending.id } });
    if (courseFinishedCheck?.status !== CourseStatus.FINISHED) {
      throw new Error(`El curso debió cambiar a FINISHED`);
    }
    const enrCompletedCheck = await prisma.enrollment.findUnique({ where: { id: enrPending.id } });
    if (enrCompletedCheck?.status !== EnrollmentStatus.COMPLETED || enrCompletedCheck.finalGrade?.toNumber() !== 100.00) {
      throw new Error(`El enrollment debió cambiar a COMPLETED con finalGrade 100.00`);
    }
    console.log('✓ TEST B: FINISHED permitido exitosamente tras calificar todas las preguntas OPEN_TEXT');

    // TEST C: Curso con evaluación puramente objetiva no bloquea FINISHED
    const courseObjective = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: admin.id,
        name: 'Curso Objective Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(courseObjective.id);

    await prisma.courseTeacher.create({
      data: { courseId: courseObjective.id, teacherId: teacherAssigned.id },
    });

    await prisma.enrollment.create({
      data: { courseId: courseObjective.id, studentId: studentA.id, status: EnrollmentStatus.ACTIVE },
    });

    const assessmentObjective = await AssessmentService.createAssessment(courseObjective.id, admin.id, Role.ADMIN, {
      title: 'Quiz Objetivo 100%',
      type: AssessmentType.QUIZ,
      weight: 100,
    });
    createdAssessmentIds.push(assessmentObjective.id);
    await AssessmentService.addQuestionToAssessment(assessmentObjective.id, admin.id, Role.ADMIN, { questionId: q1.id, points: 10 });
    await AssessmentService.togglePublication(assessmentObjective.id, admin.id, Role.ADMIN, true);

    const attObj = await AttemptService.startOrResumeAttempt(assessmentObjective.id, studentA.id);
    await AttemptService.saveAnswer(attObj.id, q1.id, studentA.id, { optionIds: [tfOptCorrect.id] });
    await AttemptService.submitAttempt(attObj.id, studentA.id, Role.STUDENT);

    // Intentar ACTIVE -> FINISHED
    await CourseService.changeCourseStatus(courseObjective.id, CourseStatus.FINISHED, { id: admin.id, role: Role.ADMIN });

    const courseObjFinished = await prisma.course.findUnique({ where: { id: courseObjective.id } });
    if (courseObjFinished?.status !== CourseStatus.FINISHED) {
      throw new Error(`El curso con evaluación objetiva debió cambiar a FINISHED`);
    }
    console.log('✓ TEST C: Evaluaciones puramente objetivas no bloquean el cierre de curso (UNGRADED_ATTEMPTS_EXIST no emitido)\n');

    console.log('=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.5 PASARON! 🟢');
    console.log('=======================================================\n');

  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 8.5:', error);
    process.exit(1);
  } finally {
    console.log('--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
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

    console.log('✓ Teardown completado exitosamente.\n');
    await prisma.$disconnect();
  }
}

runPhase85IntegrationTests();
