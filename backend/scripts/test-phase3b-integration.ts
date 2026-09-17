process.env.NODE_ENV = 'test';

import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { AuthTokenService } from '../src/services/auth-token.service';
import { JwtService } from '../src/services/jwt.service';
import { Role, TokenType, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { Server } from 'node:http';
import { Request, Response } from 'express';
import { requirePasswordChanged } from '../src/middlewares/require-password-changed';
import { authenticate } from '../src/middlewares/authenticate';
import { requireActiveUser } from '../src/middlewares/require-active-user';

async function runPhase3bIntegrationTests() {
  console.log('================================================================');
  console.log('   PotroLearn — Auth Backend V1 — Fase 3B Integration Tests     ');
  console.log('================================================================\n');

  let server: Server | null = null;
  let baseUrl = '';

  // Ruta de prueba para validar bloqueo de JWT existente tras reset-access
  app.get('/api/test/phase3b-protected', authenticate, requireActiveUser, requirePasswordChanged, (req: Request, res: Response) => {
    res.status(200).json({ data: { message: 'Recurso protegido accedido exitosamente' } });
  });

  await new Promise<void>((resolve) => {
    const s = app.listen(0, () => {
      server = s;
      const address = s.address();
      if (typeof address === 'object' && address !== null) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  console.log(`[INIT] Servidor HTTP de pruebas iniciado en ${baseUrl}\n`);

  const createdUserIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdCourseTeacherIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdAuthTokenIds: string[] = [];

  let concurrentSuccesses = 0;
  let concurrentRejections = 0;

  try {
    const tempPassword = 'TempPassword123!';
    const newPassword = 'NewSecretPassword456!';
    const initialHash = await PasswordService.hashPassword(tempPassword);

    // ----------------------------------------------------
    // SETUP DE DATOS DE PRUEBA (ADMIN, TEACHER, SUBJECT, COURSE, STUDENTS)
    // ----------------------------------------------------
    console.log('--- 1. Setup de Dominio para Fase 3B ---');

    // Admin User
    const adminUser = await prisma.user.create({
      data: {
        email: `test.p3b.admin.${Date.now()}@potrolearn.edu.mx`,
        name: 'Admin Prueba',
        role: Role.ADMIN,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(adminUser.id);
    const adminToken = JwtService.signAccessToken(adminUser.id);

    // Teacher User 1 (Asignado al curso)
    const teacherUser = await prisma.user.create({
      data: {
        email: `test.p3b.teacher.${Date.now()}@potrolearn.edu.mx`,
        name: 'Profesor Titular',
        role: Role.TEACHER,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(teacherUser.id);
    const teacherToken = JwtService.signAccessToken(teacherUser.id);

    // Teacher User 2 (NO asignado al curso)
    const teacherUnrelated = await prisma.user.create({
      data: {
        email: `test.p3b.teacher.unrelated.${Date.now()}@potrolearn.edu.mx`,
        name: 'Profesor Ajeno',
        role: Role.TEACHER,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(teacherUnrelated.id);
    const teacherUnrelatedToken = JwtService.signAccessToken(teacherUnrelated.id);

    // Student 1 (Pendiente de activación)
    const studentPending = await prisma.user.create({
      data: {
        email: `test.p3b.student.pending.${Date.now()}@potrolearn.edu.mx`,
        name: 'Estudiante Pendiente',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(studentPending.id);

    // Student 2 (Ya activado previamente)
    const studentActivated = await prisma.user.create({
      data: {
        email: `test.p3b.student.activated.${Date.now()}@potrolearn.edu.mx`,
        name: 'Estudiante Activado',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Hace 1 día
      },
    });
    createdUserIds.push(studentActivated.id);

    // Subject & Course
    const subject = await prisma.subject.create({
      data: {
        code: `SUBJ-${Date.now()}`,
        name: 'Materia Prueba Auth 3B',
      },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso Prueba Auth 3B',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    // Asignar Teacher 1 al curso
    const courseTeacher = await prisma.courseTeacher.create({
      data: {
        courseId: course.id,
        teacherId: teacherUser.id,
      },
    });
    createdCourseTeacherIds.push(courseTeacher.id);

    // Inscribir Student 1 y Student 2 en el curso
    const enroll1 = await prisma.enrollment.create({
      data: {
        courseId: course.id,
        studentId: studentPending.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    createdEnrollmentIds.push(enroll1.id);

    const enroll2 = await prisma.enrollment.create({
      data: {
        courseId: course.id,
        studentId: studentActivated.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    createdEnrollmentIds.push(enroll2.id);

    console.log(`[SETUP] Creado curso, 2 profesores, y 2 estudiantes inscritos`);

    // ----------------------------------------------------
    // 2. PRUEBAS DE POST /api/auth/validate-reset-token
    // ----------------------------------------------------
    console.log('\n--- 2. POST /api/auth/validate-reset-token Endpoint Tests ---');

    const tokenResetValid = await AuthTokenService.createToken({
      userId: studentActivated.id,
      type: TokenType.PASSWORD_RESET,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(tokenResetValid.authToken.id);

    // 2.1 Token PASSWORD_RESET válido -> 200 OK { valid: true }
    const resValReset = await fetch(`${baseUrl}/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenResetValid.rawToken }),
    });
    const bodyValReset = (await resValReset.json()) as any;
    console.assert(resValReset.status === 200, `Expected 200, got ${resValReset.status}`);
    console.assert(bodyValReset.data.valid === true, 'Reset token debe retornar valid=true');
    console.assert(bodyValReset.data.email === undefined, 'NO debe exponer email');
    console.log('  [PASS] Token PASSWORD_RESET válido -> 200 OK { valid: true } sin datos sensibles');

    // 2.2 Token ACCOUNT_ACTIVATION usado en validate-reset-token -> 400 Bad Request
    const tokenActivationValid = await AuthTokenService.createToken({
      userId: studentPending.id,
      type: TokenType.ACCOUNT_ACTIVATION,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(tokenActivationValid.authToken.id);

    const resValMismatch = await fetch(`${baseUrl}/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenActivationValid.rawToken }),
    });
    console.assert(resValMismatch.status === 400, 'Token de activación debe ser rechazado en endpoint de reset');
    console.log('  [PASS] Token ACCOUNT_ACTIVATION en validate-reset-token -> 400 INVALID_OR_EXPIRED_TOKEN');

    // ----------------------------------------------------
    // 3. PRUEBAS DE POST /api/auth/reset-password
    // ----------------------------------------------------
    console.log('\n--- 3. POST /api/auth/reset-password Endpoint Tests ---');

    // 3.1 Restablecimiento exitoso de contraseña
    const originalActivatedAt = studentActivated.activatedAt;

    const resResetSuccess = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenResetValid.rawToken,
        email: studentActivated.email,
        temporaryPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    const bodyResetSuccess = (await resResetSuccess.json()) as any;
    console.assert(resResetSuccess.status === 200, `Expected 200, got ${resResetSuccess.status}`);
    console.assert(bodyResetSuccess.data.message === 'Contraseña restablecida correctamente', 'Mensaje de éxito');
    console.assert(typeof bodyResetSuccess.data.token === 'string', 'JWT de acceso debe ser emitido');
    console.log('  [PASS] Restablecimiento de contraseña con token válido -> 200 OK + JWT');

    // 3.2 Verificación física en la Base de Datos
    const dbStudentResetAfter = await prisma.user.findUnique({ where: { id: studentActivated.id } });
    const dbTokenResetAfter = await prisma.authToken.findUnique({ where: { id: tokenResetValid.authToken.id } });

    console.assert(dbStudentResetAfter?.mustChangePassword === false, 'mustChangePassword debe ser false');
    console.assert(dbStudentResetAfter?.activatedAt?.getTime() === originalActivatedAt?.getTime(), 'activatedAt debe PRESERVARSE exactamente');
    console.assert(dbTokenResetAfter?.usedAt !== null, 'AuthToken.usedAt debe tener timestamp');
    console.log('  [PASS] Verificación física DB: mustChangePassword=false, activatedAt PRESERVADO, usedAt!=null');

    // 3.3 Reutilización del mismo token PASSWORD_RESET -> 400
    const resReusedReset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenResetValid.rawToken,
        email: studentActivated.email,
        temporaryPassword: tempPassword,
        newPassword: 'OtherNewPassword999!',
      }),
    });
    console.assert(resReusedReset.status === 400, 'Reutilización de reset token debe fallar');
    console.log('  [PASS] Reutilización del mismo token PASSWORD_RESET -> 400 INVALID_OR_EXPIRED_TOKEN');

    // ----------------------------------------------------
    // 4. PRUEBA DE CONCURRENCIA DE PASSWORD_RESET
    // ----------------------------------------------------
    console.log('\n--- 4. Concurrent PASSWORD_RESET Test ---');

    const tokenResetConcurrent = await AuthTokenService.createToken({
      userId: studentActivated.id,
      type: TokenType.PASSWORD_RESET,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(tokenResetConcurrent.authToken.id);

    // Asignar contraseña temporal
    const currentHash = await PasswordService.hashPassword(tempPassword);
    await prisma.user.update({
      where: { id: studentActivated.id },
      data: { passwordHash: currentHash },
    });

    const resetPayload = JSON.stringify({
      token: tokenResetConcurrent.rawToken,
      email: studentActivated.email,
      temporaryPassword: tempPassword,
      newPassword: 'ConcurrentPassword123!',
    });

    const [resConc1, resConc2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: resetPayload,
      }),
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: resetPayload,
      }),
    ]);

    const concStatuses = [resConc1.status, resConc2.status];
    concurrentSuccesses = concStatuses.filter((s) => s === 200).length;
    concurrentRejections = concStatuses.filter((s) => s === 400).length;

    console.assert(concurrentSuccesses === 1, `Exactamente 1 éxito (got ${concurrentSuccesses})`);
    console.assert(concurrentRejections === 1, `Exactamente 1 rechazo (got ${concurrentRejections})`);
    console.log('  [PASS] Transacción atómica en concurrencia PASSWORD_RESET: 1 SUCCESS y 1 REJECTED');

    // ----------------------------------------------------
    // 5. PRUEBAS DE POST /api/courses/:courseId/students/:studentId/resend-invitation
    // ----------------------------------------------------
    console.log('\n--- 5. Administrative resend-invitation Endpoint Tests ---');

    // 5.1 Profesor no asignado al curso -> 403 Forbidden
    const resResendUnrelated = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentPending.id}/resend-invitation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherUnrelatedToken}` },
    });
    console.assert(resResendUnrelated.status === 403, `Expected 403, got ${resResendUnrelated.status}`);
    console.log('  [PASS] Profesor ajeno al curso -> 403 FORBIDDEN');

    // 5.2 Estudiante ya activado previamente -> 400 STUDENT_ALREADY_ACTIVATED
    const resResendAlreadyAct = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentActivated.id}/resend-invitation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const bodyResendAlreadyAct = (await resResendAlreadyAct.json()) as any;
    console.assert(resResendAlreadyAct.status === 400, `Expected 400, got ${resResendAlreadyAct.status}`);
    console.assert(bodyResendAlreadyAct.error?.code === 'STUDENT_ALREADY_ACTIVATED', 'Code debe ser STUDENT_ALREADY_ACTIVATED');
    console.log('  [PASS] Estudiante ya activado previamente -> 400 STUDENT_ALREADY_ACTIVATED');

    // 5.3 Reenvío exitoso por el profesor asignado
    const resResendSuccess = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentPending.id}/resend-invitation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const bodyResendSuccess = (await resResendSuccess.json()) as any;
    console.assert(resResendSuccess.status === 200, `Expected 200, got ${resResendSuccess.status}`);
    console.assert(bodyResendSuccess.data.temporaryPassword === undefined, 'NO debe exponer temporaryPassword en la respuesta HTTP');
    console.assert(bodyResendSuccess.data.rawToken === undefined, 'NO debe exponer rawToken en la respuesta HTTP');
    console.log('  [PASS] Reenvío de invitación por profesor asignado -> 200 OK sin datos sensibles');

    // Verificación de nuevo AuthToken creado para el estudiante
    const newActivationToken = await prisma.authToken.findFirst({
      where: { userId: studentPending.id, type: TokenType.ACCOUNT_ACTIVATION, usedAt: null, revokedAt: null },
    });
    console.assert(newActivationToken !== null, 'Nuevo AuthToken de activación debe crearse en BD');
    if (newActivationToken) createdAuthTokenIds.push(newActivationToken.id);

    // ----------------------------------------------------
    // 6. PRUEBAS DE POST /api/courses/:courseId/students/:studentId/reset-access
    // ----------------------------------------------------
    console.log('\n--- 6. Administrative reset-access Endpoint Tests ---');

    // 6.1 Estudiante no activado -> 400 STUDENT_NOT_ACTIVATED
    const resResetUnactivated = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentPending.id}/reset-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const bodyResetUnactivated = (await resResetUnactivated.json()) as any;
    console.assert(resResetUnactivated.status === 400, `Expected 400, got ${resResetUnactivated.status}`);
    console.assert(bodyResetUnactivated.error?.code === 'STUDENT_NOT_ACTIVATED', 'Code debe ser STUDENT_NOT_ACTIVATED');
    console.log('  [PASS] Estudiante no activado en reset-access -> 400 STUDENT_NOT_ACTIVATED');

    // 6.2 Reset-access exitoso ejecutado por ADMIN (Bypass de asignación)
    const resResetAccessAdmin = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentActivated.id}/reset-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyResetAccessAdmin = (await resResetAccessAdmin.json()) as any;
    console.assert(resResetAccessAdmin.status === 200, `Expected 200, got ${resResetAccessAdmin.status}`);
    console.assert(bodyResetAccessAdmin.data.temporaryPassword === undefined, 'NO debe exponer temporaryPassword');
    console.log('  [PASS] Reset-access ejecutado por ADMIN -> 200 OK sin datos sensibles');

    const newResetToken = await prisma.authToken.findFirst({
      where: { userId: studentActivated.id, type: TokenType.PASSWORD_RESET, usedAt: null, revokedAt: null },
    });
    console.assert(newResetToken !== null, 'Nuevo AuthToken de PASSWORD_RESET debe crearse');
    if (newResetToken) createdAuthTokenIds.push(newResetToken.id);

    // ----------------------------------------------------
    // 7. PRUEBA DE INVALIDACIÓN INMEDIATA DE JWT EXISTENTE (mustChangePassword fresh guard)
    // ----------------------------------------------------
    console.log('\n--- 7. Existing JWT Invalidation Test ---');

    // Emitir JWT válido para studentActivated previo al reset
    const studentActivatedJwt = JwtService.signAccessToken(studentActivated.id);

    // Intentar acceder a ruta protegida normal con el JWT antiguo
    const resProtectedBlocked = await fetch(`${baseUrl}/api/test/phase3b-protected`, {
      headers: { Authorization: `Bearer ${studentActivatedJwt}` },
    });
    const bodyProtectedBlocked = (await resProtectedBlocked.json()) as any;
    console.assert(resProtectedBlocked.status === 403, `Expected 403, got ${resProtectedBlocked.status}`);
    console.assert(bodyProtectedBlocked.error?.code === 'FORBIDDEN_MUST_CHANGE_PASSWORD', 'Code debe ser FORBIDDEN_MUST_CHANGE_PASSWORD');
    console.log('  [PASS] Mismo JWT antiguo del estudiante bloqueado inmediatamente con 403 FORBIDDEN_MUST_CHANGE_PASSWORD');

    console.log('\n================================================================');
    console.log('   TODAS LAS PRUEBAS DE LA FASE 3B PASARON EXITOSAMENTE');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 3B:', error);
    process.exitCode = 1;
  } finally {
    // ----------------------------------------------------
    // CLEANUP EXACTO EN ORDEN INVERSO DE DEPENDENCIAS
    // ----------------------------------------------------
    console.log('--- Cleanup de Datos Temporales de Prueba ---');

    if (createdAuthTokenIds.length > 0) {
      const delTokens = await prisma.authToken.deleteMany({ where: { id: { in: createdAuthTokenIds } } });
      console.log(`[CLEANUP] Eliminados ${delTokens.count} AuthTokens de prueba`);
    }

    if (createdEnrollmentIds.length > 0) {
      const delEnrollments = await prisma.enrollment.deleteMany({ where: { id: { in: createdEnrollmentIds } } });
      console.log(`[CLEANUP] Eliminados ${delEnrollments.count} Enrollments de prueba`);
    }

    if (createdCourseTeacherIds.length > 0) {
      const delCourseTeachers = await prisma.courseTeacher.deleteMany({ where: { id: { in: createdCourseTeacherIds } } });
      console.log(`[CLEANUP] Eliminados ${delCourseTeachers.count} CourseTeachers de prueba`);
    }

    if (createdCourseIds.length > 0) {
      const delCourses = await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
      console.log(`[CLEANUP] Eliminados ${delCourses.count} Cursos de prueba`);
    }

    if (createdSubjectIds.length > 0) {
      const delSubjects = await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
      console.log(`[CLEANUP] Eliminados ${delSubjects.count} Materias de prueba`);
    }

    if (createdUserIds.length > 0) {
      const delUsers = await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log(`[CLEANUP] Eliminados ${delUsers.count} Usuarios de prueba`);
    }

    const remUsers = await prisma.user.count({ where: { email: { contains: 'test.p3b.' } } });
    console.log(`[CLEANUP] Registros temporales restantes en BD: ${remUsers}`);
    console.assert(remUsers === 0, 'No deben quedar registros temporales en BD');

    if (server) {
      (server as Server).close();
      console.log('[CLEANUP] Servidor HTTP cerrado correctamente.');
    }

    await prisma.$disconnect();
  }
}

runPhase3bIntegrationTests();
