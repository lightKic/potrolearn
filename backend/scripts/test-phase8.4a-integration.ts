import { Role, CourseStatus, EnrollmentStatus, AssessmentType, AttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AttemptService } from '../src/services/attempt.service';
import { AuthError } from '../src/types/auth.types';

async function runPhase84AIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.4-A (ATTEMPT LIFECYCLE & AUTHORIZATION) ---\n');

  const timestamp = Date.now();
  const testSubjectCode = `SUBJ_84A_${timestamp}`;
  const studentAEmail = `studentA_84a_${timestamp}@uaemex.mx`;
  const studentBEmail = `studentB_84a_${timestamp}@uaemex.mx`;
  const teacherEmail = `teacher_84a_${timestamp}@uaemex.mx`;
  const adminEmail = `admin_84a_${timestamp}@uaemex.mx`;
  const studentAMatricula = `0084A1_${Math.floor(1000 + Math.random() * 9000)}`;
  const studentBMatricula = `0084A2_${Math.floor(1000 + Math.random() * 9000)}`;

  let subjectId: string = '';
  let courseId: string = '';
  let studentAId: string = '';
  let studentBId: string = '';
  let teacherId: string = '';
  let adminId: string = '';
  let publishedAssessmentId: string = '';
  let unpublishedAssessmentId: string = '';
  let futureAvailableAssessmentId: string = '';
  let expiredAvailableAssessmentId: string = '';
  let maxAttemptsAssessmentId: string = '';

  const createdAttemptIds: string[] = [];

  try {
    // 1. SETUP DE DATOS TEMPORALES
    console.log('1. Configurando datos temporales de prueba (Usuarios, Asignaturas, Curso, Inscripciones, Evaluaciones)...');
    
    const subject = await prisma.subject.create({
      data: {
        code: testSubjectCode,
        name: 'Asignatura 8.4-A Test',
      },
    });
    subjectId = subject.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Admin 8.4A',
        email: adminEmail,
        role: Role.ADMIN,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    adminId = admin.id;

    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher 8.4A',
        email: teacherEmail,
        role: Role.TEACHER,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
      },
    });
    teacherId = teacher.id;

    const studentA = await prisma.user.create({
      data: {
        name: 'Student A 8.4A',
        email: studentAEmail,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: studentAMatricula,
          },
        },
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        name: 'Student B 8.4A',
        email: studentBEmail,
        role: Role.STUDENT,
        passwordHash: 'dummyhash',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: {
            studentNumber: studentBMatricula,
          },
        },
      },
    });
    studentBId = studentB.id;

    const course = await prisma.course.create({
      data: {
        subjectId,
        createdById: adminId,
        name: 'Curso 8.4A Test',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.ACTIVE,
        courseTeachers: {
          create: {
            teacherId,
          },
        },
        enrollments: {
          create: {
            studentId: studentAId,
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
    });
    courseId = course.id;

    // Evaluaciones para distintas pruebas
    const pubAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Publicada Base',
        type: AssessmentType.QUIZ,
        isPublished: true,
      },
    });
    publishedAssessmentId = pubAssessment.id;

    const unpubAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Borrador No Publicada',
        type: AssessmentType.QUIZ,
        isPublished: false,
      },
    });
    unpublishedAssessmentId = unpubAssessment.id;

    const futureAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Futura',
        type: AssessmentType.QUIZ,
        isPublished: true,
        availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    futureAvailableAssessmentId = futureAssessment.id;

    const expiredAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Cerrada Past',
        type: AssessmentType.QUIZ,
        isPublished: true,
        availableUntil: new Date(Date.now() - 60 * 1000),
      },
    });
    expiredAvailableAssessmentId = expiredAssessment.id;

    const maxAttAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Max 1 Intento',
        type: AssessmentType.QUIZ,
        isPublished: true,
        maxAttempts: 1,
      },
    });
    maxAttemptsAssessmentId = maxAttAssessment.id;

    console.log('✓ Setup de datos completado exitosamente.\n');

    // 2. PRUEBA: HAPPY PATH - PRIMER ATTEMPT
    console.log('--- 2. PRUEBA: HAPPY PATH (PRIMER ATTEMPT) ---');
    const attempt1 = await AttemptService.startOrResumeAttempt(publishedAssessmentId, studentAId);
    createdAttemptIds.push(attempt1.id);
    if (attempt1.attemptNumber !== 1 || attempt1.status !== AttemptStatus.IN_PROGRESS) {
      throw new Error(`Happy path falló: attemptNumber se esperaba 1, se obtuvo ${attempt1.attemptNumber}. Status se esperaba IN_PROGRESS, se obtuvo ${attempt1.status}`);
    }
    console.log('✓ Primer attempt iniciado correctamente: attemptNumber = 1, status = IN_PROGRESS.');

    // 3. PRUEBA: RESUME
    console.log('\n--- 3. PRUEBA: RESUME DE ATTEMPT EN PROGRESO ---');
    const resumedAttempt = await AttemptService.startOrResumeAttempt(publishedAssessmentId, studentAId);
    if (resumedAttempt.id !== attempt1.id || resumedAttempt.attemptNumber !== 1) {
      throw new Error('Resume falló: no devolvió el mismo Attempt IN_PROGRESS existente');
    }
    console.log('✓ Resume de Attempt verificado: devuelve exactamente el mismo Attempt IN_PROGRESS.');

    // 4. PRUEBA: SEQUENTIAL NUMBERING
    console.log('\n--- 4. PRUEBA: SECUENCIA DE INTENTOS ---');
    // Marcar intento 1 como GRADED para simular finalización
    await prisma.attempt.update({
      where: { id: attempt1.id },
      data: { status: AttemptStatus.GRADED, score: new Prisma.Decimal(85.0) },
    });

    const attempt2 = await AttemptService.startOrResumeAttempt(publishedAssessmentId, studentAId);
    createdAttemptIds.push(attempt2.id);
    if (attempt2.attemptNumber !== 2 || attempt2.status !== AttemptStatus.IN_PROGRESS) {
      throw new Error(`Secuencia falló: attemptNumber se esperaba 2, se obtuvo ${attempt2.attemptNumber}`);
    }
    console.log('✓ Secuencia de intentos verificada: attemptNumber = 2 tras completar el intento 1.');

    // 5. PRUEBA: MAX ATTEMPTS
    console.log('\n--- 5. PRUEBA: LÍMITE MÁXIMO DE INTENTOS (maxAttempts = 1) ---');
    const attMax1 = await AttemptService.startOrResumeAttempt(maxAttemptsAssessmentId, studentAId);
    createdAttemptIds.push(attMax1.id);

    // Reanudar debe funcionar aunque maxAttempts sea 1
    const attMax1Resumed = await AttemptService.startOrResumeAttempt(maxAttemptsAssessmentId, studentAId);
    if (attMax1Resumed.id !== attMax1.id) {
      throw new Error('Reanudar intento activo con maxAttempts=1 falló');
    }
    console.log('✓ Reanudar intento activo cuando maxAttempts=1 no descuenta intento: OK.');

    // Marcar como GRADED
    await prisma.attempt.update({
      where: { id: attMax1.id },
      data: { status: AttemptStatus.GRADED, score: new Prisma.Decimal(100.0) },
    });

    // Intentar iniciar nuevo intento cuando ya se agotó el máximo
    try {
      await AttemptService.startOrResumeAttempt(maxAttemptsAssessmentId, studentAId);
      throw new Error('Debería haber lanzado error de MAX_ATTEMPTS_REACHED');
    } catch (e: any) {
      if (e.code !== 'MAX_ATTEMPTS_REACHED') {
        throw new Error(`Código de error inesperado para maxAttempts: ${e.code}`);
      }
      console.log('✓ Límite de intentos alcanzado rechazado correctamente (MAX_ATTEMPTS_REACHED).');
    }

    // 6. PRUEBA: PUBLICACIÓN
    console.log('\n--- 6. PRUEBA: RECHAZO DE EVALUACIÓN NO PUBLICADA ---');
    try {
      await AttemptService.startOrResumeAttempt(unpublishedAssessmentId, studentAId);
      throw new Error('Debería haber lanzado error de ASSESSMENT_NOT_PUBLISHED');
    } catch (e: any) {
      if (e.code !== 'ASSESSMENT_NOT_PUBLISHED') {
        throw new Error(`Código de error inesperado para no publicada: ${e.code}`);
      }
      console.log('✓ Evaluación no publicada rechazada correctamente (ASSESSMENT_NOT_PUBLISHED).');
    }

    // 7. PRUEBA: AVAILABLE FROM / AVAILABLE UNTIL
    console.log('\n--- 7. PRUEBA: RECHAZO POR VENTANA TEMPORAL (availableFrom / availableUntil) ---');
    try {
      await AttemptService.startOrResumeAttempt(futureAvailableAssessmentId, studentAId);
      throw new Error('Debería haber lanzado error de ASSESSMENT_NOT_AVAILABLE');
    } catch (e: any) {
      if (e.code !== 'ASSESSMENT_NOT_AVAILABLE') {
        throw new Error(`Código de error inesperado para disponible futuro: ${e.code}`);
      }
      console.log('✓ Evaluación futura rechazada correctamente (ASSESSMENT_NOT_AVAILABLE).');
    }

    try {
      await AttemptService.startOrResumeAttempt(expiredAvailableAssessmentId, studentAId);
      throw new Error('Debería haber lanzado error de ASSESSMENT_CLOSED');
    } catch (e: any) {
      if (e.code !== 'ASSESSMENT_CLOSED') {
        throw new Error(`Código de error inesperado para disponible expirado: ${e.code}`);
      }
      console.log('✓ Evaluación expirada rechazada correctamente (ASSESSMENT_CLOSED).');
    }

    // 8. PRUEBA: ENROLLMENT Y AUTORIZACIÓN DE ESTUDIANTE
    console.log('\n--- 8. PRUEBA: RECHAZO POR FALTA DE INSCRIPCIÓN (ENROLLMENT) ---');
    try {
      // Student B no está inscrito en el curso
      await AttemptService.startOrResumeAttempt(publishedAssessmentId, studentBId);
      throw new Error('Debería haber lanzado error de ENROLLMENT_REQUIRED');
    } catch (e: any) {
      if (e.code !== 'ENROLLMENT_REQUIRED') {
        throw new Error(`Código de error inesperado para falta de inscripción: ${e.code}`);
      }
      console.log('✓ Estudiante no inscrito rechazado correctamente (ENROLLMENT_REQUIRED).');
    }

    // 9. PRUEBA: OWNERSHIP Y GET ATTEMPT
    console.log('\n--- 9. PRUEBA: CONSULTA Y PROPIEDAD (GET ATTEMPT) ---');
    const fetchedByStudentA = await AttemptService.getAttemptById(attempt2.id, studentAId, Role.STUDENT);
    if (fetchedByStudentA.id !== attempt2.id) {
      throw new Error('Estudiante A no pudo consultar su propio intento');
    }
    console.log('✓ Estudiante consultando su propio intento: OK.');

    try {
      await AttemptService.getAttemptById(attempt2.id, studentBId, Role.STUDENT);
      throw new Error('Estudiante B no debería poder consultar el intento de Estudiante A');
    } catch (e: any) {
      if (e.code !== 'FORBIDDEN') {
        throw new Error(`Código de error inesperado para IDOR: ${e.code}`);
      }
      console.log('✓ Intento de acceso cruzado entre estudiantes rechazado (403 FORBIDDEN IDOR).');
    }

    const fetchedByTeacher = await AttemptService.getAttemptById(attempt2.id, teacherId, Role.TEACHER);
    if (fetchedByTeacher.id !== attempt2.id) {
      throw new Error('Profesor del curso no pudo consultar el intento');
    }
    console.log('✓ Profesor asignado al curso consultando el intento: OK.');

    const fetchedByAdmin = await AttemptService.getAttemptById(attempt2.id, adminId, Role.ADMIN);
    if (fetchedByAdmin.id !== attempt2.id) {
      throw new Error('Admin no pudo consultar el intento');
    }
    console.log('✓ Administrador consultando el intento: OK.');

    // 10. PRUEBA REAL DE CONCURRENCIA (10 PETICIONES SIMULTÁNEAS)
    console.log('\n--- 10. PRUEBA REAL DE CONCURRENCIA (10 SOLICITUDES SIMULTÁNEAS CON PG_ADVISORY_XACT_LOCK) ---');
    
    // Crear una nueva evaluación limpia para la prueba de concurrencia
    const concAssessment = await prisma.assessment.create({
      data: {
        courseId,
        title: 'Evaluación Test Concurrencia 10 Requests',
        type: AssessmentType.EXAM,
        isPublished: true,
      },
    });

    console.log('Disparando 10 peticiones simultáneas de startOrResumeAttempt...');
    const concurrencyPromises = Array.from({ length: 10 }).map(() =>
      AttemptService.startOrResumeAttempt(concAssessment.id, studentAId)
    );

    const concurrencyResults = await Promise.all(concurrencyPromises);

    // Todas las respuestas deben apuntar exactamente al mismo ID de Attempt
    const firstAttemptId = concurrencyResults[0].id;
    createdAttemptIds.push(firstAttemptId);

    const allSameId = concurrencyResults.every((r) => r.id === firstAttemptId);
    if (!allSameId) {
      throw new Error('PRUEBA DE CONCURRENCIA FALLÓ: Las solicitudes crearon múltiples intentos diferentes');
    }

    // Verificar en la BD que existe exactamente 1 fila en Attempt
    const attemptsInDb = await prisma.attempt.findMany({
      where: {
        studentId: studentAId,
        assessmentId: concAssessment.id,
      },
    });

    if (attemptsInDb.length !== 1) {
      throw new Error(`PRUEBA DE CONCURRENCIA FALLÓ: Se encontraron ${attemptsInDb.length} filas en la BD, se esperaba exactamente 1`);
    }

    console.log(`✓ PRUEBA DE CONCURRENCIA PASÓ AL 100%: 10 solicitudes simultáneas retornaron el mismo Attempt (${firstAttemptId}).`);
    console.log('✓ Se verificó exactamente 1 fila registrada en la base de datos PostgreSQL.');

    console.log('\n========================================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN DE LA FASE 8.4-A PASARON! 🟢');
    console.log('========================================================================\n');

  } catch (err: any) {
    console.error('✖ FALLO EN PRUEBAS DE FASE 8.4-A:', err.message || err);
    throw err;
  } finally {
    console.log('--- TEARDOWN Y LIMPIEZA DE REGISTROS TEMPORALES ---');
    if (createdAttemptIds.length > 0) {
      await prisma.attempt.deleteMany({
        where: {
          id: { in: createdAttemptIds },
        },
      });
      console.log(`✓ ${createdAttemptIds.length} intentos de prueba eliminados.`);
    }

    if (courseId) {
      await prisma.assessment.deleteMany({ where: { courseId } });
      await prisma.enrollment.deleteMany({ where: { courseId } });
      await prisma.courseTeacher.deleteMany({ where: { courseId } });
      await prisma.course.delete({ where: { id: courseId } });
      console.log('✓ Curso y evaluaciones temporales eliminados.');
    }

    if (subjectId) {
      await prisma.subject.delete({ where: { id: subjectId } });
      console.log('✓ Asignatura temporal eliminada.');
    }

    if (studentAId) {
      await prisma.studentProfile.deleteMany({ where: { userId: studentAId } });
      await prisma.user.delete({ where: { id: studentAId } });
    }
    if (studentBId) {
      await prisma.studentProfile.deleteMany({ where: { userId: studentBId } });
      await prisma.user.delete({ where: { id: studentBId } });
    }
    if (teacherId) {
      await prisma.user.delete({ where: { id: teacherId } });
    }
    if (adminId) {
      await prisma.user.delete({ where: { id: adminId } });
    }
    console.log('✓ Usuarios de prueba eliminados. Teardown completado (0 registros temporales).');
  }
}

runPhase84AIntegrationTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
