import { Role, AssessmentType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { QuestionService } from './question.service';
import { GradebookService } from './gradebook.service';
import { AuthError } from '../types/auth.types';
import {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  AddAssessmentQuestionInput,
  ReorderQuestionsInput,
  AssessmentDTO,
  StudentAssessmentDTO,
} from '../types/assessment.types';

export class AssessmentService {
  /**
   * Helper: Check if user has teacher/admin management rights over courseId.
   */
  private static async checkManagementPermission(courseId: string, userId: string, role: Role): Promise<any> {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    if (role === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId,
            teacherId: userId,
          },
        },
      });
      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    if (course.status === 'FINISHED' || course.status === 'ARCHIVED') {
      throw new AuthError('No se pueden realizar modificaciones en un curso finalizado o archivado', 400, 'COURSE_CONTENT_READ_ONLY');
    }

    return course;
  }

  /**
   * Helper: Check if assessment has SUBMITTED or GRADED attempts.
   */
  public static async hasSubmittedAttempts(assessmentId: string): Promise<boolean> {
    const count = await prisma.attempt.count({
      where: {
        assessmentId,
        status: {
          in: ['SUBMITTED', 'GRADED'],
        },
      },
    });
    return count > 0;
  }

  /**
   * Helper: Validate Module and Lesson scoping for an Assessment.
   */
  private static async validateModuleAndLessonScope(
    courseId: string,
    moduleId?: string | null,
    lessonId?: string | null
  ): Promise<void> {
    if (moduleId) {
      const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!moduleRecord || moduleRecord.courseId !== courseId) {
        throw new AuthError('El módulo indicado no pertenece a este curso', 400, 'ASSESSMENT_MODULE_MISMATCH');
      }
    }

    if (lessonId) {
      const lessonRecord = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: true },
      });
      if (!lessonRecord) {
        throw new AuthError('Lección no encontrada', 404, 'LESSON_NOT_FOUND');
      }
      if (moduleId && lessonRecord.moduleId !== moduleId) {
        throw new AuthError('La lección indicada no pertenece al módulo especificado', 400, 'ASSESSMENT_LESSON_MISMATCH');
      }
      if (lessonRecord.module.courseId !== courseId) {
        throw new AuthError('La lección indicada no pertenece a este curso', 400, 'ASSESSMENT_LESSON_MISMATCH');
      }
    }
  }

  /**
   * Create an Assessment.
   */
  public static async createAssessment(
    courseId: string,
    userId: string,
    role: Role,
    input: CreateAssessmentInput
  ): Promise<AssessmentDTO> {
    await this.checkManagementPermission(courseId, userId, role);

    const title = input.title?.trim();
    if (!title) {
      throw new AuthError('El título del assessment es requerido', 400, 'BAD_REQUEST');
    }

    if (!Object.values(AssessmentType).includes(input.type)) {
      throw new AuthError('Tipo de assessment inválido', 400, 'BAD_REQUEST');
    }

    const weight = input.weight !== undefined ? Number(input.weight) : 0;
    if (isNaN(weight) || weight < 0 || weight > 100) {
      throw new AuthError('El peso (weight) debe estar entre 0 y 100', 400, 'BAD_REQUEST');
    }

    const passingScore = input.passingScore !== undefined && input.passingScore !== null ? Number(input.passingScore) : null;
    if (passingScore !== null && (isNaN(passingScore) || passingScore < 0 || passingScore > 100)) {
      throw new AuthError('passingScore debe estar entre 0 y 100', 400, 'BAD_REQUEST');
    }

    const maxAttempts = input.maxAttempts !== undefined && input.maxAttempts !== null ? Number(input.maxAttempts) : null;
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
      throw new AuthError('maxAttempts debe ser un entero >= 1', 400, 'BAD_REQUEST');
    }

    const timeLimitMinutes = input.timeLimitMinutes !== undefined && input.timeLimitMinutes !== null ? Number(input.timeLimitMinutes) : null;
    if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1)) {
      throw new AuthError('timeLimitMinutes debe ser un entero >= 1', 400, 'BAD_REQUEST');
    }

    const fromDate = input.availableFrom ? new Date(input.availableFrom) : null;
    const untilDate = input.availableUntil ? new Date(input.availableUntil) : null;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new AuthError('Fecha availableFrom inválida', 400, 'BAD_REQUEST');
    }
    if (untilDate && isNaN(untilDate.getTime())) {
      throw new AuthError('Fecha availableUntil inválida', 400, 'BAD_REQUEST');
    }
    if (fromDate && untilDate && fromDate > untilDate) {
      throw new AuthError('availableFrom no puede ser posterior a availableUntil', 400, 'BAD_REQUEST');
    }

    await this.validateModuleAndLessonScope(courseId, input.moduleId, input.lessonId);

    const created = await prisma.assessment.create({
      data: {
        courseId,
        moduleId: input.moduleId || null,
        lessonId: input.lessonId || null,
        title,
        description: input.description?.trim() || null,
        type: input.type,
        weight: new Prisma.Decimal(weight),
        passingScore: passingScore !== null ? new Prisma.Decimal(passingScore) : null,
        maxAttempts,
        timeLimitMinutes,
        availableFrom: fromDate,
        availableUntil: untilDate,
        isPublished: false,
      },
    });

    return this.mapToDTO(created);
  }

  /**
   * Get all assessments for a course.
   */
  public static async getCourseAssessments(
    courseId: string,
    userId: string,
    role: Role
  ): Promise<(AssessmentDTO | StudentAssessmentDTO)[]> {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (role === Role.STUDENT) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: userId,
          },
        },
      });
      if (!enrollment) {
        throw new AuthError('Acceso denegado: no estás inscrito en este curso', 403, 'FORBIDDEN');
      }

      if (course.status === 'DRAFT') {
        throw new AuthError('Acceso denegado: el curso no está activo', 403, 'FORBIDDEN');
      }

      const assessments = await prisma.assessment.findMany({
        where: {
          courseId,
          isPublished: true,
        },
        include: {
          assessmentQuestions: {
            orderBy: { order: 'asc' },
            include: {
              question: {
                include: {
                  options: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return assessments.map((a) => this.mapToStudentDTO(a));
    }

    // TEACHER or ADMIN
    if (role === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId,
            teacherId: userId,
          },
        },
      });
      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    const assessments = await prisma.assessment.findMany({
      where: { courseId },
      include: {
        assessmentQuestions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assessments.map((a) => this.mapToDTO(a));
  }

  /**
   * Get detail for single assessment.
   */
  public static async getAssessmentDetail(
    assessmentId: string,
    userId: string,
    role: Role
  ): Promise<AssessmentDTO | StudentAssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        course: true,
        assessmentQuestions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (role === Role.STUDENT) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: assessment.courseId,
            studentId: userId,
          },
        },
      });
      if (!enrollment || !assessment.isPublished || assessment.course.status === 'DRAFT') {
        throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
      }

      return this.mapToStudentDTO(assessment);
    }

    if (role === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId: assessment.courseId,
            teacherId: userId,
          },
        },
      });
      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    return this.mapToDTO(assessment);
  }

  /**
   * Update Assessment.
   */
  public static async updateAssessment(
    assessmentId: string,
    userId: string,
    role: Role,
    input: UpdateAssessmentInput
  ): Promise<AssessmentDTO> {
    const existing = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!existing) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(existing.courseId, userId, role);

    const hasAttempts = await this.hasSubmittedAttempts(assessmentId);
    if (hasAttempts) {
      // Reject structural updates if attempts exist
      if (input.type !== undefined && input.type !== existing.type) {
        throw new AuthError('No se puede modificar el tipo de evaluación en un assessment con historial de intentos', 409, 'ASSESSMENT_HAS_ATTEMPTS');
      }
      if (input.passingScore !== undefined && input.passingScore !== (existing.passingScore ? existing.passingScore.toNumber() : null)) {
        throw new AuthError('No se puede modificar el puntaje de aprobación en un assessment con historial de intentos', 409, 'ASSESSMENT_HAS_ATTEMPTS');
      }
    }

    const title = input.title !== undefined ? input.title.trim() : existing.title;
    if (!title) {
      throw new AuthError('El título del assessment es requerido', 400, 'BAD_REQUEST');
    }

    const type = input.type || existing.type;
    const weight = input.weight !== undefined ? Number(input.weight) : existing.weight.toNumber();
    if (isNaN(weight) || weight < 0 || weight > 100) {
      throw new AuthError('El peso (weight) debe estar entre 0 y 100', 400, 'BAD_REQUEST');
    }

    const passingScore = input.passingScore !== undefined ? (input.passingScore !== null ? Number(input.passingScore) : null) : (existing.passingScore ? existing.passingScore.toNumber() : null);
    if (passingScore !== null && (isNaN(passingScore) || passingScore < 0 || passingScore > 100)) {
      throw new AuthError('passingScore debe estar entre 0 y 100', 400, 'BAD_REQUEST');
    }

    const maxAttempts = input.maxAttempts !== undefined ? (input.maxAttempts !== null ? Number(input.maxAttempts) : null) : existing.maxAttempts;
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
      throw new AuthError('maxAttempts debe ser un entero >= 1', 400, 'BAD_REQUEST');
    }

    const timeLimitMinutes = input.timeLimitMinutes !== undefined ? (input.timeLimitMinutes !== null ? Number(input.timeLimitMinutes) : null) : existing.timeLimitMinutes;
    if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1)) {
      throw new AuthError('timeLimitMinutes debe ser un entero >= 1', 400, 'BAD_REQUEST');
    }

    const fromDate = input.availableFrom !== undefined ? (input.availableFrom ? new Date(input.availableFrom) : null) : existing.availableFrom;
    const untilDate = input.availableUntil !== undefined ? (input.availableUntil ? new Date(input.availableUntil) : null) : existing.availableUntil;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new AuthError('Fecha availableFrom inválida', 400, 'BAD_REQUEST');
    }
    if (untilDate && isNaN(untilDate.getTime())) {
      throw new AuthError('Fecha availableUntil inválida', 400, 'BAD_REQUEST');
    }
    if (fromDate && untilDate && fromDate > untilDate) {
      throw new AuthError('availableFrom no puede ser posterior a availableUntil', 400, 'BAD_REQUEST');
    }

    const targetModuleId = input.moduleId !== undefined ? input.moduleId : existing.moduleId;
    const targetLessonId = input.lessonId !== undefined ? input.lessonId : existing.lessonId;
    await this.validateModuleAndLessonScope(existing.courseId, targetModuleId, targetLessonId);

    if (existing.isPublished) {
      await GradebookService.validateCourseWeights(existing.courseId, assessmentId, weight);
    }

    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        title,
        description: input.description !== undefined ? (input.description?.trim() || null) : existing.description,
        type,
        weight: new Prisma.Decimal(weight),
        passingScore: passingScore !== null ? new Prisma.Decimal(passingScore) : null,
        maxAttempts,
        timeLimitMinutes,
        availableFrom: fromDate,
        availableUntil: untilDate,
        moduleId: targetModuleId,
        lessonId: targetLessonId,
      },
      include: {
        assessmentQuestions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Delete Assessment physically if no attempts exist.
   */
  public static async deleteAssessment(
    assessmentId: string,
    userId: string,
    role: Role
  ): Promise<void> {
    const existing = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { attempts: true },
    });
    if (!existing) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(existing.courseId, userId, role);

    if (existing.attempts.length > 0) {
      throw new AuthError('No se puede eliminar una evaluación que ya cuenta con intentos registrados', 409, 'ASSESSMENT_HAS_ATTEMPTS');
    }

    await prisma.assessment.delete({ where: { id: assessmentId } });
  }

  /**
   * Publish or Unpublish Assessment.
   */
  public static async togglePublication(
    assessmentId: string,
    userId: string,
    role: Role,
    isPublished: boolean
  ): Promise<AssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        assessmentQuestions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(assessment.courseId, userId, role);

    if (isPublished) {
      // Validate readiness before publishing
      if (!assessment.title || !assessment.title.trim()) {
        throw new AuthError('Título del assessment no válido', 400, 'INVALID_ASSESSMENT_CONFIGURATION');
      }
      if (!assessment.assessmentQuestions || assessment.assessmentQuestions.length === 0) {
        throw new AuthError('No se puede publicar una evaluación sin preguntas', 400, 'INVALID_ASSESSMENT_CONFIGURATION');
      }

      // Check points > 0 and question validity
      for (const aq of assessment.assessmentQuestions) {
        if (aq.points.toNumber() <= 0) {
          throw new AuthError('Todas las preguntas deben tener un puntaje asignado mayor a 0', 400, 'INVALID_ASSESSMENT_CONFIGURATION');
        }

        const q = aq.question;
        QuestionService.validateQuestionRules(q.type, q.options, q.correctNumericValue, q.numericTolerance);
      }

      // Validate sequential ordering 1..N
      const orders = assessment.assessmentQuestions.map((aq) => aq.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          throw new AuthError('El orden de las preguntas debe ser strictly secuencial sin huecos ni saltos', 400, 'INVALID_ASSESSMENT_CONFIGURATION');
        }
      }

      const currentWeight = assessment.weight ? assessment.weight.toNumber() : 0;
      await GradebookService.validateCourseWeights(assessment.courseId, assessmentId, currentWeight);
    }

    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: { isPublished },
      include: {
        assessmentQuestions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Add Question to Assessment.
   */
  public static async addQuestionToAssessment(
    assessmentId: string,
    userId: string,
    role: Role,
    input: AddAssessmentQuestionInput
  ): Promise<AssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { assessmentQuestions: true },
    });
    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(assessment.courseId, userId, role);

    const hasAttempts = await this.hasSubmittedAttempts(assessmentId);
    if (hasAttempts) {
      throw new AuthError('No se pueden agregar preguntas a una evaluación con historial de intentos', 409, 'ASSESSMENT_HAS_ATTEMPTS');
    }

    const question = await prisma.question.findUnique({
      where: { id: input.questionId },
      include: { options: true },
    });
    if (!question) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    // Check if question is already in assessment
    const existingRel = await prisma.assessmentQuestion.findUnique({
      where: {
        assessmentId_questionId: {
          assessmentId,
          questionId: input.questionId,
        },
      },
    });
    if (existingRel) {
      throw new AuthError('La pregunta ya está asignada a esta evaluación', 409, 'QUESTION_ALREADY_IN_ASSESSMENT');
    }

    const points = input.points !== undefined ? Number(input.points) : question.defaultPoints.toNumber();
    if (isNaN(points) || points <= 0) {
      throw new AuthError('Los puntos asignados (points) deben ser un número positivo > 0', 400, 'BAD_REQUEST');
    }

    const nextOrder = input.order ?? (assessment.assessmentQuestions.length > 0 ? Math.max(...assessment.assessmentQuestions.map((aq) => aq.order)) + 1 : 1);

    await prisma.assessmentQuestion.create({
      data: {
        assessmentId,
        questionId: input.questionId,
        points: new Prisma.Decimal(points),
        order: nextOrder,
      },
    });

    return this.getAssessmentDetail(assessmentId, userId, role) as Promise<AssessmentDTO>;
  }

  /**
   * Remove Question from Assessment.
   */
  public static async removeQuestionFromAssessment(
    assessmentId: string,
    questionId: string,
    userId: string,
    role: Role
  ): Promise<AssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(assessment.courseId, userId, role);

    const hasAttempts = await this.hasSubmittedAttempts(assessmentId);
    if (hasAttempts) {
      throw new AuthError('No se pueden eliminar preguntas de una evaluación con historial de intentos', 409, 'ASSESSMENT_HAS_ATTEMPTS');
    }

    const rel = await prisma.assessmentQuestion.findUnique({
      where: {
        assessmentId_questionId: {
          assessmentId,
          questionId,
        },
      },
    });
    if (!rel) {
      throw new AuthError('La pregunta no está asignada a esta evaluación', 404, 'QUESTION_NOT_IN_ASSESSMENT');
    }

    await prisma.$transaction(async (tx) => {
      await tx.assessmentQuestion.delete({
        where: { id: rel.id },
      });

      // Normalize remaining orders 1..N
      const remaining = await tx.assessmentQuestion.findMany({
        where: { assessmentId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].order !== i + 1) {
          await tx.assessmentQuestion.update({
            where: { id: remaining[i].id },
            data: { order: i + 1 },
          });
        }
      }
    });

    return this.getAssessmentDetail(assessmentId, userId, role) as Promise<AssessmentDTO>;
  }

  /**
   * Update points for AssessmentQuestion.
   */
  public static async updateAssessmentQuestionPoints(
    assessmentId: string,
    questionId: string,
    userId: string,
    role: Role,
    points: number
  ): Promise<AssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(assessment.courseId, userId, role);

    const hasAttempts = await this.hasSubmittedAttempts(assessmentId);
    if (hasAttempts) {
      throw new AuthError('No se puede modificar el puntaje de una pregunta en una evaluación con historial de intentos', 409, 'ASSESSMENT_HAS_ATTEMPTS');
    }

    const rel = await prisma.assessmentQuestion.findUnique({
      where: {
        assessmentId_questionId: {
          assessmentId,
          questionId,
        },
      },
    });
    if (!rel) {
      throw new AuthError('La pregunta no está asignada a esta evaluación', 404, 'QUESTION_NOT_IN_ASSESSMENT');
    }

    const numericPoints = Number(points);
    if (isNaN(numericPoints) || numericPoints <= 0) {
      throw new AuthError('Los puntos (points) deben ser un número positivo > 0', 400, 'BAD_REQUEST');
    }

    await prisma.assessmentQuestion.update({
      where: { id: rel.id },
      data: {
        points: new Prisma.Decimal(numericPoints),
      },
    });

    return this.getAssessmentDetail(assessmentId, userId, role) as Promise<AssessmentDTO>;
  }

  /**
   * Reorder AssessmentQuestions sequentially.
   */
  public static async reorderAssessmentQuestions(
    assessmentId: string,
    userId: string,
    role: Role,
    input: ReorderQuestionsInput
  ): Promise<AssessmentDTO> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { assessmentQuestions: true },
    });
    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    await this.checkManagementPermission(assessment.courseId, userId, role);

    const currentQuestions = assessment.assessmentQuestions;
    if (input.items.length !== currentQuestions.length) {
      throw new AuthError('El número de ítems para reordenar no coincide con las preguntas del assessment', 400, 'BAD_REQUEST');
    }

    const currentQuestionIds = new Set(currentQuestions.map((q) => q.questionId));
    const inputQuestionIds = new Set(input.items.map((item) => item.questionId));

    if (currentQuestionIds.size !== inputQuestionIds.size || [...currentQuestionIds].some((id) => !inputQuestionIds.has(id))) {
      throw new AuthError('Los IDs de las preguntas a reordenar no coinciden exactamente con la evaluación', 400, 'BAD_REQUEST');
    }

    const orders = input.items.map((item) => item.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new AuthError('El orden de las preguntas debe ser una secuencia válida 1..N', 400, 'BAD_REQUEST');
      }
    }

    await prisma.$transaction(async (tx) => {
      // Step 1: Set temporary negative order to prevent constraint collisions
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const rel = currentQuestions.find((q) => q.questionId === item.questionId);
        if (rel) {
          await tx.assessmentQuestion.update({
            where: { id: rel.id },
            data: { order: -(i + 1) },
          });
        }
      }

      // Step 2: Set target order
      for (const item of input.items) {
        const rel = currentQuestions.find((q) => q.questionId === item.questionId);
        if (rel) {
          await tx.assessmentQuestion.update({
            where: { id: rel.id },
            data: { order: item.order },
          });
        }
      }
    });

    return this.getAssessmentDetail(assessmentId, userId, role) as Promise<AssessmentDTO>;
  }

  /**
   * Map Assessment model to DTO for Admin/Teacher.
   */
  public static mapToDTO(assessment: any): AssessmentDTO {
    let totalPoints = 0;
    const questions = assessment.assessmentQuestions
      ? assessment.assessmentQuestions.map((aq: any) => {
          const pts = aq.points.toNumber ? aq.points.toNumber() : Number(aq.points);
          totalPoints += pts;
          return {
            id: aq.id,
            assessmentId: aq.assessmentId,
            questionId: aq.questionId,
            points: pts,
            order: aq.order,
            question: aq.question ? QuestionService.mapToDTO(aq.question) : undefined,
          };
        })
      : [];

    return {
      id: assessment.id,
      courseId: assessment.courseId,
      moduleId: assessment.moduleId,
      lessonId: assessment.lessonId,
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      weight: assessment.weight.toNumber ? assessment.weight.toNumber() : Number(assessment.weight),
      availableFrom: assessment.availableFrom,
      availableUntil: assessment.availableUntil,
      timeLimitMinutes: assessment.timeLimitMinutes,
      maxAttempts: assessment.maxAttempts,
      passingScore: assessment.passingScore
        ? (assessment.passingScore.toNumber ? assessment.passingScore.toNumber() : Number(assessment.passingScore))
        : null,
      isPublished: assessment.isPublished,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
      questions,
      totalPoints,
    };
  }

  /**
   * Map Assessment model to Student DTO (sanitizes correct answers).
   */
  public static mapToStudentDTO(assessment: any): StudentAssessmentDTO {
    let totalPoints = 0;
    const questions = assessment.assessmentQuestions
      ? assessment.assessmentQuestions.map((aq: any) => {
          const pts = aq.points.toNumber ? aq.points.toNumber() : Number(aq.points);
          totalPoints += pts;
          return {
            id: aq.id,
            assessmentId: aq.assessmentId,
            questionId: aq.questionId,
            points: pts,
            order: aq.order,
            question: {
              id: aq.question.id,
              statement: aq.question.statement,
              type: aq.question.type,
              options: aq.question.options
                ? aq.question.options.map((o: any) => ({
                    id: o.id,
                    questionId: o.questionId,
                    text: o.text,
                    order: o.order,
                  }))
                : [],
            },
          };
        })
      : [];

    return {
      id: assessment.id,
      courseId: assessment.courseId,
      moduleId: assessment.moduleId,
      lessonId: assessment.lessonId,
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      weight: assessment.weight.toNumber ? assessment.weight.toNumber() : Number(assessment.weight),
      availableFrom: assessment.availableFrom,
      availableUntil: assessment.availableUntil,
      timeLimitMinutes: assessment.timeLimitMinutes,
      maxAttempts: assessment.maxAttempts,
      passingScore: assessment.passingScore
        ? (assessment.passingScore.toNumber ? assessment.passingScore.toNumber() : Number(assessment.passingScore))
        : null,
      isPublished: assessment.isPublished,
      questions,
      totalPoints,
    };
  }
}
