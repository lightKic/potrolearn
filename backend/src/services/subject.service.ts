import { prisma } from '../lib/prisma';
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
   * Consulta todas las materias disponibles.
   */
  public static async getAllSubjects() {
    return prisma.subject.findMany({
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
}
