process.env.NODE_ENV = 'test';
process.env.PORT = '3007';

import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { Role } from '@prisma/client';
import app from '../src/app';

const API_URL = 'http://localhost:3007/api';

async function runSecurityCheckpointTest() {
  console.log('=== INICIANDO PRUEBA OBLIGATORIA DE SEGURIDAD (FASE 6A CHECKPOINT) ===\n');

  const server = app.listen(3007);
  console.log('✓ Servidor HTTP de prueba iniciado en http://localhost:3007/api');

  // Limpieza inicial
  await prisma.courseTeacher.deleteMany({ where: { teacher: { email: 'sec_teacher@potrolearn.edu.mx' } } });
  await prisma.course.deleteMany({ where: { name: { startsWith: 'SEC_' } } });
  await prisma.subject.deleteMany({ where: { code: 'SEC_SUB101' } });
  await prisma.refreshSession.deleteMany({ where: { user: { email: 'sec_teacher@potrolearn.edu.mx' } } });
  await prisma.user.deleteMany({ where: { email: 'sec_teacher@potrolearn.edu.mx' } });

  const tempPassword = 'Password123!';
  const passwordHash = await PasswordService.hashPassword(tempPassword);

  // Crear Subject para la prueba
  const subject = await prisma.subject.create({
    data: {
      code: 'SEC_SUB101',
      name: 'Materia Seguridad',
    },
  });

  // 1. Crear usuario TEACHER temporal
  const teacherUser = await prisma.user.create({
    data: {
      email: 'sec_teacher@potrolearn.edu.mx',
      name: 'Teacher Security Test',
      passwordHash,
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log('1. Usuario TEACHER creado en DB:', teacherUser.email, '| Role en DB:', teacherUser.role);

  // Login como TEACHER y obtener Access JWT (que contiene role: TEACHER en payload)
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: teacherUser.email, password: tempPassword }),
  });
  const loginData = (await loginRes.json()) as any;
  const token = loginData.data?.token;
  if (!token) {
    throw new Error('No se obtuvo token en el login');
  }
  console.log('2. Login exitoso. JWT conservado en memoria.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Operación TEACHER permitida (POST /api/courses)
  const createCourseRes1 = await fetch(`${API_URL}/courses`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      subjectId: subject.id,
      name: 'SEC_Curso_Inicial',
      startDate: '2026-01-10',
      endDate: '2026-06-30',
    }),
  });

  console.log('3. Intento POST /api/courses con rol TEACHER en DB -> Status HTTP:', createCourseRes1.status);
  if (createCourseRes1.status !== 201) {
    const errJson = await createCourseRes1.json();
    console.error('Error al crear curso:', errJson);
    throw new Error(`Se esperaba 201 CREATED pero se recibió ${createCourseRes1.status}`);
  }

  // 3. Modificar directamente en DB el rol: TEACHER -> STUDENT (sin reemitir JWT)
  await prisma.user.update({
    where: { id: teacherUser.id },
    data: { role: Role.STUDENT },
  });
  console.log('4. Se modificó en DB el rol del usuario: TEACHER -> STUDENT (sin solicitar nuevo JWT).');

  // Verificar en DB que cambió
  const updatedUserInDb = await prisma.user.findUnique({ where: { id: teacherUser.id } });
  console.log('   Rol actual en PostgreSQL:', updatedUserInDb?.role);

  // 4. Reutilizar el JWT anterior para intentar la misma operación TEACHER
  const createCourseRes2 = await fetch(`${API_URL}/courses`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      subjectId: subject.id,
      name: 'SEC_Curso_NoPermitido',
      startDate: '2026-01-10',
      endDate: '2026-06-30',
    }),
  });

  const res2Data = (await createCourseRes2.json()) as any;
  console.log('5. Reintentando POST /api/courses usando el MISMO JWT -> Status HTTP:', createCourseRes2.status);
  console.log('   Respuesta API:', res2Data);

  try {
    if (createCourseRes2.status === 403) {
      console.log('\n=======================================================');
      console.log('  ¡PRUEBA EXITOSA! 🟢 STATUS 403 FORBIDDEN CONFIRMADO');
      console.log('  La API no confía en el JWT y valida el rol actual en DB.');
      console.log('=======================================================\n');
    } else {
      throw new Error(`FALLO DE SEGURIDAD: Se esperaba 403 FORBIDDEN pero se obtuvo status ${createCourseRes2.status}`);
    }
  } finally {
    // Cleanup
    await prisma.courseTeacher.deleteMany({ where: { teacher: { email: 'sec_teacher@potrolearn.edu.mx' } } });
    await prisma.course.deleteMany({ where: { name: { startsWith: 'SEC_' } } });
    await prisma.subject.deleteMany({ where: { id: subject.id } });
    await prisma.refreshSession.deleteMany({ where: { user: { email: 'sec_teacher@potrolearn.edu.mx' } } });
    await prisma.user.deleteMany({ where: { email: 'sec_teacher@potrolearn.edu.mx' } });
    server.close();
  }
}

runSecurityCheckpointTest().catch((err) => {
  console.error('❌ ERROR EN PRUEBA DE SEGURIDAD:', err);
  process.exit(1);
});
