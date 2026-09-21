import { Role, QuestionType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';
import {
  CreateQuestionInput,
  UpdateQuestionInput,
  CreateQuestionOptionInput,
  UpdateQuestionOptionInput,
  QuestionDTO,
  QuestionOptionDTO,
} from '../types/assessment.types';

export class QuestionService {
  /**
   * Helper: Validate question options and numeric fields according to QuestionType rules.
   */
  public static validateQuestionRules(
    type: QuestionType,
    options: { isCorrect: boolean; text?: string }[] = [],
    correctNumericValue?: Prisma.Decimal | number | string | null,
    numericTolerance?: Prisma.Decimal | number | string | null
  ): void {
    if (type === QuestionType.MULTIPLE_CHOICE) {
      if (options.length > 0) {
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new AuthError('MULTIPLE_CHOICE debe tener exactamente 1 opción correcta', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
      }
    } else if (type === QuestionType.MULTIPLE_SELECT) {
      if (options.length > 0) {
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount < 1) {
          throw new AuthError('MULTIPLE_SELECT debe tener al menos 1 opción correcta', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
      }
    } else if (type === QuestionType.TRUE_FALSE) {
      if (options.length > 0) {
        if (options.length !== 2) {
          throw new AuthError('TRUE_FALSE debe tener exactamente 2 opciones', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new AuthError('TRUE_FALSE debe tener exactamente 1 opción correcta', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
      }
    } else if (type === QuestionType.CROSSWORD_CLUE) {
      if (options.length > 0) {
        if (options.length !== 1) {
          throw new AuthError('CROSSWORD_CLUE debe tener exactamente 1 opción (la respuesta correcta)', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new AuthError('CROSSWORD_CLUE debe tener su opción configurada como correcta (isCorrect=true)', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
      }
    } else if (type === QuestionType.NUMERIC) {
      if (correctNumericValue === undefined || correctNumericValue === null) {
        throw new AuthError('NUMERIC requiere definir correctNumericValue', 400, 'INVALID_QUESTION_CONFIGURATION');
      }
      const val = typeof correctNumericValue === 'object' ? Number(correctNumericValue) : Number(correctNumericValue);
      if (isNaN(val)) {
        throw new AuthError('correctNumericValue debe ser un número válido', 400, 'INVALID_QUESTION_CONFIGURATION');
      }
      if (numericTolerance !== undefined && numericTolerance !== null) {
        const tol = typeof numericTolerance === 'object' ? Number(numericTolerance) : Number(numericTolerance);
        if (isNaN(tol) || tol <= 0) {
          throw new AuthError('numericTolerance debe ser un número positivo > 0', 400, 'INVALID_QUESTION_CONFIGURATION');
        }
      }
    }
  }

  /**
   * Helper: Check if question has historical submitted or graded attempts.
   */
  public static async hasSubmittedAttempts(questionId: string): Promise<boolean> {
    const count = await prisma.answer.count({
      where: {
        questionId,
        attempt: {
          status: {
            in: ['SUBMITTED', 'GRADED'],
          },
        },
      },
    });
    if (count > 0) return true;

    // Check if question belongs to any assessment that has SUBMITTED/GRADED attempts
    const assessmentCount = await prisma.assessmentQuestion.count({
      where: {
        questionId,
        assessment: {
          attempts: {
            some: {
              status: {
                in: ['SUBMITTED', 'GRADED'],
              },
            },
          },
        },
      },
    });
    return assessmentCount > 0;
  }

  /**
   * Helper: Verify if a TEACHER user has academic authorization over a specific Question.
   */
  public static async isTeacherAuthorizedForQuestion(userId: string, questionId: string): Promise<boolean> {
    const teacherCourses = await prisma.courseTeacher.findMany({
      where: { teacherId: userId },
      select: { courseId: true, course: { select: { subjectId: true } } },
    });

    if (teacherCourses.length === 0) return false;

    const teacherSubjectIds = teacherCourses.map((ct) => ct.course.subjectId).filter((id): id is string => Boolean(id));
    const teacherCourseIds = teacherCourses.map((ct) => ct.courseId);

    const match = await prisma.question.findFirst({
      where: {
        id: questionId,
        OR: [
          { subjectId: { in: teacherSubjectIds } },
          { assessmentQuestions: { some: { assessment: { courseId: { in: teacherCourseIds } } } } },
        ],
      },
      select: { id: true },
    });

    return Boolean(match);
  }

  /**
   * Create a new Question with optional options.
   */
  public static async createQuestion(
    userId: string,
    role: Role,
    input: CreateQuestionInput
  ): Promise<QuestionDTO> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    if (role === Role.TEACHER) {
      const teacherCourses = await prisma.courseTeacher.findMany({
        where: { teacherId: userId },
        select: { course: { select: { subjectId: true } } },
      });
      if (teacherCourses.length === 0) {
        throw new AuthError('Acceso denegado: no estás asignado a ningún curso', 403, 'FORBIDDEN');
      }
      if (input.subjectId) {
        const teacherSubjectIds = teacherCourses.map((ct) => ct.course.subjectId).filter(Boolean);
        if (!teacherSubjectIds.includes(input.subjectId)) {
          throw new AuthError('Acceso denegado: no tienes permiso sobre esta materia', 403, 'FORBIDDEN');
        }
      }
    }

    const statement = input.statement?.trim();
    if (!statement) {
      throw new AuthError('El enunciado de la pregunta (statement) es requerido', 400, 'BAD_REQUEST');
    }

    const defaultPoints = input.defaultPoints !== undefined ? Number(input.defaultPoints) : 10.0;
    if (isNaN(defaultPoints) || defaultPoints <= 0) {
      throw new AuthError('defaultPoints debe ser un número positivo', 400, 'BAD_REQUEST');
    }

    // Validate type rules
    this.validateQuestionRules(
      input.type,
      input.options || [],
      input.correctNumericValue,
      input.numericTolerance
    );

    // Validate subject if provided
    if (input.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
      if (!subject) {
        throw new AuthError('Materia no encontrada', 404, 'SUBJECT_NOT_FOUND');
      }
    }

    const numericVal =
      input.type === QuestionType.NUMERIC && input.correctNumericValue !== undefined && input.correctNumericValue !== null
        ? new Prisma.Decimal(input.correctNumericValue)
        : null;

    const numericTol =
      input.type === QuestionType.NUMERIC && input.numericTolerance !== undefined && input.numericTolerance !== null
        ? new Prisma.Decimal(input.numericTolerance)
        : new Prisma.Decimal(0.0001);

    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          subjectId: input.subjectId || null,
          statement,
          type: input.type,
          defaultPoints: new Prisma.Decimal(defaultPoints),
          explanation: input.explanation?.trim() || null,
          correctNumericValue: numericVal,
          numericTolerance: numericTol,
        },
      });

      if (input.options && input.options.length > 0 && input.type !== QuestionType.NUMERIC && input.type !== QuestionType.OPEN_TEXT) {
        let orderIdx = 1;
        for (const opt of input.options) {
          const text = opt.text?.trim();
          if (!text) {
            throw new AuthError('El texto de la opción no puede estar vacío', 400, 'BAD_REQUEST');
          }
          await tx.questionOption.create({
            data: {
              questionId: q.id,
              text,
              isCorrect: Boolean(opt.isCorrect),
              explanation: opt.explanation?.trim() || null,
              order: opt.order ?? orderIdx++,
            },
          });
        }
      }

      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });

    if (!question) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    return this.mapToDTO(question);
  }

  /**
   * Get list of questions, optionally filtered by subjectId.
   */
  public static async getQuestions(
    userId: string,
    role: Role,
    subjectId?: string
  ): Promise<QuestionDTO[]> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const where: Prisma.QuestionWhereInput = {};
    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (role === Role.TEACHER) {
      const teacherCourses = await prisma.courseTeacher.findMany({
        where: { teacherId: userId },
        select: { courseId: true, course: { select: { subjectId: true } } },
      });
      const teacherSubjectIds = teacherCourses.map((ct) => ct.course.subjectId).filter((id): id is string => Boolean(id));
      const teacherCourseIds = teacherCourses.map((ct) => ct.courseId);

      if (subjectId && !teacherSubjectIds.includes(subjectId)) {
        throw new AuthError('Acceso denegado: no tienes permiso sobre esta materia', 403, 'FORBIDDEN');
      }

      where.OR = [
        { subjectId: { in: teacherSubjectIds } },
        { assessmentQuestions: { some: { assessment: { courseId: { in: teacherCourseIds } } } } },
      ];
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return questions.map((q) => this.mapToDTO(q));
  }

  /**
   * Get Question detail by ID.
   */
  public static async getQuestionDetail(
    questionId: string,
    userId: string,
    role: Role
  ): Promise<QuestionDTO> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!question) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
    }

    return this.mapToDTO(question);
  }

  /**
   * Update Question metadata.
   */
  public static async updateQuestion(
    questionId: string,
    userId: string,
    role: Role,
    input: UpdateQuestionInput
  ): Promise<QuestionDTO> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const existing = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!existing) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
      if (input.subjectId) {
        const teacherCourses = await prisma.courseTeacher.findMany({
          where: { teacherId: userId },
          select: { course: { select: { subjectId: true } } },
        });
        const teacherSubjectIds = teacherCourses.map((ct) => ct.course.subjectId).filter(Boolean);
        if (!teacherSubjectIds.includes(input.subjectId)) {
          throw new AuthError('Acceso denegado: no tienes permiso sobre la materia especificada', 403, 'FORBIDDEN');
        }
      }
    }

    const hasAttempts = await this.hasSubmittedAttempts(questionId);

    // If structural fields or options are changing, check historical integrity
    if (hasAttempts) {
      const isStatementChanged = input.statement !== undefined && input.statement.trim() !== existing.statement;
      const isTypeChanged = input.type !== undefined && input.type !== existing.type;
      const isNumValChanged = input.correctNumericValue !== undefined && input.correctNumericValue !== (existing.correctNumericValue ? existing.correctNumericValue.toNumber() : null);
      const isNumTolChanged = input.numericTolerance !== undefined && input.numericTolerance !== existing.numericTolerance.toNumber();
      
      let isOptionsChanged = false;
      if (input.options && input.options.length > 0) {
        if (existing.options.length !== input.options.length) {
          isOptionsChanged = true;
        } else {
          for (let i = 0; i < input.options.length; i++) {
            const inputOpt = input.options[i];
            const existOpt = existing.options[i];
            if (!existOpt || inputOpt.text?.trim() !== existOpt.text || Boolean(inputOpt.isCorrect) !== existOpt.isCorrect) {
              isOptionsChanged = true;
              break;
            }
          }
        }
      }

      if (isStatementChanged || isTypeChanged || isNumValChanged || isNumTolChanged || isOptionsChanged) {
        throw new AuthError('No se pueden realizar modificaciones destructivas en una pregunta con historial de intentos', 409, 'QUESTION_HAS_ATTEMPTS');
      }
    }

    const newStatement = input.statement !== undefined ? input.statement.trim() : existing.statement;
    if (!newStatement) {
      throw new AuthError('El enunciado de la pregunta (statement) es requerido', 400, 'BAD_REQUEST');
    }

    const newType = input.type || existing.type;
    const newDefaultPoints = input.defaultPoints !== undefined ? Number(input.defaultPoints) : existing.defaultPoints.toNumber();
    if (isNaN(newDefaultPoints) || newDefaultPoints <= 0) {
      throw new AuthError('defaultPoints debe ser un número positivo', 400, 'BAD_REQUEST');
    }

    const targetVal = input.correctNumericValue !== undefined ? input.correctNumericValue : existing.correctNumericValue;
    const targetTol = input.numericTolerance !== undefined ? input.numericTolerance : existing.numericTolerance;

    // Validate type rules with new configuration
    const optionsToValidate = input.options && input.options.length > 0 ? input.options.map(o => ({ isCorrect: Boolean(o.isCorrect), text: o.text })) : existing.options;
    this.validateQuestionRules(newType, optionsToValidate, targetVal, targetTol);

    const numericVal =
      newType === QuestionType.NUMERIC && targetVal !== undefined && targetVal !== null
        ? new Prisma.Decimal(targetVal)
        : null;

    const numericTol =
      newType === QuestionType.NUMERIC && targetTol !== undefined && targetTol !== null
        ? new Prisma.Decimal(targetTol)
        : new Prisma.Decimal(0.0001);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          statement: newStatement,
          type: newType,
          defaultPoints: new Prisma.Decimal(newDefaultPoints),
          explanation: input.explanation !== undefined ? (input.explanation?.trim() || null) : existing.explanation,
          subjectId: input.subjectId !== undefined ? input.subjectId : existing.subjectId,
          correctNumericValue: numericVal,
          numericTolerance: numericTol,
        },
      });

      if (input.options && input.options.length > 0) {
        if (newType === QuestionType.CROSSWORD_CLUE) {
          const optInput = input.options[0];
          const text = optInput.text?.trim();
          if (!text) {
            throw new AuthError('El texto de la respuesta no puede estar vacío', 400, 'BAD_REQUEST');
          }
          if (existing.options.length > 0) {
            await tx.questionOption.update({
              where: { id: existing.options[0].id },
              data: {
                text,
                isCorrect: true,
                order: 1,
                explanation: optInput.explanation?.trim() || null,
              },
            });
            if (existing.options.length > 1) {
              await tx.questionOption.deleteMany({
                where: {
                  questionId,
                  id: { not: existing.options[0].id },
                },
              });
            }
          } else {
            await tx.questionOption.create({
              data: {
                questionId,
                text,
                isCorrect: true,
                order: 1,
                explanation: optInput.explanation?.trim() || null,
              },
            });
          }
        } else {
          await tx.questionOption.deleteMany({ where: { questionId } });
          let orderIdx = 1;
          for (const opt of input.options) {
            const text = opt.text?.trim();
            if (!text) {
              throw new AuthError('El texto de la opción no puede estar vacío', 400, 'BAD_REQUEST');
            }
            await tx.questionOption.create({
              data: {
                questionId,
                text,
                isCorrect: Boolean(opt.isCorrect),
                explanation: opt.explanation?.trim() || null,
                order: opt.order ?? orderIdx++,
              },
            });
          }
        }
      }

      const reloaded = await tx.question.findUnique({
        where: { id: questionId },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      });
      return reloaded!;
    });

    return this.mapToDTO(updated);
  }

  /**
   * Delete Question.
   */
  public static async deleteQuestion(
    questionId: string,
    userId: string,
    role: Role
  ): Promise<void> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        assessmentQuestions: true,
        answers: true,
      },
    });
    if (!question) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
    }

    if (question.answers.length > 0 || question.assessmentQuestions.length > 0) {
      throw new AuthError('No se puede eliminar una pregunta que ya está asociada a evaluaciones o intentos', 409, 'QUESTION_HAS_ATTEMPTS');
    }

    await prisma.question.delete({
      where: { id: questionId },
    });
  }

  /**
   * Add Option to Question.
   */
  public static async createOption(
    questionId: string,
    userId: string,
    role: Role,
    input: CreateQuestionOptionInput
  ): Promise<QuestionOptionDTO> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!question) {
      throw new AuthError('Pregunta no encontrada', 404, 'QUESTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
    }

    if (question.type === QuestionType.NUMERIC || question.type === QuestionType.OPEN_TEXT) {
      throw new AuthError('Este tipo de pregunta no admite opciones de respuesta', 400, 'INVALID_QUESTION_CONFIGURATION');
    }

    const hasAttempts = await this.hasSubmittedAttempts(questionId);
    if (hasAttempts) {
      throw new AuthError('No se pueden agregar opciones a una pregunta con historial de intentos', 409, 'QUESTION_HAS_ATTEMPTS');
    }

    const text = input.text?.trim();
    if (!text) {
      throw new AuthError('El texto de la opción es requerido', 400, 'BAD_REQUEST');
    }

    const nextOrder = input.order ?? (question.options.length > 0 ? Math.max(...question.options.map((o) => o.order)) + 1 : 1);

    const projectedOptions = [
      ...question.options.map((o) => ({ isCorrect: o.isCorrect })),
      { isCorrect: Boolean(input.isCorrect) },
    ];

    // Validate projected options against question type
    this.validateQuestionRules(question.type, projectedOptions, question.correctNumericValue, question.numericTolerance);

    const created = await prisma.questionOption.create({
      data: {
        questionId,
        text,
        isCorrect: Boolean(input.isCorrect),
        explanation: input.explanation?.trim() || null,
        order: nextOrder,
      },
    });

    return {
      id: created.id,
      questionId: created.questionId,
      text: created.text,
      isCorrect: created.isCorrect,
      explanation: created.explanation,
      order: created.order,
    };
  }

  /**
   * Update Question Option.
   */
  public static async updateOption(
    questionId: string,
    optionId: string,
    userId: string,
    role: Role,
    input: UpdateQuestionOptionInput
  ): Promise<QuestionOptionDTO> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const option = await prisma.questionOption.findUnique({
      where: { id: optionId },
      include: { question: { include: { options: true } } },
    });
    if (!option || option.questionId !== questionId) {
      throw new AuthError('Opción de pregunta no encontrada', 404, 'QUESTION_OPTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
    }

    const hasAttempts = await this.hasSubmittedAttempts(questionId);
    if (hasAttempts) {
      if (
        (input.isCorrect !== undefined && input.isCorrect !== option.isCorrect) ||
        (input.text !== undefined && input.text.trim() !== option.text)
      ) {
        throw new AuthError('No se puede modificar una opción de una pregunta con historial de intentos', 409, 'QUESTION_HAS_ATTEMPTS');
      }
    }

    const newText = input.text !== undefined ? input.text.trim() : option.text;
    if (!newText) {
      throw new AuthError('El texto de la opción no puede estar vacío', 400, 'BAD_REQUEST');
    }

    const projectedOptions = option.question.options.map((o) => {
      if (o.id === optionId) {
        return { isCorrect: input.isCorrect !== undefined ? Boolean(input.isCorrect) : o.isCorrect };
      }
      return { isCorrect: o.isCorrect };
    });

    this.validateQuestionRules(
      option.question.type,
      projectedOptions,
      option.question.correctNumericValue,
      option.question.numericTolerance
    );

    const updated = await prisma.questionOption.update({
      where: { id: optionId },
      data: {
        text: newText,
        isCorrect: input.isCorrect !== undefined ? Boolean(input.isCorrect) : option.isCorrect,
        explanation: input.explanation !== undefined ? (input.explanation?.trim() || null) : option.explanation,
        order: input.order !== undefined ? input.order : option.order,
      },
    });

    return {
      id: updated.id,
      questionId: updated.questionId,
      text: updated.text,
      isCorrect: updated.isCorrect,
      explanation: updated.explanation,
      order: updated.order,
    };
  }

  /**
   * Delete Question Option.
   */
  public static async deleteOption(
    questionId: string,
    optionId: string,
    userId: string,
    role: Role
  ): Promise<void> {
    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: rol insuficiente', 403, 'FORBIDDEN');
    }

    const option = await prisma.questionOption.findUnique({
      where: { id: optionId },
      include: {
        question: { include: { options: true } },
        answerOptions: true,
      },
    });
    if (!option || option.questionId !== questionId) {
      throw new AuthError('Opción de pregunta no encontrada', 404, 'QUESTION_OPTION_NOT_FOUND');
    }

    if (role === Role.TEACHER) {
      const isAuthorized = await this.isTeacherAuthorizedForQuestion(userId, questionId);
      if (!isAuthorized) {
        throw new AuthError('Acceso denegado: no tienes permisos sobre esta pregunta', 403, 'FORBIDDEN');
      }
    }

    if (option.answerOptions.length > 0) {
      throw new AuthError('No se puede eliminar una opción que ya fue seleccionada en intentos anteriores', 409, 'QUESTION_HAS_ATTEMPTS');
    }

    const hasAttempts = await this.hasSubmittedAttempts(questionId);
    if (hasAttempts) {
      throw new AuthError('No se puede eliminar una opción de una pregunta con historial de intentos', 409, 'QUESTION_HAS_ATTEMPTS');
    }

    const remainingOptions = option.question.options
      .filter((o) => o.id !== optionId)
      .map((o) => ({ isCorrect: o.isCorrect }));

    if (remainingOptions.length > 0) {
      this.validateQuestionRules(
        option.question.type,
        remainingOptions,
        option.question.correctNumericValue,
        option.question.numericTolerance
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.questionOption.delete({ where: { id: optionId } });

      // Re-normalize remaining orders 1..N
      const current = await tx.questionOption.findMany({
        where: { questionId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < current.length; i++) {
        if (current[i].order !== i + 1) {
          await tx.questionOption.update({
            where: { id: current[i].id },
            data: { order: i + 1 },
          });
        }
      }
    });
  }

  /**
   * Helper: Map Question model to DTO
   */
  public static mapToDTO(question: any): QuestionDTO {
    return {
      id: question.id,
      subjectId: question.subjectId,
      statement: question.statement,
      type: question.type,
      defaultPoints: question.defaultPoints.toNumber ? question.defaultPoints.toNumber() : Number(question.defaultPoints),
      explanation: question.explanation,
      correctNumericValue: question.correctNumericValue !== null && question.correctNumericValue !== undefined
        ? (question.correctNumericValue.toNumber ? question.correctNumericValue.toNumber() : Number(question.correctNumericValue))
        : null,
      numericTolerance: question.numericTolerance.toNumber ? question.numericTolerance.toNumber() : Number(question.numericTolerance),
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      options: question.options
        ? question.options.map((o: any) => ({
            id: o.id,
            questionId: o.questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            explanation: o.explanation,
            order: o.order,
          }))
        : [],
    };
  }
}
