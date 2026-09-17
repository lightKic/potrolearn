import { Role, CourseStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { ContentService } from '../src/services/content.service';
import { CourseService } from '../src/services/course.service';
import { SubjectService } from '../src/services/subject.service';
import { UserProvisioningService } from '../src/services/user-provisioning.service';

async function runPhase7aIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 7A ---');

  const timestamp = Date.now();
  const adminEmail = `admin_7a_${timestamp}@potrolearn.edu.mx`;
  const teacherEmail = `teacher_7a_${timestamp}@potrolearn.edu.mx`;
  const studentEmail = `student_7a_${timestamp}@potrolearn.edu.mx`;

  // Setup usuarios
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: 'dummyhash',
      name: 'Admin 7A',
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: teacherEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher 7A',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: 'dummyhash',
      name: 'Student 7A',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: `MAT-${timestamp}`,
        },
      },
    },
  });

  try {
    // 1. Crear Materia y Curso
    const subject = await SubjectService.createSubject({
      code: `SUB-7A-${timestamp}`,
      name: 'Materia 7A',
      description: 'Materia de prueba Fase 7A',
    });

    const course = await CourseService.createCourse(
      {
        subjectId: subject.id,
        name: 'Curso 7A Contenido',
        description: 'Curso para probar módulos y lecciones',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
      },
      { id: adminUser.id, role: Role.ADMIN }
    );

    // Asignar Maestro e Inscribir Alumno
    await CourseService.assignTeacher(course.id, teacherUser.id);
    await UserProvisioningService.enrollStudent({
      courseId: course.id,
      name: studentUser.name,
      studentNumber: `MAT-${timestamp}`,
      email: studentUser.email,
      executorUser: { id: adminUser.id, role: Role.ADMIN },
    });

    console.log('✓ Setup inicial completado (Admin, Maestro, Alumno, Materia, Curso)');

    // 2. Crear Módulos en orden secuencial
    const mod1 = await ContentService.createModule(
      course.id,
      { title: 'Módulo 1: Introducción', description: 'Primer módulo' },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    const mod2 = await ContentService.createModule(
      course.id,
      { title: 'Módulo 2: Intermedio', description: 'Segundo módulo' },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    const mod3 = await ContentService.createModule(
      course.id,
      { title: 'Módulo 3: Avanzado', description: 'Tercer módulo' },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    if (mod1.order !== 1 || mod2.order !== 2 || mod3.order !== 3) {
      throw new Error(`Falló ordenamiento secuencial inicial de módulos: ${mod1.order}, ${mod2.order}, ${mod3.order}`);
    }
    console.log('✓ Creación y asignación de orden secuencial de módulos verificada');

    // 3. Crear Lecciones dentro del Módulo 1
    const les1 = await ContentService.createLesson(
      course.id,
      mod1.id,
      { title: 'Lección 1.1', description: 'Desc 1.1', content: 'Contenido 1.1' },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    const les2 = await ContentService.createLesson(
      course.id,
      mod1.id,
      { title: 'Lección 1.2', description: 'Desc 1.2', content: 'Contenido 1.2' },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    const les3 = await ContentService.createLesson(
      course.id,
      mod1.id,
      { title: 'Lección 1.3', description: 'Desc 1.3', content: 'Contenido 1.3' },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    if (les1.order !== 1 || les2.order !== 2 || les3.order !== 3) {
      throw new Error(`Falló ordenamiento secuencial inicial de lecciones: ${les1.order}, ${les2.order}, ${les3.order}`);
    }
    console.log('✓ Creación y asignación de orden secuencial de lecciones verificada');

    // 4. Edición de Módulo y Lección
    const updatedMod1 = await ContentService.updateModule(
      course.id,
      mod1.id,
      { title: 'Módulo 1: Fundamentos Editado', isPublished: true },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    if (updatedMod1.title !== 'Módulo 1: Fundamentos Editado') {
      throw new Error('Falló edición de título de módulo');
    }

    const updatedLes1 = await ContentService.updateLesson(
      course.id,
      mod1.id,
      les1.id,
      { title: 'Lección 1.1 Editada', content: 'Contenido 1.1 Actualizado' },
      { id: teacherUser.id, role: Role.TEACHER }
    );
    if (updatedLes1.title !== 'Lección 1.1 Editada' || updatedLes1.content !== 'Contenido 1.1 Actualizado') {
      throw new Error('Falló edición de lección');
    }
    console.log('✓ Actualización de módulo y lección verificada');

    // 5. Reordenamiento Atómico de Módulos (Reordenar: [mod3, mod1, mod2])
    const reorderedMods = await ContentService.reorderModules(
      course.id,
      [mod3.id, mod1.id, mod2.id],
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const mod3New = reorderedMods.find((m) => m.id === mod3.id);
    const mod1New = reorderedMods.find((m) => m.id === mod1.id);
    const mod2New = reorderedMods.find((m) => m.id === mod2.id);

    if (mod3New?.order !== 1 || mod1New?.order !== 2 || mod2New?.order !== 3) {
      throw new Error(`Falló reordenamiento atómico de módulos: M3=${mod3New?.order}, M1=${mod1New?.order}, M2=${mod2New?.order}`);
    }
    console.log('✓ Reordenamiento atómico de módulos verificado (1..N sin duplicados ni vacíos)');

    // 6. Reordenamiento Atómico de Lecciones (Reordenar: [les3, les1, les2])
    const reorderedLessons = await ContentService.reorderLessons(
      course.id,
      mod1.id,
      [les3.id, les1.id, les2.id],
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const les3New = reorderedLessons.find((l) => l.id === les3.id);
    const les1New = reorderedLessons.find((l) => l.id === les1.id);
    const les2New = reorderedLessons.find((l) => l.id === les2.id);

    if (les3New?.order !== 1 || les1New?.order !== 2 || les2New?.order !== 3) {
      throw new Error(`Falló reordenamiento atómico de lecciones: L3=${les3New?.order}, L1=${les1New?.order}, L2=${les2New?.order}`);
    }
    console.log('✓ Reordenamiento atómico de lecciones verificado');

    // 7. Consulta de Contenido por parte del Alumno
    const studentContent = await ContentService.getCourseContent(course.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });
    if (studentContent.modules.length !== 3) {
      throw new Error('El alumno no pudo obtener la totalidad de los módulos');
    }

    const studentLessonDetail = await ContentService.getLessonDetail(course.id, mod1.id, les1.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });
    if (studentLessonDetail.title !== 'Lección 1.1 Editada') {
      throw new Error('El alumno no pudo obtener el detalle de la lección');
    }
    console.log('✓ Consulta de estructura y detalle por STUDENT verificada');

    // 8. Validación IDOR de Jerarquía (módulo incorrecto para lección)
    try {
      await ContentService.getLessonDetail(course.id, mod2.id, les1.id, {
        id: teacherUser.id,
        role: Role.TEACHER,
      });
      throw new Error('Debió fallar al solicitar lección con ID de módulo incorrecto');
    } catch (err: any) {
      if (err.code !== 'LESSON_MODULE_MISMATCH') {
        throw new Error(`Código de error inesperado en IDOR: ${err.code}`);
      }
    }
    console.log('✓ Protección IDOR jerárquica verificada');

    // 9. Transición de estado del curso DRAFT -> ACTIVE -> FINISHED
    await CourseService.changeCourseStatus(course.id, CourseStatus.ACTIVE, { id: adminUser.id, role: Role.ADMIN });
    await CourseService.changeCourseStatus(course.id, CourseStatus.FINISHED, { id: adminUser.id, role: Role.ADMIN });

    try {
      await ContentService.createModule(
        course.id,
        { title: 'Módulo Inválido' },
        { id: teacherUser.id, role: Role.TEACHER }
      );
      throw new Error('Debió fallar la creación de módulo en un curso FINISHED');
    } catch (err: any) {
      if (err.code !== 'COURSE_CONTENT_READ_ONLY') {
        throw new Error(`Código de error inesperado en curso finalizado: ${err.code}`);
      }
    }
    console.log('✓ Modo solo lectura en estado FINISHED (COURSE_CONTENT_READ_ONLY) verificado');

    console.log('--- TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 7A PASARON CON ÉXITO ---');
  } finally {
    // Cleanup
    await prisma.courseTeacher.deleteMany({ where: { courseId: { in: (await prisma.course.findMany({ where: { name: 'Curso 7A Contenido' }, select: { id: true } })).map(c => c.id) } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: (await prisma.course.findMany({ where: { name: 'Curso 7A Contenido' }, select: { id: true } })).map(c => c.id) } } });
    await prisma.lesson.deleteMany({ where: { title: { contains: 'Lección' } } });
    await prisma.module.deleteMany({ where: { title: { contains: 'Módulo' } } });
    await prisma.course.deleteMany({ where: { name: 'Curso 7A Contenido' } });
    await prisma.subject.deleteMany({ where: { name: 'Materia 7A' } });
    await prisma.studentProfile.deleteMany({ where: { userId: studentUser.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, teacherUser.id, studentUser.id] } } });
  }
}

runPhase7aIntegrationTests()
  .catch((err) => {
    console.error('❌ Error en pruebas de integración Fase 7A:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
