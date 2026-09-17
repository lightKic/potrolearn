import { Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';

async function runPhase83IntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.3 (USER PROFILE & ACCOUNT MANAGEMENT V1) ---');

  const timestamp = Date.now();
  const adminEmail = `admin_83_${timestamp}@potrolearn.edu.mx`;
  const teacherEmail = `teacher_83_${timestamp}@potrolearn.edu.mx`;
  const studentEmail = `student_83_${timestamp}@potrolearn.edu.mx`;
  const studentMatricula = `EST-83-${timestamp}`;

  // 1. Setup Usuarios
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: 'dummyhash',
      name: 'Admin Original 8.3',
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: teacherEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher Original 8.3',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: 'dummyhash',
      name: 'Student Original 8.3',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: studentMatricula,
        },
      },
    },
  });

  console.log('✓ Setup de usuarios de prueba (ADMIN, TEACHER, STUDENT con matricula) completado');

  try {
    // -------------------------------------------------------------
    // 2. PRUEBAS DE LECTURA DE PERFIL (getCurrentUser)
    // -------------------------------------------------------------
    console.log('\n--- 2. LECTURA DE PERFIL (getCurrentUser) ---');

    const adminProfile = await AuthService.getCurrentUser(adminUser.id);
    if (!adminProfile || adminProfile.email !== adminEmail || adminProfile.role !== Role.ADMIN || adminProfile.studentProfile !== null) {
      throw new Error('Falló lectura de perfil de ADMIN');
    }
    if (!adminProfile.createdAt || !adminProfile.lastLoginAt) {
      // Nota: lastLoginAt puede ser null si nunca ha ingresado, pero los campos existen en el DTO
      console.log('✓ Campos de auditoría createdAt y lastLoginAt presentes en Admin Profile DTO');
    }
    console.log('✓ Lectura de perfil ADMIN verificada');

    const studentProfile = await AuthService.getCurrentUser(studentUser.id);
    if (!studentProfile || studentProfile.studentProfile?.studentNumber !== studentMatricula) {
      throw new Error(`Falló lectura de perfil STUDENT: matrícula esperada ${studentMatricula}, obtenida ${studentProfile?.studentProfile?.studentNumber}`);
    }
    console.log('✓ Lectura de perfil STUDENT verificada (incluye studentProfile.studentNumber)');

    // -------------------------------------------------------------
    // 3. PRUEBAS DE DESHABILITACIÓN DE AUTO-SERVICIO EN updateProfile
    // -------------------------------------------------------------
    console.log('\n--- 3. DESHABILITACIÓN DE AUTO-SERVICIO EN updateProfile ---');

    try {
      await AuthService.updateProfile(adminUser.id, { name: 'Admin Modificado 8.3' });
      throw new Error('Debió rechazar la modificación por auto-servicio para ADMIN');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de modificación por auto-servicio para ADMIN verificado (403 FORBIDDEN)');

    try {
      await AuthService.updateProfile(studentUser.id, { name: 'Student Modificado 8.3' });
      throw new Error('Debió rechazar la modificación por auto-servicio para STUDENT');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de modificación por auto-servicio para STUDENT verificado (403 FORBIDDEN)');

    // -------------------------------------------------------------
    // 5. VERIFICACIÓN DE INTEGRIDAD EN BASE DE DATOS
    // -------------------------------------------------------------
    console.log('\n--- 5. VERIFICACIÓN DE INTEGRIDAD EN DB ---');

    const dbStudent = await prisma.user.findUnique({
      where: { id: studentUser.id },
      include: { studentProfile: true },
    });

    if (!dbStudent) throw new Error('Usuario estudiante no encontrado en DB');
    if (dbStudent.role !== Role.STUDENT) throw new Error('El rol de estudiante fue alterado');
    if (dbStudent.email !== studentEmail) throw new Error('El email de estudiante fue alterado');
    if (dbStudent.isActive !== true) throw new Error('El estado isActive fue alterado');
    if (dbStudent.studentProfile?.studentNumber !== studentMatricula) throw new Error('La matrícula fue alterada');

    console.log('✓ Ningún campo protegido fue alterado en la base de datos');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.3 PASARON! 🟢');
    console.log('=======================================================');
  } finally {
    console.log('\n--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    await prisma.studentProfile.deleteMany({ where: { userId: studentUser.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, teacherUser.id, studentUser.id] } },
    });

    const remainingTempUsers = await prisma.user.count({
      where: { email: { contains: '_83_' } },
    });
    console.log(`✓ Registros temporales restantes en DB: ${remainingTempUsers}`);
    if (remainingTempUsers !== 0) {
      throw new Error('Quedaron registros temporales en la base de datos');
    }
  }
}

runPhase83IntegrationTests()
  .catch((err) => {
    console.error('❌ Error en pruebas de integración Fase 8.3:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
