import { Role, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';
import {
  CreateAttemptGrantInput,
  AssessmentAttemptGrantDTO,
  StudentAttemptSummaryDTO,
  StudentAttemptSummaryItemDTO,
} from '../types/assessment.types';

export class AttemptGrantService {
  /**
   * Concede uno o más intentos adicionales a un estudiante específico para una evaluación.
   */
  public static async createGrant(
    assessmentId: string,
    studentId: string,
    grantedById: string,
    grantedByRole: Role,
    input: CreateAttemptGrantInput
  ): Promise<StudentAttemptSummaryItemDTO> {
    // 1. Validar permisos del actor
    if (grantedByRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden conceder intentos', 403, 'FORBIDDEN');
    }

    if (grantedById === studentId) {
      throw new AuthError('No puedes concederte intentos a ti mismo', 400, 'CANNOT_GRANT_SELF');
    }

    // 2. Validar cantidad (entero >= 1)
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AuthError('La cantidad de intentos a conceder debe ser un número entero mayor o igual a 1', 400, 'INVALID_QUANTITY');
    }

    // 3. Buscar evaluación y curso
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (assessment.maxAttempts === null) {
      throw new AuthError(
        'La evaluación tiene intentos ilimitados. No es necesario conceder intentos adicionales.',
        400,
        'UNLIMITED_ATTEMPTS'
      );
    }

    if (assessment.course.status === CourseStatus.ARCHIVED) {
      throw new AuthError('Acceso denegado: el curso se encuentra archivado', 403, 'COURSE_NOT_ACTIVE');
    }

    // 4. Validar asignación del docente si el actor es TEACHER
    if (grantedByRole === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId: assessment.courseId,
            teacherId: grantedById,
          },
        },
      });

      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    // 5. Validar estudiante objetivo
    const studentUser = await prisma.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    });

    if (!studentUser || studentUser.role !== Role.STUDENT) {
      throw new AuthError('El usuario especificado no es un estudiante válido', 400, 'INVALID_STUDENT');
    }

    // 6. Validar inscripción activa del estudiante en el curso
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: assessment.courseId,
          studentId,
        },
      },
    });

    if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new AuthError(
        'Acceso denegado: el alumno no está inscrito activamente en este curso',
        403,
        'ENROLLMENT_REQUIRED'
      );
    }

    // 7. Crear el registro del grant
    const reasonText = input.reason?.trim() ? input.reason.trim() : null;

    await prisma.assessmentAttemptGrant.create({
      data: {
        assessmentId,
        studentId,
        grantedById,
        quantity,
        reason: reasonText,
      },
    });

    // 8. Retornar resumen actualizado
    return await this.getSingleStudentSummary(assessmentId, studentId, assessment.maxAttempts);
  }

  /**
   * Obtiene el resumen de intentos para un estudiante específico.
   */
  public static async getStudentAttemptSummary(
    assessmentId: string,
    studentId: string,
    requesterId: string,
    requesterRole: Role
  ): Promise<StudentAttemptSummaryDTO> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (requesterRole === Role.STUDENT && requesterId !== studentId) {
      throw new AuthError('Acceso denegado: no puedes consultar intentos de otros estudiantes', 403, 'FORBIDDEN');
    }

    const summaryItem = await this.getSingleStudentSummary(assessmentId, studentId, assessment.maxAttempts);

    return {
      attemptsUsed: summaryItem.attemptsUsed,
      maxAttemptsGlobal: summaryItem.maxAttemptsGlobal,
      additionalAttemptsGranted: summaryItem.additionalAttemptsGranted,
      effectiveMaxAttempts: summaryItem.effectiveMaxAttempts,
      attemptsAvailable: summaryItem.attemptsAvailable,
    };
  }

  /**
   * Obtiene la lista resumida de intentos de todos los alumnos inscritos activamente en el curso de una evaluación (para docentes/admin).
   */
  public static async getAssessmentStudentsAttemptSummary(
    assessmentId: string,
    requesterId: string,
    requesterRole: Role
  ): Promise<StudentAttemptSummaryItemDTO[]> {
    if (requesterRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden consultar el control global de intentos', 403, 'FORBIDDEN');
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (requesterRole === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId: assessment.courseId,
            teacherId: requesterId,
          },
        },
      });

      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: assessment.courseId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: {
          include: { studentProfile: true },
        },
      },
      orderBy: {
        student: { name: 'asc' },
      },
    });

    const summaryItems: StudentAttemptSummaryItemDTO[] = [];

    for (const enr of enrollments) {
      const summaryItem = await this.getSingleStudentSummary(
        assessmentId,
        enr.studentId,
        assessment.maxAttempts,
        enr.student.name,
        enr.student.studentProfile?.studentNumber || ''
      );
      summaryItems.push(summaryItem);
    }

    return summaryItems;
  }

  /**
   * Obtiene el historial de grants otorgados a un alumno específico para una evaluación (ADMIN / TEACHER).
   */
  public static async getStudentGrantHistory(
    assessmentId: string,
    studentId: string,
    requesterId: string,
    requesterRole: Role
  ): Promise<AssessmentAttemptGrantDTO[]> {
    if (requesterRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden consultar el historial administrativo de grants', 403, 'FORBIDDEN');
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (requesterRole === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId: assessment.courseId,
            teacherId: requesterId,
          },
        },
      });

      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    const grants = await prisma.assessmentAttemptGrant.findMany({
      where: {
        assessmentId,
        studentId,
      },
      include: {
        grantedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return grants.map((g) => ({
      id: g.id,
      assessmentId: g.assessmentId,
      studentId: g.studentId,
      grantedById: g.grantedById,
      grantedByName: g.grantedBy.name,
      quantity: g.quantity,
      reason: g.reason,
      createdAt: g.createdAt,
    }));
  }

  /**
   * Helper que calcula el resumen de un solo estudiante.
   */
  public static async getSingleStudentSummary(
    assessmentId: string,
    studentId: string,
    maxAttemptsGlobal: number | null,
    studentNameOverride?: string,
    studentNumberOverride?: string
  ): Promise<StudentAttemptSummaryItemDTO> {
    const attemptsUsed = await prisma.attempt.count({
      where: {
        studentId,
        assessmentId,
        status: {
          in: ['SUBMITTED', 'GRADED', 'ABANDONED'],
        },
      },
    });

    const grantsAgg = await prisma.assessmentAttemptGrant.aggregate({
      where: {
        assessmentId,
        studentId,
      },
      _sum: {
        quantity: true,
      },
    });

    const additionalAttemptsGranted = grantsAgg._sum.quantity || 0;

    let effectiveMaxAttempts: number | null = null;
    let attemptsAvailable: number | null = null;

    if (maxAttemptsGlobal !== null) {
      effectiveMaxAttempts = maxAttemptsGlobal + additionalAttemptsGranted;
      attemptsAvailable = Math.max(0, effectiveMaxAttempts - attemptsUsed);
    }

    let studentName = studentNameOverride || '';
    let studentNumber = studentNumberOverride || '';

    if (!studentNameOverride) {
      const user = await prisma.user.findUnique({
        where: { id: studentId },
        include: { studentProfile: true },
      });
      if (user) {
        studentName = user.name;
        studentNumber = user.studentProfile?.studentNumber || '';
      }
    }

    return {
      studentId,
      studentName,
      studentNumber,
      attemptsUsed,
      maxAttemptsGlobal,
      additionalAttemptsGranted,
      effectiveMaxAttempts,
      attemptsAvailable,
    };
  }
}
