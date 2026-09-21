import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotificationService } from './notification.service';
import { AuthError } from '../types/auth.types';

export interface CreateSubjectInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateSubjectInput {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export class SubjectService {
  /**
   * Consulta las materias disponibles según el rol del usuario.
   */
  public static async getAllSubjects(user?: { id: string; role: Role }) {
    const includeTeachers = {
      subjectTeachers: {
        include: {
          teacher: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    };

    if (!user || user.role === Role.ADMIN) {
      return prisma.subject.findMany({
        include: includeTeachers,
        orderBy: { code: 'asc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return prisma.subject.findMany({
        where: {
          isActive: true,
          subjectTeachers: {
            some: {
              teacherId: user.id,
            },
          },
        },
        include: includeTeachers,
        orderBy: { code: 'asc' },
      });
    }

    // STUDENT
    return prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Obtiene el detalle de una materia por ID.
   */
  public static async getSubjectById(id: string) {
    if (!id || typeof id !== 'string') {
      throw new AuthError('Identificador de materia no válido', 400, 'INVALID_SUBJECT_ID');
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        subjectTeachers: {
          include: {
            teacher: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!subject) {
      throw new AuthError('La materia especificada no existe', 404, 'SUBJECT_NOT_FOUND');
    }

    return subject;
  }

  /**
   * Crea una nueva materia en el catálogo.
   */
  public static async createSubject(input: CreateSubjectInput) {
    const { code, name, description } = input || {};

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new AuthError('El código o clave de la materia es requerido', 400, 'INVALID_SUBJECT_CODE');
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AuthError('El nombre de la materia es requerido', 400, 'INVALID_SUBJECT_NAME');
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();

    // Verificar si ya existe una materia con el mismo código
    const existing = await prisma.subject.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new AuthError(`Ya existe una materia registrada con la clave "${normalizedCode}"`, 409, 'SUBJECT_CODE_EXISTS');
    }

    return prisma.subject.create({
      data: {
        code: normalizedCode,
        name: normalizedName,
        description: description ? description.trim() : null,
        isActive: true,
      },
    });
  }

  /**
   * Actualiza los datos de una materia existente.
   */
  public static async updateSubject(id: string, input: UpdateSubjectInput) {
    const existingSubject = await SubjectService.getSubjectById(id);

    const updateData: {
      code?: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (input.code !== undefined) {
      if (typeof input.code !== 'string' || input.code.trim().length === 0) {
        throw new AuthError('El código de la materia no puede estar vacío', 400, 'INVALID_SUBJECT_CODE');
      }
      const newCode = input.code.trim().toUpperCase();
      if (newCode !== existingSubject.code) {
        const duplicateCode = await prisma.subject.findUnique({
          where: { code: newCode },
        });
        if (duplicateCode) {
          throw new AuthError(`Ya existe otra materia registrada con la clave "${newCode}"`, 409, 'SUBJECT_CODE_EXISTS');
        }
        updateData.code = newCode;
      }
    }

    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new AuthError('El nombre de la materia no puede estar vacío', 400, 'INVALID_SUBJECT_NAME');
      }
      updateData.name = input.name.trim();
    }

    if (input.description !== undefined) {
      updateData.description = typeof input.description === 'string' && input.description.trim().length > 0 ? input.description.trim() : null;
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== 'boolean') {
        throw new AuthError('El estado de la materia debe ser verdadero o falso', 400, 'INVALID_SUBJECT_STATUS');
      }
      updateData.isActive = input.isActive;
    }

    return prisma.subject.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Obtiene la lista de docentes asignados a una materia.
   */
  public static async getSubjectTeachers(subjectId: string) {
    await SubjectService.getSubjectById(subjectId);

    return prisma.subjectTeacher.findMany({
      where: { subjectId },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }

  /**
   * Asigna un maestro a una materia (Exclusivo ADMIN).
   */
  public static async assignTeacherToSubject(subjectId: string, teacherId: string) {
    const subject = await SubjectService.getSubjectById(subjectId);

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

    const existing = await prisma.subjectTeacher.findUnique({
      where: {
        subjectId_teacherId: {
          subjectId,
          teacherId,
        },
      },
    });

    if (existing) {
      throw new AuthError('El maestro ya se encuentra asignado a esta materia', 409, 'TEACHER_ALREADY_ASSIGNED_TO_SUBJECT');
    }

    const assignment = await prisma.subjectTeacher.create({
      data: {
        subjectId,
        teacherId,
      },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    try {
      await NotificationService.createNotification({
        userId: teacherId,
        type: 'SUBJECT_ASSIGNED',
        title: 'Nueva materia asignada',
        message: `Has sido autorizado para trabajar con ${subject.name}.`,
        link: '/app/courses',
      });
    } catch (err) {
      console.error('[NOTIFICATION ERROR] Failed to dispatch SUBJECT_ASSIGNED:', err);
    }

    return assignment;
  }

  /**
   * Quita a un maestro de una materia (Exclusivo ADMIN).
   */
  public static async removeTeacherFromSubject(subjectId: string, teacherId: string) {
    await SubjectService.getSubjectById(subjectId);

    const existing = await prisma.subjectTeacher.findUnique({
      where: {
        subjectId_teacherId: {
          subjectId,
          teacherId,
        },
      },
    });

    if (!existing) {
      throw new AuthError('El maestro no está asignado a esta materia', 404, 'TEACHER_NOT_ASSIGNED_TO_SUBJECT');
    }

    await prisma.subjectTeacher.delete({
      where: { id: existing.id },
    });

    return { message: 'Maestro removido de la materia exitosamente' };
  }
}

