import { Role, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotificationService } from './notification.service';
import { AuthError } from '../types/auth.types';
import {
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  ModuleDTO,
  LessonDTO,
  CourseContentDTO,
  ScheduleModuleBatchInput,
  ScheduleModuleBatchResultDTO,
  PublishModuleNowInput,
  PublishModuleNowResultDTO,
  ScheduleModuleBatchContentResultDTO,
} from '../types/content.types';

export class ContentService {
  /**
   * Helper privado para verificar existencia del curso y permisos de acceso del usuario según su rol.
   */
  private static async validateCourseAccess(
    courseId: string,
    user: { id: string; role: Role }
  ) {
    if (!courseId || typeof courseId !== 'string') {
      throw new AuthError('Identificador de curso inválido', 400, 'BAD_REQUEST');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (user.role === Role.ADMIN) {
      return course;
    }

    if (user.role === Role.TEACHER) {
      const isAssigned = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId,
            teacherId: user.id,
          },
        },
      });

      if (!isAssigned) {
        throw new AuthError('Acceso denegado: no estás asignado como profesor de este curso', 403, 'FORBIDDEN');
      }
      return course;
    }

    if (user.role === Role.STUDENT) {
      const isEnrolled = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: user.id,
          },
        },
      });

      if (!isEnrolled || isEnrolled.status !== EnrollmentStatus.ACTIVE) {
        throw new AuthError('Acceso denegado: no estás inscrito activamente en este curso', 403, 'FORBIDDEN');
      }
      return course;
    }

    throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
  }

  /**
   * Helper privado para validar que el curso permita modificaciones de contenido (no FINISHED ni ARCHIVED)
   * y que el usuario no sea STUDENT.
   */
  private static validateCourseEditable(
    course: { status: CourseStatus },
    user: { role: Role }
  ) {
    if (user.role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los alumnos no pueden modificar contenido', 403, 'FORBIDDEN');
    }

    if (course.status === CourseStatus.FINISHED || course.status === CourseStatus.ARCHIVED) {
      throw new AuthError(
        `Este curso se encuentra en estado ${course.status} y su contenido está en modo lectura únicamente.`,
        400,
        'COURSE_CONTENT_READ_ONLY'
      );
    }
  }

  /**
   * Obtiene la estructura completa del contenido del curso (Módulos y Lecciones ordenados).
   * Para STUDENT, aplica filtrado estricto de isPublished = true y calcula el progreso del curso.
   */
  public static async getCourseContent(
    courseId: string,
    user: { id: string; role: Role }
  ): Promise<CourseContentDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    const isStudent = user.role === Role.STUDENT;

    const modules = await prisma.module.findMany({
      where: {
        courseId,
        ...(isStudent ? { isPublished: true } : {}),
      },
      include: {
        lessons: {
          where: isStudent ? { isPublished: true } : {},
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    let progressData: { completedLessons: number; totalLessons: number; percentage: number } | undefined = undefined;
    const completedLessonIdsSet = new Set<string>();

    if (isStudent) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: user.id,
          },
        },
      });

      if (enrollment) {
        const completedProgress = await prisma.lessonProgress.findMany({
          where: {
            enrollmentId: enrollment.id,
            lesson: {
              isPublished: true,
              module: {
                isPublished: true,
                courseId,
              },
            },
          },
          select: { lessonId: true },
        });

        completedProgress.forEach((p) => completedLessonIdsSet.add(p.lessonId));

        let totalPublishedLessons = 0;
        modules.forEach((m) => {
          totalPublishedLessons += m.lessons.length;
        });

        const completedCount = completedLessonIdsSet.size;
        const pct = totalPublishedLessons === 0 ? 0 : Math.round((completedCount / totalPublishedLessons) * 100 * 100) / 100;

        progressData = {
          completedLessons: completedCount,
          totalLessons: totalPublishedLessons,
          percentage: pct,
        };
      }
    }

    return {
      courseId: course.id,
      courseName: course.name,
      status: course.status,
      modules: modules.map((m) => ({
        id: m.id,
        courseId: m.courseId,
        title: m.title,
        description: m.description,
        order: m.order,
        isPublished: m.isPublished,
        scheduledPublishAt: m.scheduledPublishAt,
        publishedAt: m.publishedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          moduleId: l.moduleId,
          title: l.title,
          description: l.description,
          content: l.content,
          order: l.order,
          isPublished: l.isPublished,
          scheduledPublishAt: l.scheduledPublishAt,
          publishedAt: l.publishedAt,
          completed: isStudent ? completedLessonIdsSet.has(l.id) : undefined,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
      })),
      progress: progressData,
    };
  }

  /**
   * Obtiene la lista de módulos de un curso ordenados por posición.
   */
  public static async getCourseModules(
    courseId: string,
    user: { id: string; role: Role }
  ): Promise<ModuleDTO[]> {
    await ContentService.validateCourseAccess(courseId, user);

    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });

    return modules.map((m) => ({
      id: m.id,
      courseId: m.courseId,
      title: m.title,
      description: m.description,
      order: m.order,
      isPublished: m.isPublished,
      scheduledPublishAt: m.scheduledPublishAt,
      publishedAt: m.publishedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  /**
   * Crea un nuevo módulo en el curso calculando posición order = max(order) + 1.
   */
  public static async createModule(
    courseId: string,
    input: CreateModuleInput,
    user: { id: string; role: Role }
  ): Promise<ModuleDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const title = input.title?.trim();
    if (!title) {
      throw new AuthError('El título del módulo es requerido', 400, 'BAD_REQUEST');
    }

    let scheduledPublishAt: Date | null = null;
    let isPublished = input.isPublished ?? true;
    let publishedAt: Date | null = isPublished ? new Date() : null;

    if (input.scheduledPublishAt) {
      const parsedDate = new Date(input.scheduledPublishAt);
      if (isNaN(parsedDate.getTime())) {
        throw new AuthError('La fecha de publicación programada es inválida', 400, 'BAD_REQUEST');
      }
      if (parsedDate.getTime() <= Date.now()) {
        throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
      }
      scheduledPublishAt = parsedDate;
      isPublished = false;
      publishedAt = null;
    } else if (input.scheduledPublishAt === null) {
      scheduledPublishAt = null;
    }

    const maxModule = await prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxModule?.order ?? 0) + 1;

    const newModule = await prisma.module.create({
      data: {
        courseId,
        title,
        description: input.description?.trim() || null,
        order: nextOrder,
        isPublished,
        scheduledPublishAt,
        publishedAt,
      },
    });

    if (newModule.isPublished) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'MODULE_PUBLISHED',
        'Nuevo módulo disponible',
        `El módulo "${newModule.title}" ya está disponible en ${course.name}.`,
        `/app/courses/${courseId}`
      );
    }

    return {
      id: newModule.id,
      courseId: newModule.courseId,
      title: newModule.title,
      description: newModule.description,
      order: newModule.order,
      isPublished: newModule.isPublished,
      scheduledPublishAt: newModule.scheduledPublishAt,
      publishedAt: newModule.publishedAt,
      createdAt: newModule.createdAt,
      updatedAt: newModule.updatedAt,
    };
  }

  /**
   * Actualiza los datos de un módulo existente.
   */
  public static async updateModule(
    courseId: string,
    moduleId: string,
    input: UpdateModuleInput,
    user: { id: string; role: Role }
  ): Promise<ModuleDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const existingModule = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!existingModule || existingModule.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    const updateData: {
      title?: string;
      description?: string | null;
      isPublished?: boolean;
      scheduledPublishAt?: Date | null;
      publishedAt?: Date | null;
    } = {};

    if (input.title !== undefined) {
      const trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        throw new AuthError('El título del módulo no puede estar vacío', 400, 'BAD_REQUEST');
      }
      updateData.title = trimmedTitle;
    }

    if (input.description !== undefined) {
      updateData.description = input.description ? input.description.trim() : null;
    }

    if (input.scheduledPublishAt !== undefined) {
      if (input.scheduledPublishAt === null) {
        updateData.scheduledPublishAt = null;
        if (input.isPublished !== undefined) {
          updateData.isPublished = input.isPublished;
          if (input.isPublished && !existingModule.publishedAt) {
            updateData.publishedAt = new Date();
          }
        }
      } else {
        const parsedDate = new Date(input.scheduledPublishAt);
        if (isNaN(parsedDate.getTime())) {
          throw new AuthError('La fecha de publicación programada es inválida', 400, 'BAD_REQUEST');
        }
        if (parsedDate.getTime() <= Date.now()) {
          throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
        }
        updateData.scheduledPublishAt = parsedDate;
        updateData.isPublished = false;
        updateData.publishedAt = null;
      }
    } else if (input.isPublished !== undefined) {
      updateData.isPublished = input.isPublished;
      if (input.isPublished) {
        updateData.scheduledPublishAt = null;
        if (!existingModule.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }
    }

    const updatedModule = await prisma.module.update({
      where: { id: moduleId },
      data: updateData,
    });

    if (updatedModule.isPublished && !existingModule.isPublished) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'MODULE_PUBLISHED',
        'Nuevo módulo disponible',
        `El módulo "${updatedModule.title}" ya está disponible en ${course.name}.`,
        `/app/courses/${courseId}`
      );
    }

    return {
      id: updatedModule.id,
      courseId: updatedModule.courseId,
      title: updatedModule.title,
      description: updatedModule.description,
      order: updatedModule.order,
      isPublished: updatedModule.isPublished,
      scheduledPublishAt: updatedModule.scheduledPublishAt,
      publishedAt: updatedModule.publishedAt,
      createdAt: updatedModule.createdAt,
      updatedAt: updatedModule.updatedAt,
    };
  }

  /**
   * Reordena de forma atómica los módulos de un curso asignando order = 1..N.
   */
  public static async reorderModules(
    courseId: string,
    moduleIds: string[],
    user: { id: string; role: Role }
  ): Promise<ModuleDTO[]> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      throw new AuthError('Lista de identificadores de módulos inválida', 400, 'BAD_REQUEST');
    }

    // Verificar duplicados en el array de entrada
    const uniqueIds = new Set(moduleIds);
    if (uniqueIds.size !== moduleIds.length) {
      throw new AuthError('No se permiten identificadores de módulos duplicados', 400, 'INVALID_MODULE_ORDER');
    }

    const currentModules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true },
    });

    const currentModuleIdsSet = new Set(currentModules.map((m) => m.id));

    if (currentModules.length !== moduleIds.length) {
      throw new AuthError('La lista debe contener la totalidad de módulos del curso', 400, 'INVALID_MODULE_ORDER');
    }

    for (const id of moduleIds) {
      if (!currentModuleIdsSet.has(id)) {
        throw new AuthError(`El módulo ${id} no pertenece a este curso`, 400, 'MODULE_COURSE_MISMATCH');
      }
    }

    // Transacción atómica
    await prisma.$transaction(
      moduleIds.map((id, index) =>
        prisma.module.update({
          where: { id },
          data: { order: index + 1 },
        })
      )
    );

    return ContentService.getCourseModules(courseId, user);
  }

  /**
   * Obtiene las lecciones de un módulo ordenadas por posición.
   */
  public static async getModuleLessons(
    courseId: string,
    moduleId: string,
    user: { id: string; role: Role }
  ): Promise<LessonDTO[]> {
    await ContentService.validateCourseAccess(courseId, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    const lessons = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });

    return lessons.map((l) => ({
      id: l.id,
      moduleId: l.moduleId,
      title: l.title,
      description: l.description,
      content: l.content,
      order: l.order,
      isPublished: l.isPublished,
      scheduledPublishAt: l.scheduledPublishAt,
      publishedAt: l.publishedAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }

  private static async notifyEnrolledStudents(
    courseId: string,
    type: string,
    title: string,
    message: string,
    link: string
  ) {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: EnrollmentStatus.ACTIVE },
        select: { studentId: true },
      });
      for (const env of enrollments) {
        await NotificationService.createNotification({
          userId: env.studentId,
          type,
          title,
          message,
          link,
        });
      }
    } catch (err) {
      console.error(`[NOTIFICATION ERROR] Failed to dispatch ${type}:`, err);
    }
  }

  /**
   * Crea una lección en un módulo calculando posición order = max(order) + 1.
   */
  public static async createLesson(
    courseId: string,
    moduleId: string,
    input: CreateLessonInput,
    user: { id: string; role: Role }
  ): Promise<LessonDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    const title = input.title?.trim();
    if (!title) {
      throw new AuthError('El título de la lección es requerido', 400, 'BAD_REQUEST');
    }

    let scheduledPublishAt: Date | null = null;
    let isPublished = input.isPublished ?? true;
    let publishedAt: Date | null = isPublished ? new Date() : null;

    if (input.scheduledPublishAt) {
      const parsedDate = new Date(input.scheduledPublishAt);
      if (isNaN(parsedDate.getTime())) {
        throw new AuthError('La fecha de publicación programada es inválida', 400, 'BAD_REQUEST');
      }
      if (parsedDate.getTime() <= Date.now()) {
        throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
      }
      scheduledPublishAt = parsedDate;
      isPublished = false;
      publishedAt = null;
    } else if (input.scheduledPublishAt === null) {
      scheduledPublishAt = null;
    }

    const maxLesson = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxLesson?.order ?? 0) + 1;

    const newLesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        description: input.description?.trim() || null,
        content: input.content?.trim() || null,
        order: nextOrder,
        isPublished,
        scheduledPublishAt,
        publishedAt,
      },
    });

    if (newLesson.isPublished) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'LESSON_PUBLISHED',
        'Nueva lección disponible',
        `Se publicó la lección "${newLesson.title}" en ${course.name}.`,
        `/app/courses/${courseId}/modules/${moduleId}/lessons/${newLesson.id}`
      );
    }

    return {
      id: newLesson.id,
      moduleId: newLesson.moduleId,
      title: newLesson.title,
      description: newLesson.description,
      content: newLesson.content,
      order: newLesson.order,
      isPublished: newLesson.isPublished,
      scheduledPublishAt: newLesson.scheduledPublishAt,
      publishedAt: newLesson.publishedAt,
      createdAt: newLesson.createdAt,
      updatedAt: newLesson.updatedAt,
    };
  }

  /**
   * Actualiza los datos de una lección validando jerarquía completa.
   */
  public static async updateLesson(
    courseId: string,
    moduleId: string,
    lessonId: string,
    input: UpdateLessonInput,
    user: { id: string; role: Role }
  ): Promise<LessonDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    const lessonObj = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lessonObj || lessonObj.moduleId !== moduleId) {
      throw new AuthError('Lección no encontrada en este módulo', 404, 'LESSON_MODULE_MISMATCH');
    }

    const updateData: {
      title?: string;
      description?: string | null;
      content?: string | null;
      isPublished?: boolean;
      scheduledPublishAt?: Date | null;
      publishedAt?: Date | null;
    } = {};

    if (input.title !== undefined) {
      const trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        throw new AuthError('El título de la lección no puede estar vacío', 400, 'BAD_REQUEST');
      }
      updateData.title = trimmedTitle;
    }

    if (input.description !== undefined) {
      updateData.description = input.description ? input.description.trim() : null;
    }

    if (input.content !== undefined) {
      updateData.content = input.content ? input.content.trim() : null;
    }

    if (input.scheduledPublishAt !== undefined) {
      if (input.scheduledPublishAt === null) {
        updateData.scheduledPublishAt = null;
        if (input.isPublished !== undefined) {
          updateData.isPublished = input.isPublished;
          if (input.isPublished && !lessonObj.publishedAt) {
            updateData.publishedAt = new Date();
          }
        }
      } else {
        const parsedDate = new Date(input.scheduledPublishAt);
        if (isNaN(parsedDate.getTime())) {
          throw new AuthError('La fecha de publicación programada es inválida', 400, 'BAD_REQUEST');
        }
        if (parsedDate.getTime() <= Date.now()) {
          throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
        }
        updateData.scheduledPublishAt = parsedDate;
        updateData.isPublished = false;
        updateData.publishedAt = null;
      }
    } else if (input.isPublished !== undefined) {
      updateData.isPublished = input.isPublished;
      if (input.isPublished) {
        updateData.scheduledPublishAt = null;
        if (!lessonObj.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    if (updatedLesson.isPublished && !lessonObj.isPublished) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'LESSON_PUBLISHED',
        'Nueva lección disponible',
        `Se publicó la lección "${updatedLesson.title}" en ${course.name}.`,
        `/app/courses/${courseId}/modules/${moduleId}/lessons/${updatedLesson.id}`
      );
    }

    return {
      id: updatedLesson.id,
      moduleId: updatedLesson.moduleId,
      title: updatedLesson.title,
      description: updatedLesson.description,
      content: updatedLesson.content,
      order: updatedLesson.order,
      isPublished: updatedLesson.isPublished,
      scheduledPublishAt: updatedLesson.scheduledPublishAt,
      publishedAt: updatedLesson.publishedAt,
      createdAt: updatedLesson.createdAt,
      updatedAt: updatedLesson.updatedAt,
    };
  }

  /**
   * Reordena de forma atómica las lecciones de un módulo asignando order = 1..N.
   */
  public static async reorderLessons(
    courseId: string,
    moduleId: string,
    lessonIds: string[],
    user: { id: string; role: Role }
  ): Promise<LessonDTO[]> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      throw new AuthError('Lista de identificadores de lecciones inválida', 400, 'BAD_REQUEST');
    }

    const uniqueIds = new Set(lessonIds);
    if (uniqueIds.size !== lessonIds.length) {
      throw new AuthError('No se permiten identificadores de lecciones duplicados', 400, 'INVALID_LESSON_ORDER');
    }

    const currentLessons = await prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });

    const currentLessonIdsSet = new Set(currentLessons.map((l) => l.id));

    if (currentLessons.length !== lessonIds.length) {
      throw new AuthError('La lista debe contener la totalidad de lecciones del módulo', 400, 'INVALID_LESSON_ORDER');
    }

    for (const id of lessonIds) {
      if (!currentLessonIdsSet.has(id)) {
        throw new AuthError(`La lección ${id} no pertenece a este módulo`, 400, 'LESSON_MODULE_MISMATCH');
      }
    }

    // Transacción atómica
    await prisma.$transaction(
      lessonIds.map((id, index) =>
        prisma.lesson.update({
          where: { id },
          data: { order: index + 1 },
        })
      )
    );

    return ContentService.getModuleLessons(courseId, moduleId, user);
  }

  /**
   * Obtiene el detalle de una lección validando la jerarquía completa.
   * Para STUDENT, valida publication enforcement de módulo y lección.
   */
  public static async getLessonDetail(
    courseId: string,
    moduleId: string,
    lessonId: string,
    user: { id: string; role: Role }
  ): Promise<LessonDTO & { moduleTitle?: string; courseName?: string; completed?: boolean }> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    const isStudent = user.role === Role.STUDENT;

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    if (isStudent && !moduleObj.isPublished) {
      throw new AuthError('Lección no encontrada', 404, 'LESSON_NOT_FOUND');
    }

    const lessonObj = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lessonObj || lessonObj.moduleId !== moduleId) {
      throw new AuthError('Lección no encontrada en este módulo', 404, 'LESSON_MODULE_MISMATCH');
    }

    if (isStudent && !lessonObj.isPublished) {
      throw new AuthError('Lección no encontrada', 404, 'LESSON_NOT_FOUND');
    }

    let completed = false;
    if (isStudent) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: user.id,
          },
        },
      });

      if (enrollment) {
        const progress = await prisma.lessonProgress.findUnique({
          where: {
            enrollmentId_lessonId: {
              enrollmentId: enrollment.id,
              lessonId,
            },
          },
        });
        completed = !!progress;
      }
    }

    return {
      id: lessonObj.id,
      moduleId: lessonObj.moduleId,
      title: lessonObj.title,
      description: lessonObj.description,
      content: lessonObj.content,
      order: lessonObj.order,
      isPublished: lessonObj.isPublished,
      completed: isStudent ? completed : undefined,
      createdAt: lessonObj.createdAt,
      updatedAt: lessonObj.updatedAt,
      moduleTitle: moduleObj.title,
      courseName: course.name,
    };
  }

  /**
   * Marca o desmarca como completada una lección para el alumno autenticado (LessonProgress).
   */
  public static async toggleLessonProgress(
    courseId: string,
    moduleId: string,
    lessonId: string,
    completed: boolean,
    user: { id: string; role: Role }
  ): Promise<{ completed: boolean }> {
    if (user.role !== Role.STUDENT) {
      throw new AuthError('Acceso denegado: solo los alumnos pueden modificar su progreso', 403, 'FORBIDDEN');
    }

    await ContentService.validateCourseAccess(courseId, user);

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId: user.id,
        },
      },
    });

    if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new AuthError('Acceso denegado: no estás inscrito activamente en este curso', 403, 'FORBIDDEN');
    }

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    if (!moduleObj.isPublished) {
      throw new AuthError('No es posible completar lecciones de un módulo borrador', 400, 'CANNOT_COMPLETE_UNPUBLISHED_LESSON');
    }

    const lessonObj = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lessonObj || lessonObj.moduleId !== moduleId) {
      throw new AuthError('Lección no encontrada en este módulo', 404, 'LESSON_MODULE_MISMATCH');
    }

    if (!lessonObj.isPublished) {
      throw new AuthError('No es posible completar lecciones en borrador', 400, 'CANNOT_COMPLETE_UNPUBLISHED_LESSON');
    }

    if (completed) {
      await prisma.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: enrollment.id,
            lessonId,
          },
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          completedAt: new Date(),
        },
        update: {
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.lessonProgress.deleteMany({
        where: {
          enrollmentId: enrollment.id,
          lessonId,
        },
      });
    }

    return { completed };
  }

  /**
   * Configura de forma atómica la programación del módulo y de su contenido pedagógico selectivo.
   */
  public static async scheduleModuleBatch(
    courseId: string,
    moduleId: string,
    input: ScheduleModuleBatchInput,
    user: { id: string; role: Role }
  ): Promise<ScheduleModuleBatchResultDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    // Validar fecha del módulo si se proporciona
    let moduleScheduledPublishAt: Date | null | undefined = undefined;
    if (input.moduleScheduledPublishAt !== undefined) {
      if (input.moduleScheduledPublishAt === null) {
        moduleScheduledPublishAt = null;
      } else {
        const parsedDate = new Date(input.moduleScheduledPublishAt);
        if (isNaN(parsedDate.getTime())) {
          throw new AuthError('La fecha de publicación del módulo es inválida', 400, 'BAD_REQUEST');
        }
        if (parsedDate.getTime() <= Date.now()) {
          throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
        }
        moduleScheduledPublishAt = parsedDate;
      }
    }

    // Validar contents si se proporcionan
    const contentsInput = input.contents || [];
    const seenIds = new Set<string>();

    for (const item of contentsInput) {
      if (!item.id || typeof item.id !== 'string') {
        throw new AuthError('Identificador de contenido inválido', 400, 'BAD_REQUEST');
      }
      if (seenIds.has(item.id)) {
        throw new AuthError('No se permiten IDs de contenido duplicados en la misma solicitud', 400, 'DUPLICATE_CONTENT_IDS');
      }
      seenIds.add(item.id);

      if (item.type !== 'LESSON' && item.type !== 'ASSESSMENT') {
        throw new AuthError('Tipo de contenido no soportado para programación', 400, 'BAD_REQUEST');
      }

      if (item.action === 'SCHEDULE' || (item.scheduledPublishAt !== undefined && item.scheduledPublishAt !== null)) {
        if (!item.scheduledPublishAt) {
          throw new AuthError('Se requiere una fecha de publicación para programar el contenido', 400, 'BAD_REQUEST');
        }
        const parsedDate = new Date(item.scheduledPublishAt);
        if (isNaN(parsedDate.getTime())) {
          throw new AuthError('Fecha de publicación de contenido inválida', 400, 'BAD_REQUEST');
        }
        if (parsedDate.getTime() <= Date.now()) {
          throw new AuthError('La fecha de publicación programada debe ser en el futuro', 400, 'SCHEDULED_DATE_MUST_BE_FUTURE');
        }
      }

      if (item.type === 'LESSON') {
        const lesson = await prisma.lesson.findUnique({
          where: { id: item.id },
        });
        if (!lesson) {
          throw new AuthError(`Lección ${item.id} no encontrada`, 404, 'LESSON_NOT_FOUND');
        }
        if (lesson.moduleId !== moduleId) {
          throw new AuthError('La lección no pertenece al módulo especificado', 400, 'LESSON_MODULE_MISMATCH');
        }
      } else if (item.type === 'ASSESSMENT') {
        const assessment = await prisma.assessment.findUnique({
          where: { id: item.id },
        });
        if (!assessment) {
          throw new AuthError(`Evaluación ${item.id} no encontrada`, 404, 'ASSESSMENT_NOT_FOUND');
        }
        if (assessment.courseId !== courseId) {
          throw new AuthError('La evaluación no pertenece a este curso', 400, 'ASSESSMENT_COURSE_MISMATCH');
        }
        if (assessment.moduleId !== moduleId) {
          throw new AuthError('La evaluación no pertenece a este módulo', 400, 'ASSESSMENT_MODULE_MISMATCH');
        }
      }
    }

    // Ejecutar actualización atómica en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Módulo
      if (moduleScheduledPublishAt !== undefined) {
        if (moduleScheduledPublishAt === null) {
          await tx.module.update({
            where: { id: moduleId },
            data: {
              scheduledPublishAt: null,
            },
          });
        } else {
          await tx.module.update({
            where: { id: moduleId },
            data: {
              scheduledPublishAt: moduleScheduledPublishAt,
              isPublished: false,
              publishedAt: null,
            },
          });
        }
      }

      // 2. Contenidos selectivos
      for (const item of contentsInput) {
        const isUnschedule = item.action === 'UNSCHEDULE' || item.scheduledPublishAt === null;
        if (isUnschedule) {
          if (item.type === 'LESSON') {
            await tx.lesson.update({
              where: { id: item.id },
              data: {
                scheduledPublishAt: null,
              },
            });
          } else if (item.type === 'ASSESSMENT') {
            await tx.assessment.update({
              where: { id: item.id },
              data: {
                scheduledPublishAt: null,
              },
            });
          }
        } else {
          const parsedDate = new Date(item.scheduledPublishAt!);
          if (item.type === 'LESSON') {
            await tx.lesson.update({
              where: { id: item.id },
              data: {
                scheduledPublishAt: parsedDate,
                isPublished: false,
                publishedAt: null,
              },
            });
          } else if (item.type === 'ASSESSMENT') {
            await tx.assessment.update({
              where: { id: item.id },
              data: {
                scheduledPublishAt: parsedDate,
                isPublished: false,
                publishedAt: null,
              },
            });
          }
        }
      }
    });

    // Obtener módulo y contenidos actualizados
    const updatedModule = await prisma.module.findUniqueOrThrow({
      where: { id: moduleId },
    });

    const updatedLessons = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });

    const updatedAssessments = await prisma.assessment.findMany({
      where: { moduleId },
    });

    const contentsResult: ScheduleModuleBatchContentResultDTO[] = [
      ...updatedLessons.map((l) => ({
        type: 'LESSON' as const,
        id: l.id,
        title: l.title,
        isPublished: l.isPublished,
        scheduledPublishAt: l.scheduledPublishAt,
        publishedAt: l.publishedAt,
      })),
      ...updatedAssessments.map((a) => ({
        type: 'ASSESSMENT' as const,
        id: a.id,
        title: a.title,
        isPublished: a.isPublished,
        scheduledPublishAt: a.scheduledPublishAt,
        publishedAt: a.publishedAt,
      })),
    ];

    return {
      module: {
        id: updatedModule.id,
        title: updatedModule.title,
        isPublished: updatedModule.isPublished,
        scheduledPublishAt: updatedModule.scheduledPublishAt,
        publishedAt: updatedModule.publishedAt,
      },
      contents: contentsResult,
    };
  }

  /**
   * Publica de forma inmediata el módulo y opcionalmente el contenido interno pendiente especificado.
   */
  public static async publishModuleNow(
    courseId: string,
    moduleId: string,
    input: PublishModuleNowInput,
    user: { id: string; role: Role }
  ): Promise<PublishModuleNowResultDTO> {
    const course = await ContentService.validateCourseAccess(courseId, user);
    ContentService.validateCourseEditable(course, user);

    const moduleObj = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleObj || moduleObj.courseId !== courseId) {
      throw new AuthError('Módulo no encontrado en este curso', 404, 'MODULE_NOT_FOUND');
    }

    const publishContentIds = input.publishContentIds || [];
    const publishModuleOnly = input.publishModuleOnly ?? false;

    const seenIds = new Set<string>();
    for (const id of publishContentIds) {
      if (seenIds.has(id)) {
        throw new AuthError('No se permiten IDs duplicados en la solicitud', 400, 'DUPLICATE_CONTENT_IDS');
      }
      seenIds.add(id);
    }

    // Validar pertenencia de todos los IDs solicitados
    if (!publishModuleOnly && publishContentIds.length > 0) {
      for (const id of publishContentIds) {
        const lesson = await prisma.lesson.findUnique({ where: { id } });
        if (lesson) {
          if (lesson.moduleId !== moduleId) {
            throw new AuthError('Uno o más contenidos no pertenecen a este módulo', 400, 'CONTENT_MODULE_MISMATCH');
          }
          continue;
        }

        const assessment = await prisma.assessment.findUnique({ where: { id } });
        if (assessment) {
          if (assessment.courseId !== courseId || assessment.moduleId !== moduleId) {
            throw new AuthError('Uno o más contenidos no pertenecen a este módulo', 400, 'CONTENT_MODULE_MISMATCH');
          }
          continue;
        }

        throw new AuthError(`Contenido ${id} no encontrado en este módulo`, 404, 'CONTENT_NOT_FOUND');
      }
    }

    const now = new Date();
    let moduleWasPublished = false;
    const newlyPublishedLessons: { id: string; title: string }[] = [];
    const newlyPublishedAssessments: { id: string; title: string }[] = [];

    await prisma.$transaction(async (tx) => {
      // 1. Publicar módulo
      if (!moduleObj.isPublished) {
        await tx.module.update({
          where: { id: moduleId },
          data: {
            isPublished: true,
            publishedAt: moduleObj.publishedAt || now,
            scheduledPublishAt: null,
          },
        });
        moduleWasPublished = true;
      }

      // 2. Publicar contenidos si corresponde
      if (!publishModuleOnly && publishContentIds.length > 0) {
        for (const id of publishContentIds) {
          const lesson = await tx.lesson.findUnique({ where: { id } });
          if (lesson && !lesson.isPublished) {
            await tx.lesson.update({
              where: { id },
              data: {
                isPublished: true,
                publishedAt: lesson.publishedAt || now,
                scheduledPublishAt: null,
              },
            });
            newlyPublishedLessons.push({ id: lesson.id, title: lesson.title });
          }

          const assessment = await tx.assessment.findUnique({ where: { id } });
          if (assessment && !assessment.isPublished) {
            await tx.assessment.update({
              where: { id },
              data: {
                isPublished: true,
                publishedAt: assessment.publishedAt || now,
                scheduledPublishAt: null,
              },
            });
            newlyPublishedAssessments.push({ id: assessment.id, title: assessment.title });
          }
        }
      }
    });

    // Enviar notificaciones in-app
    if (moduleWasPublished) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'MODULE_PUBLISHED',
        'Nuevo módulo disponible',
        `El módulo "${moduleObj.title}" ya está disponible en ${course.name}.`,
        `/app/courses/${courseId}`
      );
    }

    for (const l of newlyPublishedLessons) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'LESSON_PUBLISHED',
        'Nueva lección disponible',
        `Se publicó la lección "${l.title}" en ${course.name}.`,
        `/app/courses/${courseId}/modules/${moduleId}/lessons/${l.id}`
      );
    }

    for (const a of newlyPublishedAssessments) {
      await ContentService.notifyEnrolledStudents(
        courseId,
        'ASSESSMENT_PUBLISHED',
        'Nueva evaluación disponible',
        `Se ha publicado la evaluación "${a.title}" en ${course.name}.`,
        `/app/courses/${courseId}`
      );
    }

    // Obtener módulo y contenidos actualizados
    const updatedModule = await prisma.module.findUniqueOrThrow({
      where: { id: moduleId },
    });

    const updatedLessons = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });

    const updatedAssessments = await prisma.assessment.findMany({
      where: { moduleId },
    });

    const contentsResult: ScheduleModuleBatchContentResultDTO[] = [
      ...updatedLessons.map((l) => ({
        type: 'LESSON' as const,
        id: l.id,
        title: l.title,
        isPublished: l.isPublished,
        scheduledPublishAt: l.scheduledPublishAt,
        publishedAt: l.publishedAt,
      })),
      ...updatedAssessments.map((a) => ({
        type: 'ASSESSMENT' as const,
        id: a.id,
        title: a.title,
        isPublished: a.isPublished,
        scheduledPublishAt: a.scheduledPublishAt,
        publishedAt: a.publishedAt,
      })),
    ];

    const publishedContentCount = newlyPublishedLessons.length + newlyPublishedAssessments.length;

    return {
      module: {
        id: updatedModule.id,
        title: updatedModule.title,
        isPublished: updatedModule.isPublished,
        scheduledPublishAt: updatedModule.scheduledPublishAt,
        publishedAt: updatedModule.publishedAt,
      },
      publishedContentCount,
      contents: contentsResult,
    };
  }
}
