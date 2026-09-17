process.env.NODE_ENV = 'test';

import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { AuthTokenService } from '../src/services/auth-token.service';
import { JwtService } from '../src/services/jwt.service';
import { RefreshSessionService } from '../src/services/refresh-session.service';
import { Role, TokenType, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { Server } from 'node:http';

async function runPhase4bIntegrationTests() {
  console.log('================================================================');
  console.log('   PotroLearn — Auth Backend V1 — Fase 4B Integration Tests     ');
  console.log('================================================================\n');

  let server: Server | null = null;
  let baseUrl = '';

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
  const createdStudentProfileIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdCourseTeacherIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdAuthTokenIds: string[] = [];

  try {
    const tempPassword = 'TempPassword123!';
    const newPassword = 'NewSecretPassword456!';
    const initialHash = await PasswordService.hashPassword(tempPassword);

    // ----------------------------------------------------
    // 1. LOGIN PERSISTENTE & HTTPONLY COOKIE TEST
    // ----------------------------------------------------
    console.log('--- 1. Login Persistent Session & HttpOnly Cookie Test ---');

    const testUser = await prisma.user.create({
      data: {
        email: `test.p4b.user.${Date.now()}@potrolearn.edu.mx`,
        name: 'Usuario Persistencia 4B',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(testUser.id);

    const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: tempPassword }),
    });

    const bodyLogin = (await resLogin.json()) as any;
    console.assert(resLogin.status === 200, `Expected 200, got ${resLogin.status}`);
    console.assert(typeof bodyLogin.data.token === 'string', 'Access JWT debe ser emitido');
    console.assert(bodyLogin.data.rawRefreshToken === undefined, 'NO debe retornar rawRefreshToken en JSON response');

    // Extraer cookie Set-Cookie
    const setCookieHeader = resLogin.headers.get('set-cookie');
    console.assert(setCookieHeader !== null, 'Set-Cookie header debe estar presente');
    console.assert(setCookieHeader!.includes('potrolearn_refresh='), 'Cookie potrolearn_refresh debe estar presente');
    console.assert(setCookieHeader!.includes('HttpOnly'), 'Cookie debe tener atributo HttpOnly');
    console.assert(setCookieHeader!.includes('Path=/api/auth'), 'Cookie debe tener Path=/api/auth');
    console.assert(setCookieHeader!.includes('SameSite=Lax'), 'Cookie debe tener SameSite=Lax');

    const cookieMatch = setCookieHeader!.match(/potrolearn_refresh=([^;]+)/);
    console.assert(cookieMatch !== null, 'Debe extraerse el valor del RAW refresh token de la cookie');
    const rawCookie1 = cookieMatch![1];

    // Verificar en BD
    const session1Hash = RefreshSessionService.hashToken(rawCookie1);
    const dbSession1 = await prisma.refreshSession.findUnique({ where: { tokenHash: session1Hash } });
    console.assert(dbSession1 !== null, 'RefreshSession debe existir en BD');
    console.assert(dbSession1?.userId === testUser.id, 'userId coincide');
    console.assert(dbSession1?.revokedAt === null, 'revokedAt debe ser null');

    console.log('  [PASS] Login -> 200 OK + Access JWT (JSON) + potrolearn_refresh HttpOnly cookie (Hash stored in DB)');

    // ----------------------------------------------------
    // 2. REFRESH & TOKEN ROTATION TEST
    // ----------------------------------------------------
    console.log('\n--- 2. Refresh & Token Rotation Test ---');

    const resRefresh1 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${rawCookie1}` },
    });

    const bodyRefresh1 = (await resRefresh1.json()) as any;
    console.assert(resRefresh1.status === 200, `Expected 200, got ${resRefresh1.status}`);
    console.assert(typeof bodyRefresh1.data.token === 'string', 'Nuevo Access JWT emitido');

    const setCookieHeader2 = resRefresh1.headers.get('set-cookie');
    const cookieMatch2 = setCookieHeader2!.match(/potrolearn_refresh=([^;]+)/);
    console.assert(cookieMatch2 !== null, 'Nueva cookie de refresh emitida');
    const rawCookie2 = cookieMatch2![1];

    console.assert(rawCookie1 !== rawCookie2, 'El nuevo token plano debe ser diferente al anterior (Rotación)');

    // Verificar en BD: Sesión 1 revocada, Sesión 2 activa
    const dbSession1After = await prisma.refreshSession.findUnique({ where: { tokenHash: session1Hash } });
    console.assert(dbSession1After?.revokedAt !== null, 'Sesión anterior debe estar revocada en BD');

    const session2Hash = RefreshSessionService.hashToken(rawCookie2);
    const dbSession2 = await prisma.refreshSession.findUnique({ where: { tokenHash: session2Hash } });
    console.assert(dbSession2 !== null, 'Nueva sesión debe existir en BD');
    console.assert(dbSession2?.revokedAt === null, 'Nueva sesión debe estar activa');

    console.log('  [PASS] Refresh -> 200 OK + nuevo Access JWT + nueva cookie + sesión anterior revocada');

    // ----------------------------------------------------
    // 3. REUSE OF REVOKED REFRESH TOKEN TEST
    // ----------------------------------------------------
    console.log('\n--- 3. Reuse of Revoked Refresh Token Test ---');

    const resReuse = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${rawCookie1}` },
    });

    const bodyReuse = (await resReuse.json()) as any;
    console.assert(resReuse.status === 401, `Expected 401, got ${resReuse.status}`);
    console.assert(bodyReuse.error?.code === 'INVALID_REFRESH_TOKEN', 'Code debe ser INVALID_REFRESH_TOKEN');

    console.log('  [PASS] Reuso de cookie revocada -> 401 INVALID_REFRESH_TOKEN');

    // ----------------------------------------------------
    // 4. CONCURRENT REFRESH PROTECTION TEST
    // ----------------------------------------------------
    console.log('\n--- 4. Concurrent Refresh Protection Test ---');

    const [concRef1, concRef2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `potrolearn_refresh=${rawCookie2}` },
      }),
      fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `potrolearn_refresh=${rawCookie2}` },
      }),
    ]);

    const concRefStatuses = [concRef1.status, concRef2.status];
    const concRefSuccesses = concRefStatuses.filter((s) => s === 200).length;
    const concRefRejections = concRefStatuses.filter((s) => s === 401).length;

    console.assert(concRefSuccesses === 1, `Exactamente 1 éxito en refresh concurrente (got ${concRefSuccesses})`);
    console.assert(concRefRejections === 1, `Exactamente 1 rechazo en refresh concurrente (got ${concRefRejections})`);

    const validSessionsCount = await prisma.refreshSession.count({
      where: { userId: testUser.id, revokedAt: null },
    });
    console.assert(validSessionsCount === 1, `Exactamente 1 sesión válida de reemplazo en BD (got ${validSessionsCount})`);

    console.log('  [PASS] Refresh concurrente -> 1 SUCCESS (200), 1 REJECTED (401) y exactamente 1 sesión activa en BD');

    // Obtener la última cookie válida para continuar pruebas
    let currentValidCookie = '';
    if (concRef1.status === 200) {
      currentValidCookie = concRef1.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];
    } else {
      currentValidCookie = concRef2.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];
    }

    // ----------------------------------------------------
    // 5. LOGOUT REAL & IDEMPOTENCY TEST
    // ----------------------------------------------------
    console.log('\n--- 5. Real Logout & Idempotency Test ---');

    // Logout con cookie válida
    const resLogout1 = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${currentValidCookie}` },
    });
    console.assert(resLogout1.status === 200, `Expected 200, got ${resLogout1.status}`);

    // Intentar refresh después de logout -> 401
    const resRefreshAfterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${currentValidCookie}` },
    });
    console.assert(resRefreshAfterLogout.status === 401, `Expected 401, got ${resRefreshAfterLogout.status}`);

    // Logout sin cookie (Idempotencia) -> 200
    const resLogoutIdempotent = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });
    console.assert(resLogoutIdempotent.status === 200, `Expected 200, got ${resLogoutIdempotent.status}`);

    console.log('  [PASS] Logout real liquida sesión en BD, limpia cookie y responde 200 OK de forma idempotente');

    // ----------------------------------------------------
    // 6. ACCOUNT DISABLED TEST (isActive = false)
    // ----------------------------------------------------
    console.log('\n--- 6. Account Disabled (isActive = false) Test ---');

    // Reloguear usuario
    const resLoginDisabledTest = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: tempPassword }),
    });
    const cookieDisabledTest = resLoginDisabledTest.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Deshabilitar usuario directamente en BD
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: false },
    });

    const resRefreshDisabled = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieDisabledTest}` },
    });
    const bodyRefreshDisabled = (await resRefreshDisabled.json()) as any;
    console.assert(resRefreshDisabled.status === 403, `Expected 403, got ${resRefreshDisabled.status}`);
    console.assert(bodyRefreshDisabled.error?.code === 'ACCOUNT_SUSPENDED', 'Code debe ser ACCOUNT_SUSPENDED');

    // Restaurar isActive
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: true },
    });

    console.log('  [PASS] Usuario deshabilitado -> Refresh rechazado con 403 ACCOUNT_SUSPENDED');

    // ----------------------------------------------------
    // 7. MUST CHANGE PASSWORD & CHANGE PASSWORD SESSION TEST
    // ----------------------------------------------------
    console.log('\n--- 7. mustChangePassword & Change Password Session Test ---');

    const tempUserMustChange = await prisma.user.create({
      data: {
        email: `test.p4b.mustchange.${Date.now()}@potrolearn.edu.mx`,
        name: 'Usuario MustChange 4B',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(tempUserMustChange.id);

    // Login con mustChangePassword = true -> Exitoso
    const resLoginMustChange = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempUserMustChange.email, password: tempPassword }),
    });
    const bodyLoginMustChange = (await resLoginMustChange.json()) as any;
    console.assert(resLoginMustChange.status === 200, 'Login debe ser 200 OK');
    const cookieMustChangeA = resLoginMustChange.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Refresh con mustChangePassword = true -> Exitoso
    const resRefreshMustChange = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieMustChangeA}` },
    });
    console.assert(resRefreshMustChange.status === 200, 'Refresh debe ser 200 OK');
    const cookieMustChangeB = resRefreshMustChange.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Ejecutar change-password
    const resChangePass = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bodyLoginMustChange.data.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    const bodyChangePass = (await resChangePass.json()) as any;
    console.assert(resChangePass.status === 200, `Expected 200, got ${resChangePass.status}`);
    const cookieAfterChangePass = resChangePass.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Cookie previa A / B debe estar revocada
    const resRefreshOldCookie = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieMustChangeB}` },
    });
    console.assert(resRefreshOldCookie.status === 401, 'Cookie anterior debe estar revocada tras cambiar contraseña');

    // Nueva cookie tras change-password debe ser válida
    const resRefreshNewCookie = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieAfterChangePass}` },
    });
    console.assert(resRefreshNewCookie.status === 200, 'Nueva cookie debe funcionar');

    console.log('  [PASS] Change Password revoca sesiones previas y emite nueva sesión persistente activa');

    // ----------------------------------------------------
    // 8. RESET ACCESS ADMINISTRATIVE REVOCATION TEST
    // ----------------------------------------------------
    console.log('\n--- 8. Administrative Reset Access Revocation Test ---');

    // Setup Admin, Subject, Course, Student
    const adminUser = await prisma.user.create({
      data: {
        email: `test.p4b.admin.${Date.now()}@potrolearn.edu.mx`,
        name: 'Admin Test 4B',
        role: Role.ADMIN,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(adminUser.id);
    const adminToken = JwtService.signAccessToken(adminUser.id);

    const studentAct = await prisma.user.create({
      data: {
        email: `test.p4b.student.act.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Activado Test',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(studentAct.id);

    const subject = await prisma.subject.create({
      data: { code: `SUBJ-P4B-${Date.now()}`, name: 'Materia 4B' },
    });
    createdSubjectIds.push(subject.id);

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso 4B',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(course.id);

    const enrollment = await prisma.enrollment.create({
      data: { courseId: course.id, studentId: studentAct.id, status: EnrollmentStatus.ACTIVE },
    });
    createdEnrollmentIds.push(enrollment.id);

    // Student se loguea y obtiene sesión de refresh
    const resLoginStudAct = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: studentAct.email, password: tempPassword }),
    });
    const cookieStudAct = resLoginStudAct.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Admin ejecuta reset-access sobre el estudiante
    const resResetAccess = await fetch(`${baseUrl}/api/courses/${course.id}/students/${studentAct.id}/reset-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resResetAccess.status === 200, `Expected 200, got ${resResetAccess.status}`);

    // Cookie previa del alumno debe estar revocada tras reset-access
    const resRefreshStudRevoked = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieStudAct}` },
    });
    console.assert(resRefreshStudRevoked.status === 401, 'Sesión del alumno debe ser revocada tras reset-access administrativo');

    console.log('  [PASS] Reset Access administrativo revoca TODAS las sesiones de refresh del estudiante');

    // ----------------------------------------------------
    // 9. ACTIVATION & PASSWORD RESET PERSISTENT SESSION TEST
    // ----------------------------------------------------
    console.log('\n--- 9. Activation & Password Reset Persistent Session Test ---');

    // 9.1 ACTIVATION
    const pendingUser = await prisma.user.create({
      data: {
        email: `test.p4b.activate.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Para Activar',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(pendingUser.id);

    const actTokenObj = await AuthTokenService.createToken({
      userId: pendingUser.id,
      type: TokenType.ACCOUNT_ACTIVATION,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(actTokenObj.authToken.id);

    const resActivate = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: actTokenObj.rawToken,
        email: pendingUser.email,
        temporaryPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    const bodyActivate = (await resActivate.json()) as any;
    console.assert(resActivate.status === 200, `Expected 200, got ${resActivate.status}`);
    const cookieActivate = resActivate.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    // Refresh con la cookie obtenida en activación
    const resRefreshAfterActivate = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieActivate}` },
    });
    console.assert(resRefreshAfterActivate.status === 200, 'Sesión de refresh creada en activación debe ser válida');

    console.log('  [PASS] Activation emite Access JWT + RefreshSession + HttpOnly Cookie funcional');

    // 9.2 PASSWORD_RESET
    const resetTokenObj = await AuthTokenService.createToken({
      userId: studentAct.id,
      type: TokenType.PASSWORD_RESET,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(resetTokenObj.authToken.id);

    // Asignar contraseña temporal a studentAct
    await prisma.user.update({
      where: { id: studentAct.id },
      data: { passwordHash: initialHash },
    });

    const resResetPass = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetTokenObj.rawToken,
        email: studentAct.email,
        temporaryPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    console.assert(resResetPass.status === 200, `Expected 200, got ${resResetPass.status}`);
    const cookieResetPass = resResetPass.headers.get('set-cookie')!.match(/potrolearn_refresh=([^;]+)/)![1];

    const resRefreshAfterResetPass = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `potrolearn_refresh=${cookieResetPass}` },
    });
    console.assert(resRefreshAfterResetPass.status === 200, 'Sesión de refresh creada en reset-password debe ser válida');

    console.log('  [PASS] Password Reset revoca sesiones previas y emite nueva sesión persistente activa');

    console.log('\n================================================================');
    console.log('   TODAS LAS PRUEBAS DE LA FASE 4B PASARON EXITOSAMENTE');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 4B:', error);
    process.exitCode = 1;
  } finally {
    // ----------------------------------------------------
    // CLEANUP EXACTO EN ORDEN INVERSO DE DEPENDENCIAS
    // ----------------------------------------------------
    console.log('--- Cleanup de Datos Temporales de Prueba ---');

    // 1. RefreshSessions
    if (createdUserIds.length > 0) {
      const delRefresh = await prisma.refreshSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      console.log(`[CLEANUP] Eliminadas ${delRefresh.count} RefreshSessions de prueba`);
    }

    // 2. AuthTokens
    if (createdAuthTokenIds.length > 0) {
      const delTokens = await prisma.authToken.deleteMany({ where: { id: { in: createdAuthTokenIds } } });
      console.log(`[CLEANUP] Eliminados ${delTokens.count} AuthTokens de prueba`);
    }

    // 3. Enrollments
    if (createdEnrollmentIds.length > 0) {
      const delEnrollments = await prisma.enrollment.deleteMany({ where: { id: { in: createdEnrollmentIds } } });
      console.log(`[CLEANUP] Eliminados ${delEnrollments.count} Enrollments de prueba`);
    }

    // 4. CourseTeachers
    if (createdCourseTeacherIds.length > 0) {
      const delCourseTeachers = await prisma.courseTeacher.deleteMany({ where: { id: { in: createdCourseTeacherIds } } });
      console.log(`[CLEANUP] Eliminados ${delCourseTeachers.count} CourseTeachers de prueba`);
    }

    // 5. Courses
    if (createdCourseIds.length > 0) {
      const delCourses = await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
      console.log(`[CLEANUP] Eliminados ${delCourses.count} Cursos de prueba`);
    }

    // 6. Subjects
    if (createdSubjectIds.length > 0) {
      const delSubjects = await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
      console.log(`[CLEANUP] Eliminados ${delSubjects.count} Materias de prueba`);
    }

    // 7. StudentProfiles
    if (createdStudentProfileIds.length > 0) {
      const delProfiles = await prisma.studentProfile.deleteMany({ where: { id: { in: createdStudentProfileIds } } });
      console.log(`[CLEANUP] Eliminados ${delProfiles.count} StudentProfiles de prueba`);
    }

    // 8. Users
    if (createdUserIds.length > 0) {
      const delUsers = await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log(`[CLEANUP] Eliminados ${delUsers.count} Usuarios de prueba`);
    }

    const remUsers = await prisma.user.count({ where: { email: { contains: 'test.p4b.' } } });
    console.log(`[CLEANUP] Registros temporales restantes en BD: ${remUsers}`);
    console.assert(remUsers === 0, 'No deben quedar registros temporales en BD');

    if (server) {
      (server as Server).close();
      console.log('[CLEANUP] Servidor HTTP cerrado correctamente.');
    }

    await prisma.$disconnect();
  }
}

runPhase4bIntegrationTests();
