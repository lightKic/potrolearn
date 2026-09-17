process.env.NODE_ENV = 'test';
process.env.PORT = '3008';

import * as XLSX from 'xlsx';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { Role, CourseStatus, EnrollmentStatus } from '@prisma/client';
import app from '../src/app';

const API_URL = 'http://localhost:3008/api';

async function runPhase6bVerification() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN FASE 6B (STUDENT & ENROLLMENT MANAGEMENT V1) ===\n');

  const server = app.listen(3008);
  console.log('✓ Servidor HTTP de prueba iniciado en http://localhost:3008/api');

  // Limpieza inicial de datos de prueba de Fase 6B
  await prisma.enrollment.deleteMany({ where: { student: { email: { startsWith: 'p6b_' } } } });
  await prisma.courseTeacher.deleteMany({ where: { teacher: { email: { startsWith: 'p6b_' } } } });
  await prisma.course.deleteMany({ where: { name: { startsWith: 'P6B_' } } });
  await prisma.subject.deleteMany({ where: { code: { startsWith: 'P6B_' } } });
  await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'p6b_' } } } });
  await prisma.authToken.deleteMany({ where: { user: { email: { startsWith: 'p6b_' } } } });
  await prisma.studentProfile.deleteMany({ where: { studentNumber: { startsWith: 'P6B_' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'p6b_' } } });

  const tempPassword = 'Password123!';
  const passwordHash = await PasswordService.hashPassword(tempPassword);

  // Crear Subject para la prueba
  const subject = await prisma.subject.create({
    data: {
      code: 'P6B_SUB101',
      name: 'Materia Fase 6B',
    },
  });

  // Crear Usuarios de prueba
  const adminUser = await prisma.user.create({
    data: {
      email: 'p6b_admin@potrolearn.edu.mx',
      name: 'Admin Phase 6B',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const assignedTeacher = await prisma.user.create({
    data: {
      email: 'p6b_teacher_assigned@potrolearn.edu.mx',
      name: 'Teacher Assigned 6B',
      passwordHash,
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const unrelatedTeacher = await prisma.user.create({
    data: {
      email: 'p6b_teacher_unrelated@potrolearn.edu.mx',
      name: 'Teacher Unrelated 6B',
      passwordHash,
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'p6b_student@potrolearn.edu.mx',
      name: 'Student Test 6B',
      passwordHash,
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      studentNumber: 'P6B_STU001',
    },
  });

  // Crear Curso de prueba y asignar a assignedTeacher
  const course = await prisma.course.create({
    data: {
      subjectId: subject.id,
      createdById: adminUser.id,
      name: 'P6B_Curso_Prueba',
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-06-30'),
      status: CourseStatus.ACTIVE,
    },
  });

  await prisma.courseTeacher.create({
    data: {
      courseId: course.id,
      teacherId: assignedTeacher.id,
    },
  });

  // Helper para login
  async function loginAndGetHeader(email: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: tempPassword }),
    });
    const json = (await res.json()) as any;
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${json.data?.token}`,
      },
    };
  }

  const adminAuth = await loginAndGetHeader(adminUser.email);
  const assignedTeacherAuth = await loginAndGetHeader(assignedTeacher.email);
  const unrelatedTeacherAuth = await loginAndGetHeader(unrelatedTeacher.email);
  const studentAuth = await loginAndGetHeader(studentUser.email);

  console.log('✓ Usuarios y tokens de prueba autenticados');

  try {
    // -------------------------------------------------------------
    // 1. PERMISOS DE GET /api/courses/:courseId/students
    // -------------------------------------------------------------
    console.log('\n--- 1. PRUEBAS DE AUTORIZACIÓN GET /students ---');

    const adminGetRes = await fetch(`${API_URL}/courses/${course.id}/students`, { method: 'GET', headers: adminAuth.headers });
    if (adminGetRes.status !== 200) throw new Error(`ADMIN GET /students esperado 200, obtenido ${adminGetRes.status}`);
    console.log('✓ ADMIN consulta GET /students exitosamente (200 OK)');

    const teacherGetRes = await fetch(`${API_URL}/courses/${course.id}/students`, { method: 'GET', headers: assignedTeacherAuth.headers });
    if (teacherGetRes.status !== 200) throw new Error(`Assigned TEACHER GET /students esperado 200, obtenido ${teacherGetRes.status}`);
    console.log('✓ TEACHER asignado consulta GET /students exitosamente (200 OK)');

    const unrelatedGetRes = await fetch(`${API_URL}/courses/${course.id}/students`, { method: 'GET', headers: unrelatedTeacherAuth.headers });
    if (unrelatedGetRes.status !== 403) throw new Error(`Unrelated TEACHER esperado 403, obtenido ${unrelatedGetRes.status}`);
    console.log('✓ TEACHER no asignado rechazado con 403 FORBIDDEN');

    const studentGetRes = await fetch(`${API_URL}/courses/${course.id}/students`, { method: 'GET', headers: studentAuth.headers });
    if (studentGetRes.status !== 403) throw new Error(`STUDENT esperado 403, obtenido ${studentGetRes.status}`);
    console.log('✓ STUDENT rechazado con 403 FORBIDDEN');

    // -------------------------------------------------------------
    // 2. INSCRIBIR ALUMNO MANUAL (NUEVO CON CEROS INICIALES)
    // -------------------------------------------------------------
    console.log('\n--- 2. INSCRIBIR ALUMNO MANUALMENTE (NUEVO & MATRÍCULA CON CEROS) ---');

    const enrollManualRes = await fetch(`${API_URL}/courses/${course.id}/students`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        name: 'Nuevo Alumno Ceros',
        studentNumber: '000P6B_100', // Preserva ceros
        email: 'p6b_ceros@potrolearn.edu.mx',
      }),
    });
    if (enrollManualRes.status !== 200) throw new Error(`Error en enroll manual: ${enrollManualRes.status}`);
    const manualResult = ((await enrollManualRes.json()) as any).data;
    if (!manualResult.isNewStudent) throw new Error('isNewStudent debe ser true para alumno nuevo');

    // Verificar en DB que se preservaron los ceros
    const profileInDb = await prisma.studentProfile.findUnique({ where: { studentNumber: '000P6B_100' } });
    if (!profileInDb) throw new Error('StudentProfile con ceros iniciales no encontrado en DB');
    console.log('✓ Alumno nuevo creado con matrícula con ceros iniciales preservada ("000P6B_100").');

    // -------------------------------------------------------------
    // 3. PRUEBAS DE CONFLICTOS E IDENTIDADES ACADÉMICAS
    // -------------------------------------------------------------
    console.log('\n--- 3. PRUEBAS DE DETECCIÓN DE CONFLICTOS ---');

    // 3a. Reintentar inscribir al mismo alumno -> 409 STUDENT_ALREADY_ENROLLED
    const dupRes = await fetch(`${API_URL}/courses/${course.id}/students`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        name: 'Nuevo Alumno Ceros',
        studentNumber: '000P6B_100',
        email: 'p6b_ceros@potrolearn.edu.mx',
      }),
    });
    if (dupRes.status !== 409) throw new Error(`Esperado 409 STUDENT_ALREADY_ENROLLED, obtenido ${dupRes.status}`);
    console.log('✓ Inscripción duplicada del mismo alumno rechazada con 409 STUDENT_ALREADY_ENROLLED.');

    // 3b. Conflict: Matrícula existente pero email distinto -> 409 STUDENT_NUMBER_EMAIL_CONFLICT
    const conflict1Res = await fetch(`${API_URL}/courses/${course.id}/students`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        name: 'Conflicto Matrícula',
        studentNumber: '000P6B_100', // Matrícula existe
        email: 'p6b_otro_email@potrolearn.edu.mx', // Email distinto
      }),
    });
    if (conflict1Res.status !== 409) throw new Error(`Esperado 409 STUDENT_NUMBER_EMAIL_CONFLICT, obtenido ${conflict1Res.status}`);
    console.log('✓ Conflicto matrícula-email rechazado con 409 STUDENT_NUMBER_EMAIL_CONFLICT.');

    // 3c. Conflict: Email existente con otra matrícula -> 409 EMAIL_STUDENT_NUMBER_CONFLICT
    const conflict2Res = await fetch(`${API_URL}/courses/${course.id}/students`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        name: 'Conflicto Email',
        studentNumber: 'P6B_OTRA_MAT', // Matrícula distinta
        email: 'p6b_ceros@potrolearn.edu.mx', // Email existe
      }),
    });
    if (conflict2Res.status !== 409) throw new Error(`Esperado 409 EMAIL_STUDENT_NUMBER_CONFLICT, obtenido ${conflict2Res.status}`);
    console.log('✓ Conflicto email-matrícula rechazado con 409 EMAIL_STUDENT_NUMBER_CONFLICT.');

    // -------------------------------------------------------------
    // 4. VERIFICACIÓN DE PREVIEW EXCEL (SIN MUTACIÓN DE DB)
    // -------------------------------------------------------------
    console.log('\n--- 4. PRUEBA OBLIGATORIA: EXCEL PREVIEW SIN MUTACIÓN DE DB ---');

    // Registrar alumno en DB que estará "EXISTING_TO_ENROLL"
    const existingStudentUser = await prisma.user.create({
      data: {
        email: 'p6b_existing@potrolearn.edu.mx',
        name: 'Existing Student 6B',
        passwordHash,
        role: Role.STUDENT,
        isActive: true,
        mustChangePassword: false,
      },
    });
    await prisma.studentProfile.create({
      data: {
        userId: existingStudentUser.id,
        studentNumber: 'P6B_EX001',
      },
    });

    // Crear buffer Excel con casos:
    // Row 1 (header): nombre, matrícula, correo
    // Row 2: NEW -> p6b_new_excel@potrolearn.edu.mx / P6B_NEW001
    // Row 3: EXISTING_TO_ENROLL -> p6b_existing@potrolearn.edu.mx / P6B_EX001
    // Row 4: ALREADY_ENROLLED -> p6b_ceros@potrolearn.edu.mx / 000P6B_100
    // Row 5: CONFLICT -> p6b_existing@potrolearn.edu.mx / P6B_WRONG_MAT
    // Row 6: INVALID -> correo inválido
    // Row 7: DUPLICATE_STUDENT_NUMBER_IN_FILE -> P6B_NEW001 duplicado en archivo
    const excelRows = [
      { nombre: 'Excel New Student', matrícula: 'P6B_NEW001', correo: 'p6b_new_excel@potrolearn.edu.mx' },
      { nombre: 'Excel Existing Student', matrícula: 'P6B_EX001', correo: 'p6b_existing@potrolearn.edu.mx' },
      { nombre: 'Excel Already Enrolled', matrícula: '000P6B_100', correo: 'p6b_ceros@potrolearn.edu.mx' },
      { nombre: 'Excel Conflict', matrícula: 'P6B_WRONG_MAT', correo: 'p6b_existing@potrolearn.edu.mx' },
      { nombre: 'Excel Invalid Email', matrícula: 'P6B_INV001', correo: 'email_invalido' },
      { nombre: 'Excel Duplicate In File', matrícula: 'P6B_NEW001', correo: 'p6b_dup@potrolearn.edu.mx' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Conteos DB antes de preview
    const usersBefore = await prisma.user.count();
    const profilesBefore = await prisma.studentProfile.count();
    const enrollmentsBefore = await prisma.enrollment.count();
    const tokensBefore = await prisma.authToken.count();

    // Crear FormData simulado utilizando Blob/File mediante POST multipart con boundary
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let bodyString = `--${boundary}\r\n`;
    bodyString += `Content-Disposition: form-data; name="file"; filename="alumnos.xlsx"\r\n`;
    bodyString += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(bodyString, 'utf-8'),
      excelBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);

    const previewRes = await fetch(`${API_URL}/courses/${course.id}/students/import/preview`, {
      method: 'POST',
      headers: {
        Authorization: assignedTeacherAuth.headers.Authorization,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    if (previewRes.status !== 200) throw new Error(`Preview esperado 200, recibido ${previewRes.status}`);
    const previewData = ((await previewRes.json()) as any).data;

    // Conteos DB después de preview
    const usersAfter = await prisma.user.count();
    const profilesAfter = await prisma.studentProfile.count();
    const enrollmentsAfter = await prisma.enrollment.count();
    const tokensAfter = await prisma.authToken.count();

    if (
      usersBefore !== usersAfter ||
      profilesBefore !== profilesAfter ||
      enrollmentsBefore !== enrollmentsAfter ||
      tokensBefore !== tokensAfter
    ) {
      throw new Error('¡FALLO DE SEGURIDAD! El preview modificó la base de datos.');
    }
    console.log('✓ PASS: Conteo de la base de datos PERMANECE EXACTAMENTE IGUAL antes y después del preview.');
    console.log('✓ Resumen del Preview obtenido:', previewData.summary);

    // -------------------------------------------------------------
    // 5. BULK CONFIRMACIÓN DE IMPORTACIÓN
    // -------------------------------------------------------------
    console.log('\n--- 5. CONFIRMACIÓN BULK DE IMPORTACIÓN ---');

    const confirmRes = await fetch(`${API_URL}/courses/${course.id}/students/import/confirm`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        rows: [
          { name: 'Excel New Student', studentNumber: 'P6B_NEW001', email: 'p6b_new_excel@potrolearn.edu.mx' },
          { name: 'Excel Existing Student', studentNumber: 'P6B_EX001', email: 'p6b_existing@potrolearn.edu.mx' },
        ],
      }),
    });

    if (confirmRes.status !== 200) throw new Error(`Confirmación bulk esperada 200, recibida ${confirmRes.status}`);
    const confirmData = ((await confirmRes.json()) as any).data;
    if (confirmData.createdCount !== 1 || confirmData.enrolledExistingCount !== 1) {
      throw new Error(`Resultado de confirmación inesperado: ${JSON.stringify(confirmData)}`);
    }
    console.log('✓ Confirmación bulk procesó exitosamente 1 alumno nuevo y 1 alumno existente.');

    // -------------------------------------------------------------
    // 6. ACCIONES DE INVITACIÓN (RESEND & RESET ACCESS)
    // -------------------------------------------------------------
    console.log('\n--- 6. PRUEBAS DE ACCIONES DE INVITACIÓN Y ACCESO ---');

    const newStudentUser = await prisma.user.findUnique({ where: { email: 'p6b_new_excel@potrolearn.edu.mx' } });
    if (!newStudentUser) throw new Error('Usuario nuevo no encontrado en DB');

    // 6a. Reenviar invitación a usuario pendiente
    const resendRes = await fetch(`${API_URL}/courses/${course.id}/students/${newStudentUser.id}/resend-invitation`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
    });
    if (resendRes.status !== 200) throw new Error(`Resend invitation esperado 200, recibido ${resendRes.status}`);
    console.log('✓ Reenvío de invitación ejecutado correctamente (200 OK).');

    // 6b. Restablecer acceso a usuario activado (studentUser está activado y con enrollment)
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: studentUser.id } },
      create: { courseId: course.id, studentId: studentUser.id, status: EnrollmentStatus.ACTIVE },
      update: {},
    });
    await prisma.user.update({ where: { id: studentUser.id }, data: { activatedAt: new Date() } });
    const resetRes = await fetch(`${API_URL}/courses/${course.id}/students/${studentUser.id}/reset-access`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
    });
    if (resetRes.status !== 200) throw new Error(`Reset access esperado 200, recibido ${resetRes.status}`);
    const updatedStudent = await prisma.user.findUnique({ where: { id: studentUser.id } });
    if (!updatedStudent?.mustChangePassword) throw new Error('mustChangePassword debe ser true tras reset-access');
    console.log('✓ Restablecimiento de acceso obligó a mustChangePassword=true correctamente.');

    // -------------------------------------------------------------
    // 7. REGLAS DE CURSO FINISHED / ARCHIVED
    // -------------------------------------------------------------
    console.log('\n--- 7. BLOQUEO DE ENROLLMENT EN CURSO FINISHED/ARCHIVED ---');

    await prisma.course.update({ where: { id: course.id }, data: { status: CourseStatus.FINISHED } });

    const blockedEnrollRes = await fetch(`${API_URL}/courses/${course.id}/students`, {
      method: 'POST',
      headers: assignedTeacherAuth.headers,
      body: JSON.stringify({
        name: 'Intento Bloqueado',
        studentNumber: 'P6B_BLOCKED',
        email: 'p6b_blocked@potrolearn.edu.mx',
      }),
    });
    if (blockedEnrollRes.status !== 400) throw new Error(`Esperado 400 COURSE_NOT_AVAILABLE_FOR_ENROLLMENT, recibido ${blockedEnrollRes.status}`);
    console.log('✓ Intento de inscripción en curso FINISHED rechazado con 400 COURSE_NOT_AVAILABLE_FOR_ENROLLMENT.');

    // Restablecer estado a ACTIVE
    await prisma.course.update({ where: { id: course.id }, data: { status: CourseStatus.ACTIVE } });

    // -------------------------------------------------------------
    // 8. INSCRIPCIÓN CONCURRENTE
    // -------------------------------------------------------------
    console.log('\n--- 8. PRUEBA DE INSCRIPCIÓN CONCURRENTE SIMULTÁNEA ---');

    const concUser = await prisma.user.create({
      data: {
        email: 'p6b_concurrent@potrolearn.edu.mx',
        name: 'Concurrent Student 6B',
        passwordHash,
        role: Role.STUDENT,
        isActive: true,
        mustChangePassword: false,
      },
    });
    await prisma.studentProfile.create({
      data: {
        userId: concUser.id,
        studentNumber: 'P6B_CONC01',
      },
    });

    const [req1, req2] = await Promise.all([
      fetch(`${API_URL}/courses/${course.id}/students`, {
        method: 'POST',
        headers: assignedTeacherAuth.headers,
        body: JSON.stringify({
          name: concUser.name,
          studentNumber: 'P6B_CONC01',
          email: concUser.email,
        }),
      }),
      fetch(`${API_URL}/courses/${course.id}/students`, {
        method: 'POST',
        headers: assignedTeacherAuth.headers,
        body: JSON.stringify({
          name: concUser.name,
          studentNumber: 'P6B_CONC01',
          email: concUser.email,
        }),
      }),
    ]);

    const statuses = [req1.status, req2.status].sort();
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      throw new Error(`Resultado concurrente inesperado: ${statuses.join(', ')}`);
    }

    const enrollCountInDb = await prisma.enrollment.count({
      where: { courseId: course.id, studentId: concUser.id },
    });
    if (enrollCountInDb !== 1) throw new Error(`Enrollment count debe ser exactamente 1, actual: ${enrollCountInDb}`);
    console.log('✓ Inscripción concurrente manejada limpiamente (1 exitosa, 1 conflicto 409, exactamente 1 Enrollment en DB).');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 6B PASARON! 🟢  ');
    console.log('=======================================================\n');
  } finally {
    // Cleanup de registros temporales de Fase 6B
    await prisma.enrollment.deleteMany({ where: { student: { email: { startsWith: 'p6b_' } } } });
    await prisma.courseTeacher.deleteMany({ where: { teacher: { email: { startsWith: 'p6b_' } } } });
    await prisma.course.deleteMany({ where: { name: { startsWith: 'P6B_' } } });
    await prisma.subject.deleteMany({ where: { code: { startsWith: 'P6B_' } } });
    await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'p6b_' } } } });
    await prisma.authToken.deleteMany({ where: { user: { email: { startsWith: 'p6b_' } } } });
    await prisma.studentProfile.deleteMany({ where: { studentNumber: { startsWith: 'P6B_' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'p6b_' } } });
    server.close();
  }
}

runPhase6bVerification().catch((err) => {
  console.error('❌ ERROR EN PRUEBAS FASE 6B:', err);
  process.exit(1);
});
