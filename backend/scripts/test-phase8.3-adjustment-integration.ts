import { Role, CourseStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { UserProvisioningService } from '../src/services/user-provisioning.service';
import { SubjectService } from '../src/services/subject.service';
import { CourseService } from '../src/services/course.service';

async function runPhase83AdjustmentIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 8.3 ADJUSTMENT (ACADEMIC IDENTITY ADMINISTRATION) ---');

  const timestamp = Date.now();
  const adminEmail = `admin_adj83_${timestamp}@potrolearn.edu.mx`;
  const teacherEmail = `teacher_adj83_${timestamp}@potrolearn.edu.mx`;
  const student1Email = `student1_adj83_${timestamp}@potrolearn.edu.mx`;
  const student2Email = `student2_adj83_${timestamp}@potrolearn.edu.mx`;

  const student1Matricula = `0012345`;
  const student2Matricula = `0099999`;

  // 1. Setup Usuarios
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: 'dummyhash',
      name: 'Admin Adj83',
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: teacherEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher Adj83',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const student1User = await prisma.user.create({
    data: {
      email: student1Email,
      passwordHash: 'dummyhash',
      name: 'Juan Pérez',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: student1Matricula,
        },
      },
    },
  });

  const student2User = await prisma.user.create({
    data: {
      email: student2Email,
      passwordHash: 'dummyhash',
      name: 'María López',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: student2Matricula,
        },
      },
    },
  });

  // Setup de Materia y Curso con Enrollment para verificar integridad académica
  const subject = await SubjectService.createSubject({
    code: `SUB-ADJ83-${timestamp}`,
    name: 'Materia Integridad Adj83',
    description: 'Materia para pruebas de integridad académica',
  });

  const course = await CourseService.createCourse(
    {
      subjectId: subject.id,
      name: 'Curso Integridad Adj83',
      description: 'Curso para verificar relaciones de enrollment',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-12-01T00:00:00.000Z',
    },
    { id: adminUser.id, role: Role.ADMIN }
  );

  await UserProvisioningService.enrollStudent({
    courseId: course.id,
    name: student1User.name,
    studentNumber: student1Matricula,
    email: student1User.email,
    executorUser: { id: adminUser.id, role: Role.ADMIN },
  });

  console.log('✓ Setup de usuarios de prueba, materia, curso e inscripciones completado');

  try {
    // -------------------------------------------------------------
    // 2. RECHAZO DE MODIFICACIÓN POR AUTO-SERVICIO (PUT /api/auth/me)
    // -------------------------------------------------------------
    console.log('\n--- 2. RECHAZO DE AUTO-SERVICIO EN PUT /api/auth/me ---');

    try {
      await AuthService.updateProfile(student1User.id, { name: 'Nombre Manipulado Student' });
      throw new Error('Debió fallar la modificación de nombre por auto-servicio para STUDENT');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de modificación por auto-servicio para STUDENT verificado (403 FORBIDDEN)');

    try {
      await AuthService.updateProfile(teacherUser.id, { name: 'Nombre Manipulado Teacher' });
      throw new Error('Debió fallar la modificación de nombre por auto-servicio para TEACHER');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de modificación por auto-servicio para TEACHER verificado (403 FORBIDDEN)');

    try {
      await AuthService.updateProfile(adminUser.id, { name: 'Nombre Manipulado Admin' });
      throw new Error('Debió fallar la modificación de nombre por auto-servicio para ADMIN');
    } catch (err: any) {
      if (err.code !== 'FORBIDDEN') throw err;
    }
    console.log('✓ Rechazo de modificación por auto-servicio en perfil propio verificado (403 FORBIDDEN)');

    // -------------------------------------------------------------
    // 3. PRUEBAS DE ENDPOINTS ADMINISTRATIVOS (UserProvisioningService)
    // -------------------------------------------------------------
    console.log('\n--- 3. ENDPOINTS ADMINISTRATIVOS (LIST, DETAIL, UPDATE) ---');

    // 3.1 Listado de usuarios
    const allUsers = await UserProvisioningService.listUsers();
    const fetchedStudent1 = allUsers.find((u) => u.id === student1User.id);
    if (!fetchedStudent1 || fetchedStudent1.studentProfile?.studentNumber !== student1Matricula) {
      throw new Error('Falló obtención de listado de usuarios o matrícula en listUsers()');
    }
    console.log('✓ listUsers() retorno listado correcto de usuarios con matricula');

    // 3.2 Detalle de usuario
    const detailStudent1 = await UserProvisioningService.getUserById(student1User.id);
    if (detailStudent1.name !== 'Juan Pérez' || detailStudent1.email !== student1Email) {
      throw new Error('Falló getUserById() para el alumno');
    }
    console.log('✓ getUserById() devuelto correctamente');

    // 3.3 Actualización administrativa exitosa de STUDENT (name, email, studentNumber, isActive)
    const newStudent1Name = 'Juan Carlos Pérez';
    const newStudent1Email = `juancarlos_adj83_${timestamp}@potrolearn.edu.mx`;
    const newStudent1Matricula = '00123456'; // Preserva ceros iniciales

    const updatedStudent1 = await UserProvisioningService.updateUserAdmin(student1User.id, {
      name: newStudent1Name,
      email: newStudent1Email,
      studentNumber: newStudent1Matricula,
      isActive: true,
    });

    if (
      updatedStudent1.name !== newStudent1Name ||
      updatedStudent1.email !== newStudent1Email ||
      updatedStudent1.studentProfile?.studentNumber !== newStudent1Matricula
    ) {
      throw new Error('Falló la actualización administrativa de datos de identidad del alumno');
    }
    console.log('✓ Actualización administrativa de STUDENT exitosa (nombre, email y matrícula preservando ceros iniciales)');

    // -------------------------------------------------------------
    // 4. VALIDACIONES DE UNICIDAD Y RECHAZO DE CAMPOS PROTEGIDOS
    // -------------------------------------------------------------
    console.log('\n--- 4. VALIDACIONES DE UNICIDAD Y CAMPOS PROTEGIDOS ---');

    // 4.1 Colisión de Correo Electrónico (409 EMAIL_ALREADY_EXISTS)
    try {
      await UserProvisioningService.updateUserAdmin(student2User.id, {
        email: newStudent1Email, // Ya pertenece a student1
      });
      throw new Error('Debió fallar la actualización por correo duplicado');
    } catch (err: any) {
      if (err.code !== 'EMAIL_ALREADY_EXISTS') throw err;
    }
    console.log('✓ Rechazo de colisión de correo electrónico verificado (409 EMAIL_ALREADY_EXISTS)');

    // 4.2 Colisión de Matrícula (409 STUDENT_NUMBER_EXISTS)
    try {
      await UserProvisioningService.updateUserAdmin(student2User.id, {
        studentNumber: newStudent1Matricula, // Ya pertenece a student1
      });
      throw new Error('Debió fallar la actualización por matrícula duplicada');
    } catch (err: any) {
      if (err.code !== 'STUDENT_NUMBER_EXISTS') throw err;
    }
    console.log('✓ Rechazo de colisión de matrícula verificado (409 STUDENT_NUMBER_EXISTS)');

    // 4.3 Asignación de matrícula a un usuario no-STUDENT
    try {
      await UserProvisioningService.updateUserAdmin(teacherUser.id, {
        studentNumber: 'EST-TEACHER',
      });
      throw new Error('Debió fallar la asignación de matrícula a un TEACHER');
    } catch (err: any) {
      if (err.code !== 'BAD_REQUEST') throw err;
    }
    console.log('✓ Rechazo de asignación de matrícula a rol no-STUDENT verificado (400 BAD_REQUEST)');

    // 4.4 Intento de enviar campos protegidos (id, role, passwordHash, createdAt, etc.)
    const protectedFieldsToTest = [
      { key: 'role', value: 'ADMIN' },
      { key: 'passwordHash', value: 'hackedhash' },
      { key: 'id', value: '00000000-0000-0000-0000-000000000000' },
      { key: 'createdAt', value: '2020-01-01T00:00:00.000Z' },
      { key: 'lastLoginAt', value: '2020-01-01T00:00:00.000Z' },
      { key: 'mustChangePassword', value: false },
    ];

    for (const testCase of protectedFieldsToTest) {
      try {
        await UserProvisioningService.updateUserAdmin(student1User.id, {
          name: 'Valid Name',
          [testCase.key]: testCase.value,
        } as any);
        throw new Error(`Debió fallar el envío del campo protegido '${testCase.key}'`);
      } catch (err: any) {
        if (err.code !== 'BAD_REQUEST') {
          throw new Error(`Se esperaba BAD_REQUEST para campo '${testCase.key}', pero se obtuvo code '${err.code}'`);
        }
      }
      console.log(`✓ Rechazo de campo protegido '${testCase.key}' verificado (400 BAD_REQUEST)`);
    }

    // -------------------------------------------------------------
    // 5. VERIFICACIÓN DE INTEGRIDAD ACADÉMICA Y RELACIONES EN DB
    // -------------------------------------------------------------
    console.log('\n--- 5. INTEGRIDAD ACADÉMICA Y RELACIONES EN DB ---');

    const dbStudent1 = await prisma.user.findUnique({
      where: { id: student1User.id },
      include: {
        studentProfile: true,
        enrollments: true,
      },
    });

    if (!dbStudent1) throw new Error('Usuario no encontrado en DB');
    if (dbStudent1.id !== student1User.id) throw new Error('User.id cambió indebidamente');
    if (dbStudent1.role !== Role.STUDENT) throw new Error('El rol fue alterado');
    if (dbStudent1.enrollments.length !== 1) throw new Error('Se perdió la relación de Enrollment');
    if (dbStudent1.studentProfile?.studentNumber !== newStudent1Matricula) throw new Error('La matrícula no se actualizó correctamente');

    console.log('✓ Integridad académica verificada (User.id, StudentProfile.id, Enrollment permanecen inalterados)');

    console.log('\n========================================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 8.3 ADJUSTMENT PASARON! 🟢');
    console.log('========================================================================');
  } finally {
    console.log('\n--- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA ---');
    await prisma.enrollment.deleteMany({
      where: { courseId: course.id },
    });
    await prisma.course.deleteMany({
      where: { id: course.id },
    });
    await prisma.subject.deleteMany({
      where: { id: subject.id },
    });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: [student1User.id, student2User.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, teacherUser.id, student1User.id, student2User.id] } },
    });

    const remainingTempUsers = await prisma.user.count({
      where: { email: { contains: '_adj83_' } },
    });
    console.log(`✓ Registros temporales restantes en DB: ${remainingTempUsers}`);
    if (remainingTempUsers !== 0) {
      throw new Error('Quedaron registros temporales en la base de datos');
    }
  }
}

runPhase83AdjustmentIntegrationTests()
  .catch((err) => {
    console.error('❌ Error en pruebas de integración Fase 8.3 Adjustment:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
