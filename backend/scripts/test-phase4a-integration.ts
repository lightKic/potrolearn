process.env.NODE_ENV = 'test';

import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { AuthTokenService } from '../src/services/auth-token.service';
import { JwtService } from '../src/services/jwt.service';
import { Role, TokenType, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { Server } from 'node:http';

async function runPhase4aIntegrationTests() {
  console.log('================================================================');
  console.log('   PotroLearn — Auth Backend V1 — Fase 4A Integration Tests     ');
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
    // ----------------------------------------------------
    // 1. PRUEBAS DE POLITICA BCRYPT (72 UTF-8 BYTES) Y JWT
    // ----------------------------------------------------
    console.log('--- 1. Password Policy (Bcrypt 72 Bytes) & JWT Algorithm Tests ---');

    // 1.1 Validaciones de Password
    console.assert(!PasswordService.validatePassword('123456789').valid, '9 chars debe ser inválido');
    console.assert(PasswordService.validatePassword('1234567890').valid, '10 chars ASCII debe ser válido');
    
    const ascii72 = 'a'.repeat(72);
    console.assert(PasswordService.validatePassword(ascii72).valid, '72 ASCII bytes debe ser válido');
    
    const ascii73 = 'a'.repeat(73);
    console.assert(!PasswordService.validatePassword(ascii73).valid, '73 ASCII bytes debe ser inválido');

    // Multibyte (cada emoji / carácter multibyte puede ser >1 byte UTF-8)
    const multibyteOver72 = '🔑'.repeat(20); // 20 emojis * 4 bytes = 80 bytes (pero 20 o 40 chars UTF-16)
    console.assert(!PasswordService.validatePassword(multibyteOver72).valid, 'Multibyte > 72 bytes debe ser inválido');

    console.log('  [PASS] Password Policy: 9 chars (invalid), 10 chars (valid), 72 bytes (valid), 73 bytes (invalid), multibyte >72 bytes (invalid)');

    // 1.2 Algoritmo JWT
    const testUserId = 'test-jwt-user-id';
    const jwtToken = JwtService.signAccessToken(testUserId);
    const decoded = JwtService.verifyAccessToken(jwtToken);
    console.assert(decoded.sub === testUserId, 'JWT debe codificar y decodificar sub correctamente');
    console.log('  [PASS] JwtService: Firma y verificación explícita con algoritmo HS256');

    // ----------------------------------------------------
    // 2. SETUP DE DATOS DE PRUEBA
    // ----------------------------------------------------
    console.log('\n--- 2. Setup de Dominio para Fase 4A ---');

    const tempPassword = 'TempPassword123!';
    const initialHash = await PasswordService.hashPassword(tempPassword);

    // ADMIN User
    const adminUser = await prisma.user.create({
      data: {
        email: `test.p4a.admin.${Date.now()}@potrolearn.edu.mx`,
        name: 'Admin Principal',
        role: Role.ADMIN,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(adminUser.id);
    const adminToken = JwtService.signAccessToken(adminUser.id);

    // TEACHER 1 (Titular)
    const teacher1 = await prisma.user.create({
      data: {
        email: `test.p4a.teacher1.${Date.now()}@potrolearn.edu.mx`,
        name: 'Profesor Titular',
        role: Role.TEACHER,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(teacher1.id);
    const teacher1Token = JwtService.signAccessToken(teacher1.id);

    // TEACHER 2 (Ajeno)
    const teacher2 = await prisma.user.create({
      data: {
        email: `test.p4a.teacher2.${Date.now()}@potrolearn.edu.mx`,
        name: 'Profesor Ajeno',
        role: Role.TEACHER,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(teacher2.id);
    const teacher2Token = JwtService.signAccessToken(teacher2.id);

    // STUDENT (Para probar restricciones de rol)
    const studentUserObj = await prisma.user.create({
      data: {
        email: `test.p4a.student.role.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Rol Test',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(studentUserObj.id);
    const studentToken = JwtService.signAccessToken(studentUserObj.id);

    // Subject & Courses (ACTIVE, DRAFT, FINISHED, ARCHIVED)
    const subject = await prisma.subject.create({
      data: {
        code: `SUBJ-P4A-${Date.now()}`,
        name: 'Materia Fase 4A',
      },
    });
    createdSubjectIds.push(subject.id);

    const activeCourse = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso Activo 4A',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.ACTIVE,
      },
    });
    createdCourseIds.push(activeCourse.id);

    const draftCourse = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso Borrador 4A',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.DRAFT,
      },
    });
    createdCourseIds.push(draftCourse.id);

    const finishedCourse = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso Finalizado 4A',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: CourseStatus.FINISHED,
      },
    });
    createdCourseIds.push(finishedCourse.id);

    const archivedCourse = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: adminUser.id,
        name: 'Curso Archivado 4A',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: CourseStatus.ARCHIVED,
      },
    });
    createdCourseIds.push(archivedCourse.id);

    // Asignar Teacher 1 a activeCourse, draftCourse, finishedCourse, archivedCourse
    for (const c of [activeCourse, draftCourse, finishedCourse, archivedCourse]) {
      const ct = await prisma.courseTeacher.create({
        data: { courseId: c.id, teacherId: teacher1.id },
      });
      createdCourseTeacherIds.push(ct.id);
    }

    console.log('[SETUP] Creado Admin, 2 Profesores, 1 Alumno, 1 Materia y 4 Cursos (ACTIVE, DRAFT, FINISHED, ARCHIVED)');

    // ----------------------------------------------------
    // 3. PRUEBAS DE PROVISIONAMIENTO TEACHER (POST /api/admin/teachers)
    // ----------------------------------------------------
    console.log('\n--- 3. TEACHER Provisioning (POST /api/admin/teachers) Tests ---');

    // 3.1 STUDENT intenta crear TEACHER -> 403
    const resStudCreateT = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo Maestro', email: 'maestro1@test.com' }),
    });
    console.assert(resStudCreateT.status === 403, `Expected 403, got ${resStudCreateT.status}`);
    console.log('  [PASS] STUDENT intenta crear TEACHER -> 403 FORBIDDEN');

    // 3.2 TEACHER intenta crear TEACHER -> 403
    const resTeachCreateT = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo Maestro', email: 'maestro2@test.com' }),
    });
    console.assert(resTeachCreateT.status === 403, `Expected 403, got ${resTeachCreateT.status}`);
    console.log('  [PASS] TEACHER intenta crear TEACHER -> 403 FORBIDDEN');

    // 3.3 ADMIN crea TEACHER -> 201 Created
    const teacherEmail = `test.p4a.newteacher.${Date.now()}@potrolearn.edu.mx`;
    const resAdminCreateT = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Maestro Creado por Admin', email: teacherEmail }),
    });
    const bodyAdminCreateT = (await resAdminCreateT.json()) as any;
    console.assert(resAdminCreateT.status === 201, `Expected 201, got ${resAdminCreateT.status}`);
    console.assert(bodyAdminCreateT.data.teacher.role === 'TEACHER', 'Rol debe ser TEACHER');
    console.assert(bodyAdminCreateT.data.teacher.mustChangePassword === true, 'mustChangePassword debe ser true');
    console.assert(bodyAdminCreateT.data.teacher.activatedAt === null, 'activatedAt debe ser null');
    console.assert(bodyAdminCreateT.data.emailSent === true, 'emailSent debe ser true');

    // Verificar que NINGÚN dato sensible esté expuesto en la respuesta API
    console.assert(bodyAdminCreateT.data.temporaryPassword === undefined, 'NO exponer temporaryPassword');
    console.assert(bodyAdminCreateT.data.rawToken === undefined, 'NO exponer rawToken');
    console.assert(bodyAdminCreateT.data.passwordHash === undefined, 'NO exponer passwordHash');
    console.assert(bodyAdminCreateT.data.tokenHash === undefined, 'NO exponer tokenHash');

    const createdTeacherId = bodyAdminCreateT.data.teacher.id;
    createdUserIds.push(createdTeacherId);

    // Verificar en BD
    const dbTeacher = await prisma.user.findUnique({ where: { id: createdTeacherId } });
    console.assert(dbTeacher !== null, 'Profesor debe existir en BD');
    console.assert(dbTeacher?.role === Role.TEACHER, 'Rol en BD debe ser TEACHER');
    
    const dbActivationToken = await prisma.authToken.findFirst({
      where: { userId: createdTeacherId, type: TokenType.ACCOUNT_ACTIVATION },
    });
    console.assert(dbActivationToken !== null, 'AuthToken ACCOUNT_ACTIVATION debe crearse en BD');
    if (dbActivationToken) createdAuthTokenIds.push(dbActivationToken.id);

    console.log('  [PASS] ADMIN crea TEACHER -> 201 Created + DB verificado sin datos sensibles expuestos');

    // 3.4 Duplicado de correo al crear TEACHER -> 409
    const resDupTeacher = await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Maestro Duplicado', email: teacherEmail }),
    });
    const bodyDupTeacher = (await resDupTeacher.json()) as any;
    console.assert(resDupTeacher.status === 409, `Expected 409, got ${resDupTeacher.status}`);
    console.assert(bodyDupTeacher.error.code === 'EMAIL_ALREADY_EXISTS', 'Code debe ser EMAIL_ALREADY_EXISTS');
    console.log('  [PASS] Intento de crear TEACHER con email duplicado -> 409 EMAIL_ALREADY_EXISTS');

    // 3.5 GET /api/admin/teachers
    const resGetTeachers = await fetch(`${baseUrl}/api/admin/teachers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyGetTeachers = (await resGetTeachers.json()) as any;
    console.assert(resGetTeachers.status === 200, `Expected 200, got ${resGetTeachers.status}`);
    console.assert(Array.isArray(bodyGetTeachers.data.teachers), 'Debe ser una lista');
    console.assert(bodyGetTeachers.data.teachers.some((t: any) => t.id === createdTeacherId), 'Debe incluir el profesor creado');
    console.log('  [PASS] GET /api/admin/teachers -> 200 OK con lista de profesores');

    // ----------------------------------------------------
    // 4. PRUEBAS DE ALTA MANUAL Y MATRICULA DE ALUMNOS
    // ----------------------------------------------------
    console.log('\n--- 4. Manual STUDENT Provisioning & Enrollment Tests ---');

    // 4.1 Leading zeroes test y Nuevo estudiante
    const studentNumberWithZeroes = '00123456';
    const newStudentEmail = `test.p4a.newstudent.${Date.now()}@potrolearn.edu.mx`;

    const resEnrollNew = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '  Alumno Con Ceros Iniciales  ',
        studentNumber: `  ${studentNumberWithZeroes}  `,
        email: `  ${newStudentEmail}  `,
      }),
    });
    const bodyEnrollNew = (await resEnrollNew.json()) as any;
    console.assert(resEnrollNew.status === 200, `Expected 200, got ${resEnrollNew.status}`);
    console.assert(bodyEnrollNew.data.isNewStudent === true, 'isNewStudent debe ser true');
    console.assert(bodyEnrollNew.data.emailSent === true, 'emailSent debe ser true');
    console.assert(bodyEnrollNew.data.student.studentNumber === studentNumberWithZeroes, 'Matrícula preserva ceros iniciales');
    console.assert(bodyEnrollNew.data.student.activatedAt === null, 'activatedAt debe ser null');

    const newStudentId = bodyEnrollNew.data.student.id;
    const newEnrollmentId = bodyEnrollNew.data.enrollment.id;
    createdUserIds.push(newStudentId);
    createdEnrollmentIds.push(newEnrollmentId);

    // Verificar en BD
    const dbProfile = await prisma.studentProfile.findUnique({ where: { userId: newStudentId } });
    console.assert(dbProfile !== null, 'StudentProfile debe existir');
    console.assert(dbProfile?.studentNumber === studentNumberWithZeroes, 'Matrícula en BD preserva ceros exactos "00123456"');
    if (dbProfile) createdStudentProfileIds.push(dbProfile.id);

    const dbNewStudentToken = await prisma.authToken.findFirst({
      where: { userId: newStudentId, type: TokenType.ACCOUNT_ACTIVATION },
    });
    console.assert(dbNewStudentToken !== null, 'Token ACCOUNT_ACTIVATION para nuevo alumno debe existir');
    if (dbNewStudentToken) createdAuthTokenIds.push(dbNewStudentToken.id);

    console.log('  [PASS] Nuevo STUDENT inscrito por TEACHER asignado -> 200 OK + Ceros iniciales "00123456" preservados');

    // 4.2 Inscribir STUDENT existente y activado en un segundo curso (Course B: draftCourse)
    // Crear un estudiante activado previo
    const existingActUser = await prisma.user.create({
      data: {
        email: `test.p4a.existing.act.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Preexistente Activado',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: true,
        activatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    createdUserIds.push(existingActUser.id);

    const existingActMatricula = `00998877`;
    const existingActProfile = await prisma.studentProfile.create({
      data: {
        userId: existingActUser.id,
        studentNumber: existingActMatricula,
      },
    });
    createdStudentProfileIds.push(existingActProfile.id);

    const userCountBefore = await prisma.user.count();
    const profileCountBefore = await prisma.studentProfile.count();

    const resEnrollExistAct = await fetch(`${baseUrl}/api/courses/${draftCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: existingActUser.name,
        studentNumber: existingActMatricula,
        email: existingActUser.email,
      }),
    });
    const bodyEnrollExistAct = (await resEnrollExistAct.json()) as any;
    console.assert(resEnrollExistAct.status === 200, `Expected 200, got ${resEnrollExistAct.status}`);
    console.assert(bodyEnrollExistAct.data.isNewStudent === false, 'isNewStudent debe ser false');

    const enrollExistActId = bodyEnrollExistAct.data.enrollment.id;
    createdEnrollmentIds.push(enrollExistActId);

    const userCountAfter = await prisma.user.count();
    const profileCountAfter = await prisma.studentProfile.count();

    console.assert(userCountBefore === userCountAfter, 'Conteo de usuarios no debe cambiar');
    console.assert(profileCountBefore === profileCountAfter, 'Conteo de StudentProfile no debe cambiar');

    const dbExistUserAfter = await prisma.user.findUnique({ where: { id: existingActUser.id } });
    console.assert(dbExistUserAfter?.mustChangePassword === false, 'mustChangePassword debe permanecer false');
    console.assert(dbExistUserAfter?.activatedAt !== null, 'activatedAt debe permanecer con fecha');

    const dbTokensExistUser = await prisma.authToken.count({ where: { userId: existingActUser.id } });
    console.assert(dbTokensExistUser === 0, 'NO se debe crear un nuevo activation token para alumno activado');

    console.log('  [PASS] Alumno existente activado inscrito a 2do curso -> 200 OK (sin duplicar User/Profile/tokens)');

    // 4.3 Inscribir STUDENT existente pero pendiente de activación
    const existingPendUser = await prisma.user.create({
      data: {
        email: `test.p4a.existing.pend.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Preexistente Pendiente',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(existingPendUser.id);

    const existingPendMatricula = `00998866`;
    const existingPendProfile = await prisma.studentProfile.create({
      data: {
        userId: existingPendUser.id,
        studentNumber: existingPendMatricula,
      },
    });
    createdStudentProfileIds.push(existingPendProfile.id);

    const resEnrollExistPend = await fetch(`${baseUrl}/api/courses/${draftCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: existingPendUser.name,
        studentNumber: existingPendMatricula,
        email: existingPendUser.email,
      }),
    });
    const bodyEnrollExistPend = (await resEnrollExistPend.json()) as any;
    console.assert(resEnrollExistPend.status === 200, `Expected 200, got ${resEnrollExistPend.status}`);
    console.assert(bodyEnrollExistPend.data.isNewStudent === false, 'isNewStudent debe ser false');

    const enrollExistPendId = bodyEnrollExistPend.data.enrollment.id;
    createdEnrollmentIds.push(enrollExistPendId);

    console.log('  [PASS] Alumno existente pendiente inscrito a 2do curso -> 200 OK (sin duplicar User/Profile)');

    // 4.4 Intento de inscribir al mismo alumno en el mismo curso -> 409 STUDENT_ALREADY_ENROLLED
    const resAlreadyEnrolled = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumno Repetido',
        studentNumber: studentNumberWithZeroes,
        email: newStudentEmail,
      }),
    });
    const bodyAlreadyEnrolled = (await resAlreadyEnrolled.json()) as any;
    console.assert(resAlreadyEnrolled.status === 409, `Expected 409, got ${resAlreadyEnrolled.status}`);
    console.assert(bodyAlreadyEnrolled.error.code === 'STUDENT_ALREADY_ENROLLED', 'Code debe ser STUDENT_ALREADY_ENROLLED');
    console.log('  [PASS] Mismo alumno + mismo curso -> 409 STUDENT_ALREADY_ENROLLED');

    // 4.5 Pruebas de Conflicto (Conflict Rules)
    // Matrícula existente + email diferente -> STUDENT_NUMBER_EMAIL_CONFLICT
    const resConflictMatricula = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nombre Cualquiera',
        studentNumber: studentNumberWithZeroes,
        email: 'otroemail.diferente@potrolearn.edu.mx',
      }),
    });
    const bodyConflictMatricula = (await resConflictMatricula.json()) as any;
    console.assert(resConflictMatricula.status === 409, `Expected 409, got ${resConflictMatricula.status}`);
    console.assert(bodyConflictMatricula.error.code === 'STUDENT_NUMBER_EMAIL_CONFLICT', 'Code debe ser STUDENT_NUMBER_EMAIL_CONFLICT');
    console.log('  [PASS] Matrícula existente + email diferente -> 409 STUDENT_NUMBER_EMAIL_CONFLICT');

    // Email existente + matrícula diferente -> EMAIL_STUDENT_NUMBER_CONFLICT
    const resConflictEmail = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nombre Cualquiera',
        studentNumber: '00999999',
        email: newStudentEmail,
      }),
    });
    const bodyConflictEmail = (await resConflictEmail.json()) as any;
    console.assert(resConflictEmail.status === 409, `Expected 409, got ${resConflictEmail.status}`);
    console.assert(bodyConflictEmail.error.code === 'EMAIL_STUDENT_NUMBER_CONFLICT', 'Code debe ser EMAIL_STUDENT_NUMBER_CONFLICT');
    console.log('  [PASS] Email existente + matrícula diferente -> 409 EMAIL_STUDENT_NUMBER_CONFLICT');

    // 4.6 Pruebas de Autorización por Curso
    // Profesor no asignado (Teacher 2) intenta inscribir -> 403
    const resTeacherUnassigned = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher2Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumno Prueba Auth',
        studentNumber: '00777777',
        email: `test.p4a.unassigned.${Date.now()}@potrolearn.edu.mx`,
      }),
    });
    console.assert(resTeacherUnassigned.status === 403, `Expected 403, got ${resTeacherUnassigned.status}`);
    console.log('  [PASS] Profesor no asignado al curso -> 403 FORBIDDEN');

    // 4.7 Pruebas de Estado de Curso (Course Status)
    // Cursos FINISHED y ARCHIVED bloqueados
    const resFinishedEnroll = await fetch(`${baseUrl}/api/courses/${finishedCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumno Fin',
        studentNumber: '00555555',
        email: `test.p4a.fin.${Date.now()}@potrolearn.edu.mx`,
      }),
    });
    const bodyFinishedEnroll = (await resFinishedEnroll.json()) as any;
    console.assert(resFinishedEnroll.status === 400, `Expected 400, got ${resFinishedEnroll.status}`);
    console.assert(bodyFinishedEnroll.error.code === 'COURSE_NOT_AVAILABLE_FOR_ENROLLMENT', 'Code COURSE_NOT_AVAILABLE_FOR_ENROLLMENT');
    console.log('  [PASS] Inscripción en curso FINISHED rechazada con COURSE_NOT_AVAILABLE_FOR_ENROLLMENT');

    const resArchivedEnroll = await fetch(`${baseUrl}/api/courses/${archivedCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumno Arch',
        studentNumber: '00444444',
        email: `test.p4a.arch.${Date.now()}@potrolearn.edu.mx`,
      }),
    });
    const bodyArchivedEnroll = (await resArchivedEnroll.json()) as any;
    console.assert(resArchivedEnroll.status === 400, `Expected 400, got ${resArchivedEnroll.status}`);
    console.assert(bodyArchivedEnroll.error.code === 'COURSE_NOT_AVAILABLE_FOR_ENROLLMENT', 'Code COURSE_NOT_AVAILABLE_FOR_ENROLLMENT');
    console.log('  [PASS] Inscripción en curso ARCHIVED rechazada con COURSE_NOT_AVAILABLE_FOR_ENROLLMENT');

    // ----------------------------------------------------
    // 5. PRUEBA DE CONCURRENCIA DE INSCRIPCION
    // ----------------------------------------------------
    console.log('\n--- 5. Concurrent Student Enrollment Test ---');

    const concMatricula = '00333222';
    const concEmail = `test.p4a.concurrent.${Date.now()}@potrolearn.edu.mx`;

    const concPayload = JSON.stringify({
      name: 'Estudiante Concurrente',
      studentNumber: concMatricula,
      email: concEmail,
    });

    const [concRes1, concRes2] = await Promise.all([
      fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
        body: concPayload,
      }),
      fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
        body: concPayload,
      }),
    ]);

    const concStatuses = [concRes1.status, concRes2.status];
    const concSuccesses = concStatuses.filter((s) => s === 200).length;
    const concRejections = concStatuses.filter((s) => s === 409 || s === 400).length;

    console.assert(concSuccesses === 1, `Exactamente 1 éxito (got ${concSuccesses})`);
    console.assert(concRejections === 1, `Exactamente 1 rechazo (got ${concRejections})`);

    // Trackear usuario y enrollment creado
    const concUser = await prisma.user.findUnique({ where: { email: concEmail }, include: { studentProfile: true, enrollments: true } });
    if (concUser) {
      createdUserIds.push(concUser.id);
      if (concUser.studentProfile) createdStudentProfileIds.push(concUser.studentProfile.id);
      if (concUser.enrollments.length > 0) {
        for (const e of concUser.enrollments) {
          createdEnrollmentIds.push(e.id);
        }
      }
      const concTokens = await prisma.authToken.findMany({ where: { userId: concUser.id } });
      for (const t of concTokens) {
        createdAuthTokenIds.push(t.id);
      }
    }

    console.assert(concUser?.enrollments.length === 1, 'Exactamente 1 Enrollment debe existir en BD');
    console.log('  [PASS] Inscripción concurrente: 1 SUCCESS (200), 1 REJECTED (409) y exactamente 1 Enrollment en BD');

    // ----------------------------------------------------
    // 6. CHECKPOINT 4A.1 SPECIFIC VALIDATIONS
    // ----------------------------------------------------
    console.log('\n--- 6. Checkpoint 4A.1 Specific Validations ---');

    // 6.A ADMIN enrollment without CourseTeacher
    // adminUser is NOT registered in CourseTeacher for activeCourse
    const adminNoTeacherEmail = `test.p4a.admin.bypass.${Date.now()}@potrolearn.edu.mx`;
    const adminNoTeacherMatricula = '00881122';

    const resAdminBypass = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Estudiante Inscrito Por Admin Bypass',
        studentNumber: adminNoTeacherMatricula,
        email: adminNoTeacherEmail,
      }),
    });
    const bodyAdminBypass = (await resAdminBypass.json()) as any;
    console.assert(resAdminBypass.status === 200, `Expected 200/201, got ${resAdminBypass.status}`);
    console.assert(bodyAdminBypass.data.student.id !== undefined, 'Estudiante retornado');

    const adminBypassStudentId = bodyAdminBypass.data.student.id;
    const adminBypassEnrollmentId = bodyAdminBypass.data.enrollment.id;
    createdUserIds.push(adminBypassStudentId);
    createdEnrollmentIds.push(adminBypassEnrollmentId);

    const dbAdminBypassEnrollment = await prisma.enrollment.findUnique({
      where: { id: adminBypassEnrollmentId },
    });
    console.assert(dbAdminBypassEnrollment !== null, 'Enrollment debe estar persistido en BD');
    console.assert(dbAdminBypassEnrollment?.studentId === adminBypassStudentId, 'studentId coincide');
    console.assert(dbAdminBypassEnrollment?.courseId === activeCourse.id, 'courseId coincide');

    const dbAdminBypassProfile = await prisma.studentProfile.findUnique({
      where: { userId: adminBypassStudentId },
    });
    if (dbAdminBypassProfile) createdStudentProfileIds.push(dbAdminBypassProfile.id);

    const dbAdminBypassToken = await prisma.authToken.findFirst({
      where: { userId: adminBypassStudentId, type: TokenType.ACCOUNT_ACTIVATION },
    });
    if (dbAdminBypassToken) createdAuthTokenIds.push(dbAdminBypassToken.id);

    console.log('  [PASS] A. ADMIN enrollment without CourseTeacher -> 200 SUCCESS (Enrollment persistido)');

    // 6.B STUDENT cannot enroll users
    const userCountBeforeStudAttempt = await prisma.user.count();
    const profileCountBeforeStudAttempt = await prisma.studentProfile.count();
    const enrollmentCountBeforeStudAttempt = await prisma.enrollment.count();
    const tokenCountBeforeStudAttempt = await prisma.authToken.count();

    const resStudentForbiddenAttempt = await fetch(`${baseUrl}/api/courses/${activeCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Intento Por Alumno',
        studentNumber: '00776655',
        email: `test.p4a.stud.forbidden.${Date.now()}@potrolearn.edu.mx`,
      }),
    });
    console.assert(resStudentForbiddenAttempt.status === 403, `Expected 403, got ${resStudentForbiddenAttempt.status}`);

    const userCountAfterStudAttempt = await prisma.user.count();
    const profileCountAfterStudAttempt = await prisma.studentProfile.count();
    const enrollmentCountAfterStudAttempt = await prisma.enrollment.count();
    const tokenCountAfterStudAttempt = await prisma.authToken.count();

    console.assert(userCountBeforeStudAttempt === userCountAfterStudAttempt, 'Ningún User nuevo creado');
    console.assert(profileCountBeforeStudAttempt === profileCountAfterStudAttempt, 'Ningún StudentProfile nuevo creado');
    console.assert(enrollmentCountBeforeStudAttempt === enrollmentCountAfterStudAttempt, 'Ningún Enrollment nuevo creado');
    console.assert(tokenCountBeforeStudAttempt === tokenCountAfterStudAttempt, 'Ningún AuthToken nuevo creado');

    console.log('  [PASS] B. STUDENT cannot enroll users -> 403 FORBIDDEN (0 registros creados)');

    // 6.C DRAFT course enrollment
    const draftCourseStudentEmail = `test.p4a.draft.enrollment.${Date.now()}@potrolearn.edu.mx`;
    const draftCourseStudentMatricula = '00665544';

    const resDraftEnroll = await fetch(`${baseUrl}/api/courses/${draftCourse.id}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumno En Curso Borrador',
        studentNumber: draftCourseStudentMatricula,
        email: draftCourseStudentEmail,
      }),
    });
    const bodyDraftEnroll = (await resDraftEnroll.json()) as any;
    console.assert(resDraftEnroll.status === 200, `Expected 200, got ${resDraftEnroll.status}`);
    console.assert(bodyDraftEnroll.data.enrollment.status === 'ACTIVE', 'Enrollment.status debe ser ACTIVE');

    const draftStudentId = bodyDraftEnroll.data.student.id;
    const draftEnrollmentId = bodyDraftEnroll.data.enrollment.id;
    createdUserIds.push(draftStudentId);
    createdEnrollmentIds.push(draftEnrollmentId);

    const dbDraftEnrollment = await prisma.enrollment.findUnique({
      where: { id: draftEnrollmentId },
    });
    console.assert(dbDraftEnrollment?.status === EnrollmentStatus.ACTIVE, 'Enrollment.status en BD es ACTIVE');

    const dbDraftCourse = await prisma.course.findUnique({
      where: { id: draftCourse.id },
    });
    console.assert(dbDraftCourse?.status === CourseStatus.DRAFT, 'Course.status se mantiene sin cambios en DRAFT');

    const dbDraftProfile = await prisma.studentProfile.findUnique({
      where: { userId: draftStudentId },
    });
    if (dbDraftProfile) createdStudentProfileIds.push(dbDraftProfile.id);

    const dbDraftToken = await prisma.authToken.findFirst({
      where: { userId: draftStudentId, type: TokenType.ACCOUNT_ACTIVATION },
    });
    if (dbDraftToken) createdAuthTokenIds.push(dbDraftToken.id);

    console.log('  [PASS] C. DRAFT course enrollment -> 200 SUCCESS (Enrollment.status = ACTIVE, Course.status sin cambios)');

    console.log('\n================================================================');
    console.log('   TODAS LAS PRUEBAS DE LA FASE 4A / CHECKPOINT 4A.1 PASARON');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 4A:', error);
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

    if (createdStudentProfileIds.length > 0) {
      const delProfiles = await prisma.studentProfile.deleteMany({ where: { id: { in: createdStudentProfileIds } } });
      console.log(`[CLEANUP] Eliminados ${delProfiles.count} StudentProfiles de prueba`);
    }

    if (createdUserIds.length > 0) {
      const delUsers = await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log(`[CLEANUP] Eliminados ${delUsers.count} Usuarios de prueba`);
    }

    const remUsers = await prisma.user.count({ where: { email: { contains: 'test.p4a.' } } });
    console.log(`[CLEANUP] Registros temporales restantes en BD: ${remUsers}`);
    console.assert(remUsers === 0, 'No deben quedar registros temporales en BD');

    if (server) {
      (server as Server).close();
      console.log('[CLEANUP] Servidor HTTP cerrado correctamente.');
    }

    await prisma.$disconnect();
  }
}

runPhase4aIntegrationTests();
