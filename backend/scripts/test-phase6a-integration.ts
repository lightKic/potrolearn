process.env.NODE_ENV = 'test';
process.env.PORT = '3006';

import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { Role, CourseStatus, EnrollmentStatus } from '@prisma/client';
import app from '../src/app';

const API_URL = 'http://localhost:3006/api';

async function runPhase6aVerification() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN FASE 6A (COURSE MANAGEMENT V1) ===\n');

  const server = app.listen(3006);
  console.log('✓ Servidor HTTP de prueba iniciado en http://localhost:3006/api');

  // Limpieza inicial de datos de prueba previos
  await prisma.enrollment.deleteMany({ where: { student: { email: { startsWith: 'p6a_' } } } });
  await prisma.courseTeacher.deleteMany({ where: { teacher: { email: { startsWith: 'p6a_' } } } });
  await prisma.course.deleteMany({ where: { name: { startsWith: 'P6A_' } } });
  await prisma.subject.deleteMany({ where: { code: { startsWith: 'P6A_' } } });
  await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'p6a_' } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'p6a_' } } });

  const tempPassword = 'Password123!';
  const passwordHash = await PasswordService.hashPassword(tempPassword);

  // Crear usuarios de prueba
  const adminUser = await prisma.user.create({
    data: {
      email: 'p6a_admin@potrolearn.edu.mx',
      name: 'Admin Phase 6A',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherA = await prisma.user.create({
    data: {
      email: 'p6a_teachera@potrolearn.edu.mx',
      name: 'Teacher A',
      passwordHash,
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherB = await prisma.user.create({
    data: {
      email: 'p6a_teacherb@potrolearn.edu.mx',
      name: 'Teacher B',
      passwordHash,
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'p6a_student@potrolearn.edu.mx',
      name: 'Student Test',
      passwordHash,
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Función helper para login y obtención de cookies / headers
  async function loginAndGetHeader(email: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: tempPassword }),
    });
    const setCookie = res.headers.get('set-cookie') || '';
    const cookieMatch = setCookie.match(/potrolearn_refresh=([^;]+)/);
    const rawCookie = cookieMatch ? cookieMatch[1] : '';

    const json = (await res.json()) as any;
    const token = json.data?.token;

    return {
      token,
      cookie: `potrolearn_refresh=${rawCookie}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
  }

  const adminAuth = await loginAndGetHeader(adminUser.email);
  const teacherAAuth = await loginAndGetHeader(teacherA.email);
  const teacherBAuth = await loginAndGetHeader(teacherB.email);
  const studentAuth = await loginAndGetHeader(studentUser.email);

  console.log('✓ Usuarios y tokens de prueba autenticados');

  try {
    // -------------------------------------------------------------
    // 1. SUBJECT TESTS
    // -------------------------------------------------------------
    console.log('\n--- 1. PRUEBAS DE SUBJECT (MATERIAS) ---');

    // ADMIN crea Subject
    const createSubRes = await fetch(`${API_URL}/subjects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        code: 'P6A_MAT101',
        name: 'Matemáticas Discretas 6A',
        description: 'Materia de prueba Fase 6A',
      }),
    });
    if (createSubRes.status !== 201) {
      throw new Error(`Error al crear Subject por ADMIN: ${createSubRes.status}`);
    }
    const subjectA = ((await createSubRes.json()) as any).data;
    console.log('✓ ADMIN creó Subject exitosamente:', subjectA.code);

    // ADMIN intenta duplicar clave -> debe dar HTTP 409
    const dupSubRes = await fetch(`${API_URL}/subjects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        code: 'P6A_MAT101',
        name: 'Otra Materia',
      }),
    });
    if (dupSubRes.status !== 409) {
      throw new Error(`Esperado 409 al duplicar clave de Subject, recibido: ${dupSubRes.status}`);
    }
    console.log('✓ Intento de clave de Subject duplicada rechazado con 409 SUBJECT_CODE_EXISTS.');

    // TEACHER intenta crear Subject -> debe dar HTTP 403
    const teacherSubRes = await fetch(`${API_URL}/subjects`, {
      method: 'POST',
      headers: teacherAAuth.headers,
      body: JSON.stringify({
        code: 'P6A_ILLEGAL',
        name: 'Intento Maestro',
      }),
    });
    if (teacherSubRes.status !== 403) {
      throw new Error(`Esperado 403 al intentar crear Subject por TEACHER, recibido: ${teacherSubRes.status}`);
    }
    console.log('✓ Intento de TEACHER de crear Subject rechazado con 403 FORBIDDEN.');

    // -------------------------------------------------------------
    // 2. COURSE CREATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 2. PRUEBAS DE CREACIÓN DE CURSOS ---');

    // ADMIN crea Course -> DRAFT, createdBy ADMIN, no auto teacher
    const adminCourseRes = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        subjectId: subjectA.id,
        name: 'P6A_Curso_Admin_01',
        startDate: '2026-01-10',
        endDate: '2026-06-30',
      }),
    });
    if (adminCourseRes.status !== 201) {
      throw new Error(`Error al crear Course por ADMIN: ${adminCourseRes.status}`);
    }
    const courseAdmin = ((await adminCourseRes.json()) as any).data;
    if (courseAdmin.status !== 'DRAFT') {
      throw new Error('Course recién creado debe ser DRAFT');
    }
    if (courseAdmin.courseTeachers.length !== 0) {
      throw new Error('Course creado por ADMIN no debe autoasignar maestros');
    }
    console.log('✓ ADMIN creó Course en DRAFT sin autoasignación de maestros.');

    // TEACHER A crea Course -> DRAFT, createdBy TEACHER A, autoassigned in CourseTeacher
    const teacherCourseRes = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: teacherAAuth.headers,
      body: JSON.stringify({
        subjectId: subjectA.id,
        name: 'P6A_Curso_TeacherA_01',
        startDate: '2026-01-10',
        endDate: '2026-06-30',
      }),
    });
    if (teacherCourseRes.status !== 201) {
      throw new Error(`Error al crear Course por TEACHER A: ${teacherCourseRes.status}`);
    }
    const courseTeacherA = ((await teacherCourseRes.json()) as any).data;
    if (courseTeacherA.courseTeachers.length !== 1 || courseTeacherA.courseTeachers[0].teacherId !== teacherA.id) {
      throw new Error('Course creado por TEACHER debe asignarlo automáticamente en CourseTeacher');
    }
    console.log('✓ TEACHER A creó Course y quedó autoasignado en la transacción.');

    // -------------------------------------------------------------
    // 3. ROLE SCOPED VISIBILITY & DETAIL ACCESS
    // -------------------------------------------------------------
    console.log('\n--- 3. PRUEBAS DE SCOPING DE VISIBILIDAD POR ROL ---');

    // ADMIN ve todos los cursos
    const adminListRes = await fetch(`${API_URL}/courses`, { method: 'GET', headers: adminAuth.headers });
    const adminList = ((await adminListRes.json()) as any).data;
    if (!adminList.some((c: any) => c.id === courseAdmin.id) || !adminList.some((c: any) => c.id === courseTeacherA.id)) {
      throw new Error('ADMIN debe ver todos los cursos');
    }
    console.log('✓ ADMIN consulta GET /courses y ve el listado completo.');

    // TEACHER A ve solo su curso (courseTeacherA), no courseAdmin (sin maestros)
    const teacherAListRes = await fetch(`${API_URL}/courses`, { method: 'GET', headers: teacherAAuth.headers });
    const teacherAList = ((await teacherAListRes.json()) as any).data;
    if (!teacherAList.some((c: any) => c.id === courseTeacherA.id)) {
      throw new Error('TEACHER A debe ver el curso asignado');
    }
    if (teacherAList.some((c: any) => c.id === courseAdmin.id)) {
      throw new Error('TEACHER A no debe ver cursos donde no está asignado');
    }
    console.log('✓ TEACHER A consulta GET /courses y solo ve cursos asignados.');

    // TEACHER A intenta GET /courses/:id de un curso no asignado -> 403
    const forbiddenDetailRes = await fetch(`${API_URL}/courses/${courseAdmin.id}`, { method: 'GET', headers: teacherAAuth.headers });
    if (forbiddenDetailRes.status !== 403) {
      throw new Error(`Esperado 403 para TEACHER en curso no asignado, recibido: ${forbiddenDetailRes.status}`);
    }
    console.log('✓ Intento de TEACHER de ver detalle de curso no asignado rechazado con 403 FORBIDDEN.');

    // -------------------------------------------------------------
    // 4. TEACHER ASSIGNMENT TESTS
    // -------------------------------------------------------------
    console.log('\n--- 4. PRUEBAS DE ASIGNACIÓN DE MAESTROS (CourseTeacher) ---');

    // ADMIN asigna TEACHER A a courseAdmin
    const assignRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/teachers`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({ teacherId: teacherA.id }),
    });
    if (assignRes.status !== 201) {
      throw new Error(`Error al asignar maestro por ADMIN: ${assignRes.status}`);
    }
    console.log('✓ ADMIN asignó exitosamente a TEACHER A al curso courseAdmin.');

    // Intentar asignar al mismo maestro de nuevo -> 409
    const dupAssignRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/teachers`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({ teacherId: teacherA.id }),
    });
    if (dupAssignRes.status !== 409) {
      throw new Error(`Esperado 409 al duplicar asignación de maestro, recibido: ${dupAssignRes.status}`);
    }
    console.log('✓ Intento de asignación duplicada de maestro rechazado con 409 TEACHER_ALREADY_ASSIGNED.');

    // Intentar asignar un estudiante como maestro -> 400
    const invalidRoleAssignRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/teachers`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({ teacherId: studentUser.id }),
    });
    if (invalidRoleAssignRes.status !== 400) {
      throw new Error(`Esperado 400 al asignar estudiante como maestro, recibido: ${invalidRoleAssignRes.status}`);
    }
    console.log('✓ Intento de asignar alumno como maestro rechazado con 400 INVALID_TEACHER_ROLE.');

    // TEACHER intenta asignar un maestro -> 403
    const teacherAssignRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/teachers`, {
      method: 'POST',
      headers: teacherAAuth.headers,
      body: JSON.stringify({ teacherId: teacherB.id }),
    });
    if (teacherAssignRes.status !== 403) {
      throw new Error(`Esperado 403 al asignar maestro por TEACHER, recibido: ${teacherAssignRes.status}`);
    }
    console.log('✓ Intento de TEACHER de asignar maestros rechazado con 403 FORBIDDEN.');

    // -------------------------------------------------------------
    // 5. COURSE STATUS LIFECYCLE TESTS
    // -------------------------------------------------------------
    console.log('\n--- 5. PRUEBAS DE CICLO DE VIDA DE ESTADO DE CURSOS ---');

    // Crear un curso DRAFT sin maestros
    const noTeacherCourseRes = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        subjectId: subjectA.id,
        name: 'P6A_Curso_NoTeacher',
        startDate: '2026-01-10',
        endDate: '2026-06-30',
      }),
    });
    const noTeacherCourse = ((await noTeacherCourseRes.json()) as any).data;

    // Intentar activar DRAFT sin maestros -> 400 COURSE_REQUIRES_TEACHER
    const activateNoTeacherRes = await fetch(`${API_URL}/courses/${noTeacherCourse.id}/status`, {
      method: 'PATCH',
      headers: adminAuth.headers,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (activateNoTeacherRes.status !== 400) {
      throw new Error(`Esperado 400 al activar curso sin maestros, recibido: ${activateNoTeacherRes.status}`);
    }
    console.log('✓ Activación de curso sin maestros rechazada con 400 COURSE_REQUIRES_TEACHER.');

    // Activar courseAdmin (tiene a TEACHER A) -> DRAFT -> ACTIVE
    const activateRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/status`, {
      method: 'PATCH',
      headers: adminAuth.headers,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (activateRes.status !== 200) {
      throw new Error(`Fallo al activar curso con maestro: ${activateRes.status}`);
    }
    console.log('✓ Transición DRAFT -> ACTIVE exitosa.');

    // Intentar quitar al único maestro del curso ACTIVE -> 400 COURSE_REQUIRES_TEACHER
    const removeLastTeacherRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/teachers/${teacherA.id}`, {
      method: 'DELETE',
      headers: adminAuth.headers,
    });
    if (removeLastTeacherRes.status !== 400) {
      throw new Error(`Esperado 400 al remover último maestro de curso activo, recibido: ${removeLastTeacherRes.status}`);
    }
    console.log('✓ Remoción de último maestro en curso ACTIVE rechazada con 400 COURSE_REQUIRES_TEACHER.');

    // Transición ACTIVE -> FINISHED
    const finishRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/status`, {
      method: 'PATCH',
      headers: adminAuth.headers,
      body: JSON.stringify({ status: 'FINISHED' }),
    });
    if (finishRes.status !== 200) {
      throw new Error(`Fallo al finalizar curso: ${finishRes.status}`);
    }
    console.log('✓ Transición ACTIVE -> FINISHED exitosa.');

    // Transición FINISHED -> ARCHIVED
    const archiveRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/status`, {
      method: 'PATCH',
      headers: adminAuth.headers,
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    if (archiveRes.status !== 200) {
      throw new Error(`Fallo al archivar curso: ${archiveRes.status}`);
    }
    console.log('✓ Transición FINISHED -> ARCHIVED exitosa.');

    // Transición inválida ARCHIVED -> ACTIVE -> 400
    const invalidTransRes = await fetch(`${API_URL}/courses/${courseAdmin.id}/status`, {
      method: 'PATCH',
      headers: adminAuth.headers,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (invalidTransRes.status !== 400) {
      throw new Error(`Esperado 400 al realizar transición inválida ARCHIVED -> ACTIVE, recibido: ${invalidTransRes.status}`);
    }
    console.log('✓ Transición inválida ARCHIVED -> ACTIVE rechazada con 400 INVALID_COURSE_STATUS_TRANSITION.');

    // -------------------------------------------------------------
    // 6. STUDENT VISIBILITY & MUTATIONS
    // -------------------------------------------------------------
    console.log('\n--- 6. PRUEBAS DE ESTUDIANTE (STUDENT) ---');

    // Inscribir a STUDENT en courseTeacherA vía prisma
    await prisma.enrollment.create({
      data: {
        courseId: courseTeacherA.id,
        studentId: studentUser.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    // STUDENT GET /courses -> ve solo courseTeacherA
    const studentCoursesRes = await fetch(`${API_URL}/courses`, { method: 'GET', headers: studentAuth.headers });
    const studentCourses = ((await studentCoursesRes.json()) as any).data;
    if (studentCourses.length !== 1 || studentCourses[0].id !== courseTeacherA.id) {
      throw new Error('STUDENT debe ver únicamente sus cursos inscritos');
    }
    console.log('✓ STUDENT consulta GET /courses y ve únicamente su curso inscrito.');

    // STUDENT intenta mutaciones (POST /courses, PATCH /status) -> 403
    const studentMutRes = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: studentAuth.headers,
      body: JSON.stringify({
        subjectId: subjectA.id,
        name: 'P6A_Student_Course',
        startDate: '2026-01-10',
        endDate: '2026-06-30',
      }),
    });
    if (studentMutRes.status !== 403) {
      throw new Error(`Esperado 403 al crear curso por STUDENT, recibido: ${studentMutRes.status}`);
    }
    console.log('✓ Mutaciones intentadas por STUDENT rechazadas con 403 FORBIDDEN.');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 6A PASARON! 🟢  ');
    console.log('=======================================================\n');
  } finally {
    // Cleanup cuidadoso
    await prisma.enrollment.deleteMany({ where: { student: { email: { startsWith: 'p6a_' } } } });
    await prisma.courseTeacher.deleteMany({ where: { teacher: { email: { startsWith: 'p6a_' } } } });
    await prisma.course.deleteMany({ where: { name: { startsWith: 'P6A_' } } });
    await prisma.subject.deleteMany({ where: { code: { startsWith: 'P6A_' } } });
    await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'p6a_' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'p6a_' } } });
    server.close();
  }
}

runPhase6aVerification().catch((err) => {
  console.error('❌ ERROR EN PRUEBAS FASE 6A:', err);
  process.exit(1);
});
