import { CourseStatus, Role, AttemptStatus, QuestionType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';
import { GradebookService } from './gradebook.service';


export interface CreateCourseInput {
  subjectId: string;
  name: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
}

export interface UpdateCourseInput {
  subjectId?: string;
  name?: string;
  description?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

export class CourseService {
  /**
   * Consulta cursos visibles según el rol del usuario autenticado.
   */
  public static async getCoursesForUser(user: { id: string; role: Role }) {
    const includeSelect = {
      subject: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      courseTeachers: {
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    };

    if (user.role === Role.ADMIN) {
      return prisma.course.findMany({
        include: includeSelect,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return prisma.course.findMany({
        where: {
          courseTeachers: {
            some: {
              teacherId: user.id,
            },
          },
        },
        include: includeSelect,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.STUDENT) {
      return prisma.course.findMany({
        where: {
          enrollments: {
            some: {
              studentId: user.id,
            },
          },
        },
        include: includeSelect,
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  /**
   * Consulta el detalle de un curso validando los permisos de acceso del usuario.
   */
  public static async getCourseDetail(courseId: string, user: { id: string; role: Role }) {
    if (!courseId || typeof courseId !== 'string') {
      throw new AuthError('Identificador de curso no válido', 400, 'INVALID_COURSE_ID');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        subject: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        courseTeachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      throw new AuthError('El curso especificado no existe', 404, 'COURSE_NOT_FOUND');
    }

    // Validación de autorización según el rol
    if (user.role === Role.ADMIN) {
      return course;
    }

    if (user.role === Role.TEACHER) {
      const isAssigned = course.courseTeachers.some((ct) => ct.teacherId === user.id);
      if (!isAssigned) {
        throw new AuthError('Acceso denegado: no estás asignado como profesor de este curso', 403, 'FORBIDDEN');
      }
      return course;
    }

    if (user.role === Role.STUDENT) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: user.id,
          },
        },
      });
      if (!enrollment) {
        throw new AuthError('Acceso denegado: no estás inscrito en este curso', 403, 'FORBIDDEN');
      }
      return course;
    }

    throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
  }

  /**
   * Crea un nuevo curso en estado DRAFT. Si el creador es TEACHER, lo asigna automáticamente.
   */
  public static async createCourse(input: CreateCourseInput, user: { id: string; role: Role }) {
    const { subjectId, name, description, startDate, endDate } = input || {};

    if (!subjectId || typeof subjectId !== 'string') {
      throw new AuthError('La materia seleccionada es requerida', 400, 'INVALID_SUBJECT_ID');
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AuthError('El nombre del curso es requerido', 400, 'INVALID_COURSE_NAME');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AuthError('Las fechas de inicio y fin deben ser fechas válidas', 400, 'INVALID_COURSE_DATES');
    }

    if (start > end) {
      throw new AuthError('La fecha de inicio no puede ser posterior a la fecha de término', 400, 'INVALID_COURSE_DATES');
    }

    // Verificar que la materia exista
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new AuthError('La materia seleccionada no existe', 404, 'SUBJECT_NOT_FOUND');
    }

    // Transacción si es TEACHER para crear Course + CourseTeacher atómicamente
    if (user.role === Role.TEACHER) {
      const createdCourseId = await prisma.$transaction(async (tx) => {
        const newCourse = await tx.course.create({
          data: {
            subjectId,
            createdById: user.id,
            name: name.trim(),
            description: description ? description.trim() : null,
            startDate: start,
            endDate: end,
            status: CourseStatus.DRAFT,
          },
        });

        await tx.courseTeacher.create({
          data: {
            courseId: newCourse.id,
            teacherId: user.id,
          },
        });

        return newCourse.id;
      });

      return CourseService.getCourseDetail(createdCourseId, user);
    }

    // Si es ADMIN, se crea el curso en DRAFT
    const newCourse = await prisma.course.create({
      data: {
        subjectId,
        createdById: user.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        startDate: start,
        endDate: end,
        status: CourseStatus.DRAFT,
      },
    });

    return CourseService.getCourseDetail(newCourse.id, user);
  }

  /**
   * Edita los campos de un curso existente.
   */
  public static async updateCourse(courseId: string, input: UpdateCourseInput, user: { id: string; role: Role }) {
    await CourseService.getCourseDetail(courseId, user);

    const updateData: {
      subjectId?: string;
      name?: string;
      description?: string | null;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (input.subjectId !== undefined) {
      const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
      if (!subject) {
        throw new AuthError('La materia seleccionada no existe', 404, 'SUBJECT_NOT_FOUND');
      }
      updateData.subjectId = input.subjectId;
    }

    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new AuthError('El nombre del curso no puede estar vacío', 400, 'INVALID_COURSE_NAME');
      }
      updateData.name = input.name.trim();
    }

    if (input.description !== undefined) {
      updateData.description = typeof input.description === 'string' && input.description.trim().length > 0 ? input.description.trim() : null;
    }

    if (input.startDate !== undefined) {
      const start = new Date(input.startDate);
      if (isNaN(start.getTime())) {
        throw new AuthError('La fecha de inicio no es válida', 400, 'INVALID_COURSE_DATES');
      }
      updateData.startDate = start;
    }

    if (input.endDate !== undefined) {
      const end = new Date(input.endDate);
      if (isNaN(end.getTime())) {
        throw new AuthError('La fecha de término no es válida', 400, 'INVALID_COURSE_DATES');
      }
      updateData.endDate = end;
    }

    await prisma.course.update({
      where: { id: courseId },
      data: updateData,
    });

    return CourseService.getCourseDetail(courseId, user);
  }

  /**
   * Modifica el estado del curso según las reglas del ciclo de vida (DRAFT -> ACTIVE -> FINISHED -> ARCHIVED).
   */
  public static async changeCourseStatus(courseId: string, targetStatus: CourseStatus, user: { id: string; role: Role }) {
    const course = await CourseService.getCourseDetail(courseId, user);

    if (course.status === targetStatus) {
      return course;
    }

    const current = course.status;

    // Reglas de transición permitidas
    const isValidTransition =
      (current === CourseStatus.DRAFT && targetStatus === CourseStatus.ACTIVE) ||
      (current === CourseStatus.ACTIVE && targetStatus === CourseStatus.FINISHED) ||
      (current === CourseStatus.FINISHED && targetStatus === CourseStatus.ARCHIVED);

    if (!isValidTransition) {
      throw new AuthError(
        `Transición de estado no permitida de "${current}" a "${targetStatus}"`,
        400,
        'INVALID_COURSE_STATUS_TRANSITION',
      );
    }

    // Precondición para DRAFT -> ACTIVE: debe existir al menos 1 maestro asignado
    if (current === CourseStatus.DRAFT && targetStatus === CourseStatus.ACTIVE) {
      if (!course.courseTeachers || course.courseTeachers.length === 0) {
        throw new AuthError(
          'El curso necesita al menos un maestro asignado antes de activarse.',
          400,
          'COURSE_REQUIRES_TEACHER',
        );
      }
    }

    const updateData: { status: CourseStatus; archivedAt?: Date } = {
      status: targetStatus,
    };

    if (targetStatus === CourseStatus.ARCHIVED) {
      updateData.archivedAt = new Date();
    }

    if (current === CourseStatus.ACTIVE && targetStatus === CourseStatus.FINISHED) {
      await prisma.$transaction(async (tx) => {
        const pendingAttempt = await tx.attempt.findFirst({
          where: {
            status: AttemptStatus.SUBMITTED,
            assessment: {
              courseId,
              assessmentQuestions: {
                some: {
                  question: {
                    type: QuestionType.OPEN_TEXT,
                  },
                },
              },
            },
          },
          select: { id: true },
        });

        if (pendingAttempt) {
          throw new AuthError(
            'No se puede finalizar el curso porque existen entregas pendientes de calificación manual.',
            400,
            'UNGRADED_ATTEMPTS_EXIST'
          );
        }

        await tx.course.update({
          where: { id: courseId },
          data: updateData,
        });

        await GradebookService.recalculateAndPersistCourseFinalGrades(courseId, tx);
      });
    } else {
      await prisma.course.update({
        where: { id: courseId },
        data: updateData,
      });
    }

    return CourseService.getCourseDetail(courseId, user);
  }

  /**
   * Asigna un maestro a un curso.
   */
  public static async assignTeacher(courseId: string, teacherId: string) {
    if (!teacherId || typeof teacherId !== 'string') {
      throw new AuthError('El maestro a asignar es requerido', 400, 'INVALID_TEACHER_ID');
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new AuthError('El usuario seleccionado no existe', 404, 'USER_NOT_FOUND');
    }

    if (teacher.role !== Role.TEACHER) {
      throw new AuthError('El usuario asignado debe contar con el rol de Maestro', 400, 'INVALID_TEACHER_ROLE');
    }

    if (!teacher.isActive) {
      throw new AuthError('El maestro seleccionado se encuentra inactivo', 400, 'TEACHER_INACTIVE');
    }

    const existingAssignment = await prisma.courseTeacher.findUnique({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId,
        },
      },
    });

    if (existingAssignment) {
      throw new AuthError('El maestro ya se encuentra asignado a este curso', 409, 'TEACHER_ALREADY_ASSIGNED');
    }

    return prisma.courseTeacher.create({
      data: {
        courseId,
        teacherId,
      },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Remueve a un maestro de un curso.
   */
  public static async removeTeacher(courseId: string, teacherId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        courseTeachers: true,
      },
    });

    if (!course) {
      throw new AuthError('El curso especificado no existe', 404, 'COURSE_NOT_FOUND');
    }

    const existingAssignment = course.courseTeachers.find((ct) => ct.teacherId === teacherId);
    if (!existingAssignment) {
      throw new AuthError('El maestro no está asignado a este curso', 404, 'TEACHER_NOT_ASSIGNED');
    }

    // Si el curso está ACTIVE y se intenta remover al único maestro -> Rechazar
    if (course.status === CourseStatus.ACTIVE && course.courseTeachers.length <= 1) {
      throw new AuthError(
        'No puedes quitar al único maestro asignado de un curso activo.',
        400,
        'COURSE_REQUIRES_TEACHER',
      );
    }

    await prisma.courseTeacher.delete({
      where: {
        id: existingAssignment.id,
      },
    });

    return { message: 'Maestro removido del curso exitosamente' };
  }
}
