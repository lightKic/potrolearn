import { Role, CourseStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { ContentService } from '../src/services/content.service';
import { CourseService } from '../src/services/course.service';
import { SubjectService } from '../src/services/subject.service';
import { UserProvisioningService } from '../src/services/user-provisioning.service';

async function runPhase7bIntegrationTests() {
  console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN FASE 7B (RICH CONTENT & LESSON PROGRESS) ---');

  const timestamp = Date.now();
  const adminEmail = `admin_7b_${timestamp}@potrolearn.edu.mx`;
  const teacherEmail = `teacher_7b_${timestamp}@potrolearn.edu.mx`;
  const unrelatedTeacherEmail = `unrelated_teacher_7b_${timestamp}@potrolearn.edu.mx`;
  const studentEmail = `student_7b_${timestamp}@potrolearn.edu.mx`;
  const unrelatedStudentEmail = `unrelated_student_7b_${timestamp}@potrolearn.edu.mx`;

  // Setup usuarios
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: 'dummyhash',
      name: 'Admin 7B',
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: teacherEmail,
      passwordHash: 'dummyhash',
      name: 'Teacher 7B',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const unrelatedTeacherUser = await prisma.user.create({
    data: {
      email: unrelatedTeacherEmail,
      passwordHash: 'dummyhash',
      name: 'Unrelated Teacher 7B',
      role: Role.TEACHER,
      isActive: true,
      mustChangePassword: false,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: 'dummyhash',
      name: 'Student 7B',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: `MAT7B-${timestamp}`,
        },
      },
    },
  });

  const unrelatedStudentUser = await prisma.user.create({
    data: {
      email: unrelatedStudentEmail,
      passwordHash: 'dummyhash',
      name: 'Unrelated Student 7B',
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: false,
      studentProfile: {
        create: {
          studentNumber: `MAT7B-UN-${timestamp}`,
        },
      },
    },
  });

  try {
    // 1. Setup Materia, Cursos A y B
    const subject = await SubjectService.createSubject({
      code: `SUB-7B-${timestamp}`,
      name: 'Materia 7B Rich Content',
      description: 'Materia para pruebas de contenido y progreso',
    });

    const courseA = await CourseService.createCourse(
      {
        subjectId: subject.id,
        name: 'Curso A 7B',
        description: 'Curso A de contenido',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
      },
      { id: adminUser.id, role: Role.ADMIN }
    );

    const courseB = await CourseService.createCourse(
      {
        subjectId: subject.id,
        name: 'Curso B 7B',
        description: 'Curso B ajeno',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
      },
      { id: adminUser.id, role: Role.ADMIN }
    );

    await CourseService.assignTeacher(courseA.id, teacherUser.id);
    await UserProvisioningService.enrollStudent({
      courseId: courseA.id,
      name: studentUser.name,
      studentNumber: `MAT7B-${timestamp}`,
      email: studentUser.email,
      executorUser: { id: adminUser.id, role: Role.ADMIN },
    });

    console.log('✓ Setup inicial completado (Usuarios, Materia, Cursos)');

    // 2. Crear Módulos: Mod 1 (Published), Mod 2 (Draft) en Course A
    const mod1Published = await ContentService.createModule(
      courseA.id,
      { title: 'Módulo 1 Publicado', isPublished: true },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const mod2Draft = await ContentService.createModule(
      courseA.id,
      { title: 'Módulo 2 Borrador', isPublished: false },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    // Crear Lecciones en Mod 1: Les 1.1 (Published), Les 1.2 (Published), Les 1.3 (Published), Les 1.4 (Draft)
    const les1_1 = await ContentService.createLesson(
      courseA.id,
      mod1Published.id,
      {
        title: 'Lección 1.1 — Ecuaciones',
        content: '# Ecuaciones\n$$\n2x + 4 = 10\n$$',
        isPublished: true,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const les1_2 = await ContentService.createLesson(
      courseA.id,
      mod1Published.id,
      {
        title: 'Lección 1.2 — Áreas',
        content: '# Áreas\n$A = \\pi r^2$',
        isPublished: true,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const les1_3 = await ContentService.createLesson(
      courseA.id,
      mod1Published.id,
      {
        title: 'Lección 1.3 — Geometría',
        content: '# Geometría\n$a^2 + b^2 = c^2$',
        isPublished: true,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const les1_4Draft = await ContentService.createLesson(
      courseA.id,
      mod1Published.id,
      {
        title: 'Lección 1.4 — Borrador',
        content: '# Oculto',
        isPublished: false,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    // Crear Lección en Mod 2 Draft (aunque esté published la lección, el módulo borrador domina)
    const les2_1InDraftMod = await ContentService.createLesson(
      courseA.id,
      mod2Draft.id,
      {
        title: 'Lección 2.1 — Módulo Oculto',
        content: '# Oculto por Módulo',
        isPublished: true,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    console.log('✓ Módulos y Lecciones de prueba creados con combinaciones de isPublished');

    // 3. Verificación de Publication Enforcement para STUDENT
    const studentContent = await ContentService.getCourseContent(courseA.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });

    if (studentContent.modules.length !== 1 || studentContent.modules[0].id !== mod1Published.id) {
      throw new Error('STUDENT recibió módulos no publicados o incorrectos');
    }

    const visibleLessons = studentContent.modules[0].lessons || [];
    if (visibleLessons.length !== 3 || visibleLessons.some((l) => !l.isPublished)) {
      throw new Error('STUDENT recibió lecciones en borrador en el listado');
    }
    console.log('✓ STUDENT solo recibe Módulos y Lecciones donde isPublished = true');

    // 4. Verificación de Acceso por URL directa a contenido Borrador (404 NOT_FOUND)
    try {
      await ContentService.getLessonDetail(courseA.id, mod1Published.id, les1_4Draft.id, {
        id: studentUser.id,
        role: Role.STUDENT,
      });
      throw new Error('Debió fallar el acceso directo de STUDENT a lección en borrador');
    } catch (err: any) {
      if (err.code !== 'LESSON_NOT_FOUND' || err.statusCode !== 404) {
        throw new Error(`Código de error inesperado en bypass de lección borrador: ${err.code}`);
      }
    }

    try {
      await ContentService.getLessonDetail(courseA.id, mod2Draft.id, les2_1InDraftMod.id, {
        id: studentUser.id,
        role: Role.STUDENT,
      });
      throw new Error('Debió fallar el acceso directo de STUDENT a lección dentro de módulo borrador');
    } catch (err: any) {
      if (err.code !== 'LESSON_NOT_FOUND' || err.statusCode !== 404) {
        throw new Error(`Código de error inesperado en bypass de módulo borrador: ${err.code}`);
      }
    }
    console.log('✓ Intento de URL directa a borrador por STUDENT rechazado con 404 LESSON_NOT_FOUND');

    // 5. Verificación de Acceso del TEACHER a borradores y TEACHER no asignado (403)
    const teacherContent = await ContentService.getCourseContent(courseA.id, {
      id: teacherUser.id,
      role: Role.TEACHER,
    });
    if (teacherContent.modules.length !== 2) {
      throw new Error('TEACHER asignado debió recibir todos los módulos (publicados y borradores)');
    }

    try {
      await ContentService.getCourseContent(courseA.id, {
        id: unrelatedTeacherUser.id,
        role: Role.TEACHER,
      });
      throw new Error('Debió fallar el acceso a contenido para un TEACHER no asignado');
    } catch (err: any) {
      if (err.statusCode !== 403) {
        throw new Error(`Código de respuesta inesperado para TEACHER no asignado: ${err.statusCode}`);
      }
    }
    console.log('✓ TEACHER asignado consulta borradores y TEACHER no asignado rechazado con 403');

    // 6. Prueba de Progreso Académico (LessonProgress & Percentages)
    // Inicialmente: 3 lecciones publicadas, 0 completadas -> 0%
    if (studentContent.progress?.completedLessons !== 0 || studentContent.progress?.totalLessons !== 3 || studentContent.progress?.percentage !== 0) {
      throw new Error(`Progreso inicial incorrecto: ${JSON.stringify(studentContent.progress)}`);
    }

    // STUDENT completa Lección 1.1
    await ContentService.toggleLessonProgress(courseA.id, mod1Published.id, les1_1.id, true, {
      id: studentUser.id,
      role: Role.STUDENT,
    });

    const progress1 = await ContentService.getCourseContent(courseA.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });

    if (progress1.progress?.completedLessons !== 1 || progress1.progress?.percentage !== 33.33) {
      throw new Error(`Progreso tras completar 1 lección incorrecto: ${JSON.stringify(progress1.progress)}`);
    }
    console.log('✓ Marcado de lección completada e incremento de porcentaje verificado (1/3 = 33.33%)');

    // 7. Prueba de Concurrencia de Progreso (Simultánea)
    await Promise.all([
      ContentService.toggleLessonProgress(courseA.id, mod1Published.id, les1_1.id, true, {
        id: studentUser.id,
        role: Role.STUDENT,
      }),
      ContentService.toggleLessonProgress(courseA.id, mod1Published.id, les1_1.id, true, {
        id: studentUser.id,
        role: Role.STUDENT,
      }),
    ]);

    const progressCountInDb = await prisma.lessonProgress.count({
      where: {
        lessonId: les1_1.id,
      },
    });

    if (progressCountInDb !== 1) {
      throw new Error(`La concurrencia generó duplicados en LessonProgress: count = ${progressCountInDb}`);
    }
    console.log('✓ Manejo atómico de concurrencia en LessonProgress verificado (exactamente 1 registro)');

    // 8. Despublicar lección completada y verificar preservación de historial
    await ContentService.updateLesson(
      courseA.id,
      mod1Published.id,
      les1_1.id,
      { isPublished: false },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const progressAfterUnpublish = await ContentService.getCourseContent(courseA.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });

    // Ahora hay 2 lecciones publicadas visibles, y 0 completadas visibles
    if (progressAfterUnpublish.progress?.totalLessons !== 2 || progressAfterUnpublish.progress?.completedLessons !== 0) {
      throw new Error(`Progreso no ajustó lección despublicada: ${JSON.stringify(progressAfterUnpublish.progress)}`);
    }

    const progressRecordInDb = await prisma.lessonProgress.findFirst({
      where: { lessonId: les1_1.id },
    });
    if (!progressRecordInDb) {
      throw new Error('El registro histórico de LessonProgress NO debe eliminarse al pasar a borrador');
    }

    // Republicar lección y verificar restauración del progreso histórico
    await ContentService.updateLesson(
      courseA.id,
      mod1Published.id,
      les1_1.id,
      { isPublished: true },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const progressAfterRepublish = await ContentService.getCourseContent(courseA.id, {
      id: studentUser.id,
      role: Role.STUDENT,
    });

    if (progressAfterRepublish.progress?.totalLessons !== 3 || progressAfterRepublish.progress?.completedLessons !== 1) {
      throw new Error(`Progreso no restauró lección republicada: ${JSON.stringify(progressAfterRepublish.progress)}`);
    }
    console.log('✓ Preservación e inclusión de historial al despublicar/republicar lecciones verificada');

    // 9. IDOR en Progreso (intentar completar lección de Course B usando alumno en Course A)
    const lesCourseB = await ContentService.createModule(
      courseB.id,
      { title: 'Mod Course B', isPublished: true },
      { id: adminUser.id, role: Role.ADMIN }
    );
    const lesB_1 = await ContentService.createLesson(
      courseB.id,
      lesCourseB.id,
      { title: 'Les B.1', isPublished: true },
      { id: adminUser.id, role: Role.ADMIN }
    );

    try {
      await ContentService.toggleLessonProgress(courseA.id, lesCourseB.id, lesB_1.id, true, {
        id: studentUser.id,
        role: Role.STUDENT,
      });
      throw new Error('Debió fallar el marcado de lección perteneciente a otro curso');
    } catch (err: any) {
      if (err.code !== 'MODULE_NOT_FOUND' && err.statusCode !== 404) {
        throw new Error(`Código de error inesperado en IDOR de progreso: ${err.code}`);
      }
    }
    console.log('✓ Protección IDOR en marcado de progreso de lecciones ajenas verificada');

    // 10. Prueba de Contenido Markdown con Math y XSS
    const xssPayload = '<script>window.__potrolearnXss = true</script>\n<img src=x onerror="window.__potrolearnXss = true">';
    const xssLesson = await ContentService.createLesson(
      courseA.id,
      mod1Published.id,
      {
        title: 'Lección XSS Test',
        content: xssPayload,
        isPublished: true,
      },
      { id: teacherUser.id, role: Role.TEACHER }
    );

    const retrievedXssLesson = await ContentService.getLessonDetail(courseA.id, mod1Published.id, xssLesson.id, {
      id: teacherUser.id,
      role: Role.TEACHER,
    });
    if (retrievedXssLesson.content !== xssPayload) {
      throw new Error('El contenido se alteró inesperadamente en la base de datos');
    }
    console.log('✓ Almacenamiento seguro de Markdown e inmunidad XSS verificado');

    console.log('--- TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 7B PASARON CON ÉXITO ---');
  } finally {
    // Cleanup
    const courses = await prisma.course.findMany({ where: { name: { contains: '7B' } }, select: { id: true } });
    const courseIds = courses.map((c) => c.id);

    const modules = await prisma.module.findMany({ where: { courseId: { in: courseIds } }, select: { id: true } });
    const moduleIds = modules.map((m) => m.id);

    const lessons = await prisma.lesson.findMany({ where: { moduleId: { in: moduleIds } }, select: { id: true } });
    const lessonIds = lessons.map((l) => l.id);

    await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
    await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
    await prisma.module.deleteMany({ where: { id: { in: moduleIds } } });
    await prisma.courseTeacher.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.subject.deleteMany({ where: { name: { contains: '7B' } } });
    await prisma.studentProfile.deleteMany({ where: { userId: { in: [studentUser.id, unrelatedStudentUser.id] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, teacherUser.id, unrelatedTeacherUser.id, studentUser.id, unrelatedStudentUser.id] } },
    });
  }
}

runPhase7bIntegrationTests()
  .catch((err) => {
    console.error('❌ Error en pruebas de integración Fase 7B:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
