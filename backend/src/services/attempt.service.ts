import * as crypto from 'crypto';
import { Role, CourseStatus, EnrollmentStatus, QuestionType, AttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';
import { GradebookService } from './gradebook.service';
import { AssessmentService } from './assessment.service';
import {
  AttemptDTO,
  SaveAnswerInput,
  AttemptAnswerDTO,
  GradeAnswerInput,
  AssessmentAttemptItemDTO,
  TeacherAttemptDTO,
  TeacherAttemptAnswerDTO,
} from '../types/assessment.types';

export class AttemptService {
  /**
   * Generates two 32-bit signed integers from a deterministic SHA-256 hash of (studentId, assessmentId)
   * suitable for PostgreSQL pg_advisory_xact_lock(key1, key2).
   */
  public static getAdvisoryLockKeys(studentId: string, assessmentId: string): [number, number] {
    const combined = `${studentId}:${assessmentId}`;
    const hash = crypto.createHash('sha256').update(combined).digest();
    const key1 = hash.readInt32BE(0);
    const key2 = hash.readInt32BE(4);
    return [key1, key2];
  }

  /**
   * Generates two 32-bit signed integers from a deterministic SHA-256 hash of (attemptId, questionId)
   * suitable for PostgreSQL pg_advisory_xact_lock(key1, key2).
   */
  public static getAnswerAdvisoryLockKeys(attemptId: string, questionId: string): [number, number] {
    const combined = `${attemptId}:${questionId}`;
    const hash = crypto.createHash('sha256').update(combined).digest();
    const key1 = hash.readInt32BE(0);
    const key2 = hash.readInt32BE(4);
    return [key1, key2];
  }

  /**
   * Generates two 32-bit signed integers from a deterministic SHA-256 hash of attemptId
   * suitable for PostgreSQL pg_advisory_xact_lock(key1, key2).
   */
  public static getAttemptAdvisoryLockKeys(attemptId: string): [number, number] {
    const combined = `attempt_grading:${attemptId}`;
    const hash = crypto.createHash('sha256').update(combined).digest();
    const key1 = hash.readInt32BE(0);
    const key2 = hash.readInt32BE(4);
    return [key1, key2];
  }

  /**
   * Starts a new Attempt or resumes an existing IN_PROGRESS Attempt for a Student.
   * Concurrency is strictly protected using PostgreSQL pg_advisory_xact_lock.
   */
  public static async startOrResumeAttempt(
    assessmentId: string,
    studentId: string
  ): Promise<AttemptDTO> {
    const [key1, key2] = this.getAdvisoryLockKeys(studentId, assessmentId);

    return await prisma.$transaction(
      async (tx) => {
        // 1. Acquire transactional advisory lock for this (studentId, assessmentId) pair
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;

      // 2. Check for existing IN_PROGRESS attempt
      const activeAttempt = await tx.attempt.findFirst({
        where: {
          studentId,
          assessmentId,
          status: 'IN_PROGRESS',
        },
        include: {
          assessment: {
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
          },
          answers: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      if (activeAttempt) {
        return this.mapToDTO(activeAttempt, Role.STUDENT);
      }

      // 3. Locate assessment and course to validate rules
      const assessment = await tx.assessment.findUnique({
        where: { id: assessmentId },
        include: { course: true },
      });

      if (!assessment) {
        throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
      }

      // 4. Validate Course Status (Must be ACTIVE)
      if (assessment.course.status !== CourseStatus.ACTIVE) {
        throw new AuthError('Acceso denegado: el curso no se encuentra activo', 403, 'COURSE_NOT_ACTIVE');
      }

      // 5. Validate Student Enrollment (Must be ACTIVE)
      const enrollment = await tx.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: assessment.courseId,
            studentId,
          },
        },
      });

      if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
        throw new AuthError('Acceso denegado: no estás inscrito activamente en este curso', 403, 'ENROLLMENT_REQUIRED');
      }

      // 6. Validate Assessment Publication
      if (!assessment.isPublished) {
        throw new AuthError('La evaluación no se encuentra publicada', 400, 'ASSESSMENT_NOT_PUBLISHED');
      }

      const now = new Date();

      // 7. Validate availableFrom
      if (assessment.availableFrom && now < assessment.availableFrom) {
        throw new AuthError('La evaluación aún no está disponible', 400, 'ASSESSMENT_NOT_AVAILABLE');
      }

      // 8. Validate availableUntil
      if (assessment.availableUntil && now > assessment.availableUntil) {
        throw new AuthError('La evaluación ha cerrado su periodo de disponibilidad', 400, 'ASSESSMENT_CLOSED');
      }

      // 9. Validate maxAttempts (Count only SUBMITTED or GRADED attempts)
      if (assessment.maxAttempts !== null) {
        const completedAttemptsCount = await tx.attempt.count({
          where: {
            studentId,
            assessmentId,
            status: {
              in: ['SUBMITTED', 'GRADED'],
            },
          },
        });

        if (completedAttemptsCount >= assessment.maxAttempts) {
          throw new AuthError('Has alcanzado el límite máximo de intentos permitidos para esta evaluación', 400, 'MAX_ATTEMPTS_REACHED');
        }
      }

      // 10. Calculate next attemptNumber sequentially
      const maxAttemptAgg = await tx.attempt.aggregate({
        where: {
          studentId,
          assessmentId,
        },
        _max: {
          attemptNumber: true,
        },
      });

      const nextAttemptNumber = (maxAttemptAgg._max.attemptNumber || 0) + 1;

      // 11. Create new Attempt
      const newAttempt = await tx.attempt.create({
        data: {
          studentId,
          assessmentId,
          attemptNumber: nextAttemptNumber,
          status: 'IN_PROGRESS',
          startedAt: now,
          score: null,
          submittedAt: null,
        },
        include: {
          assessment: {
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
          },
          answers: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      return this.mapToDTO(newAttempt, Role.STUDENT);
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Retrieves an Attempt by ID and validates ownership / course permissions.
   */
  public static async getAttemptById(
    attemptId: string,
    userId: string,
    userRole: Role
  ): Promise<AttemptDTO> {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
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
        },
        answers: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Ownership & Authorization Checks
    if (userRole === Role.STUDENT) {
      if (attempt.studentId !== userId) {
        throw new AuthError('Acceso denegado: no puedes acceder a intentos de otros estudiantes', 403, 'FORBIDDEN');
      }
    } else if (userRole === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId: attempt.assessment.courseId,
            teacherId: userId,
          },
        },
      });
      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }
    // ADMIN has global access

    return this.mapToDTO(attempt, userRole);
  }

  /**
   * Guarda o actualiza incrementalmente la respuesta de un estudiante a una pregunta.
   * Concurrencia atómica garantizada con pg_advisory_xact_lock(attemptId, questionId).
   */
  public static async saveAnswer(
    attemptId: string,
    questionId: string,
    studentId: string,
    input: SaveAnswerInput,
    rawBodyKeys?: string[]
  ): Promise<AttemptAnswerDTO> {
    const [key1, key2] = this.getAnswerAdvisoryLockKeys(attemptId, questionId);

    return await prisma.$transaction(
      async (tx) => {
        // 1. Acquire transactional advisory lock for (attemptId, questionId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;

      // 2. Fetch Attempt with Assessment
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: {
          assessment: true,
        },
      });

      if (!attempt) {
        throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
      }

      // 3. Validate Student Ownership
      if (attempt.studentId !== studentId) {
        throw new AuthError('Acceso denegado: este intento no te pertenece', 403, 'ATTEMPT_ACCESS_DENIED');
      }

      // 4. Validate Attempt Status (Must be IN_PROGRESS)
      if (attempt.status !== 'IN_PROGRESS') {
        throw new AuthError('El intento no está editable', 403, 'ATTEMPT_NOT_EDITABLE');
      }

      // 5. Validate Time Limit (startedAt + timeLimitMinutes)
      if (attempt.assessment.timeLimitMinutes) {
        const now = new Date();
        const maxEndTime = new Date(attempt.startedAt.getTime() + attempt.assessment.timeLimitMinutes * 60 * 1000);
        if (now > maxEndTime) {
          throw new AuthError('El tiempo límite de la evaluación ha transcurrido', 403, 'ATTEMPT_EXPIRED');
        }
      }

      // 6. Validate Question belonging to Assessment via AssessmentQuestion
      const assoc = await tx.assessmentQuestion.findUnique({
        where: {
          assessmentId_questionId: {
            assessmentId: attempt.assessmentId,
            questionId,
          },
        },
        include: {
          question: {
            include: { options: true },
          },
        },
      });

      if (!assoc || !assoc.question) {
        throw new AuthError('La pregunta no pertenece a esta evaluación', 404, 'QUESTION_NOT_IN_ASSESSMENT');
      }

      const question = assoc.question;

      // 7. Validate and parse input against question.type and rawBodyKeys
      const parsed = this.validateAndParseAnswerInput(question.type, input, rawBodyKeys);

      // 8. Validate QuestionOptions belong to questionId if optionIds provided
      let validOptionIds: string[] = [];
      if (parsed.optionIds && parsed.optionIds.length > 0) {
        const validOptionsMap = new Set(question.options.map((o) => o.id));
        for (const optId of parsed.optionIds) {
          if (!validOptionsMap.has(optId)) {
            throw new AuthError('Una o más opciones no corresponden a esta pregunta', 400, 'INVALID_OPTION');
          }
        }
        validOptionIds = Array.from(new Set(parsed.optionIds));
      }

      // 9. Upsert Answer row atomically (keep pointsEarned, isCorrect, feedback, gradedAt NULL)
      const answer = await tx.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId,
          },
        },
        create: {
          attemptId,
          questionId,
          numericValue: question.type === QuestionType.NUMERIC ? parsed.numericValue : null,
          textValue: question.type === QuestionType.OPEN_TEXT ? parsed.textValue : null,
          pointsEarned: null,
          isCorrect: null,
          feedback: null,
          gradedAt: null,
        },
        update: {
          numericValue: question.type === QuestionType.NUMERIC ? parsed.numericValue : null,
          textValue: question.type === QuestionType.OPEN_TEXT ? parsed.textValue : null,
          pointsEarned: null,
          isCorrect: null,
          feedback: null,
          gradedAt: null,
        },
      });

      // 10. Replace AnswerOptions for MC, MS, TF
      if (([QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIPLE_SELECT, QuestionType.TRUE_FALSE] as QuestionType[]).includes(question.type)) {
        await tx.answerOption.deleteMany({
          where: { answerId: answer.id },
        });

        if (validOptionIds.length > 0) {
          await tx.answerOption.createMany({
            data: validOptionIds.map((optionId) => ({
              answerId: answer.id,
              optionId,
            })),
          });
        }
      }

      return {
        id: answer.id,
        attemptId: answer.attemptId,
        questionId: answer.questionId,
        optionIds: validOptionIds,
        numericValue: answer.numericValue !== null && answer.numericValue !== undefined
          ? (typeof answer.numericValue === 'object' && 'toNumber' in answer.numericValue ? answer.numericValue.toNumber() : Number(answer.numericValue))
          : null,
        textValue: answer.textValue || null,
        updatedAt: new Date(),
      };
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Helper que valida y desinfecta el payload recibido según el QuestionType de la pregunta.
   */
  private static validateAndParseAnswerInput(
    questionType: QuestionType,
    input: SaveAnswerInput,
    rawBodyKeys?: string[]
  ): {
    optionIds?: string[];
    numericValue?: number | null;
    textValue?: string | null;
  } {
    if (rawBodyKeys && rawBodyKeys.length > 0) {
      const allowedKeys = new Set(['optionIds', 'numericValue', 'textValue']);
      for (const key of rawBodyKeys) {
        if (!allowedKeys.has(key)) {
          throw new AuthError(
            `Payload de respuesta inválido: el campo '${key}' no está permitido`,
            400,
            'INVALID_PAYLOAD'
          );
        }
      }
    }

    const { optionIds, numericValue, textValue } = input;

    if (questionType === QuestionType.MULTIPLE_CHOICE) {
      if ((numericValue !== undefined && numericValue !== null) || (textValue !== undefined && textValue !== null)) {
        throw new AuthError(
          'Tipos de datos incompatibles para la pregunta MULTIPLE_CHOICE',
          400,
          'QUESTION_TYPE_MISMATCH'
        );
      }
      if (optionIds !== undefined) {
        if (!Array.isArray(optionIds)) {
          throw new AuthError('El campo optionIds debe ser un arreglo de identificadores', 400, 'INVALID_PAYLOAD');
        }
        if (optionIds.length > 1) {
          throw new AuthError(
            'La pregunta MULTIPLE_CHOICE sólo permite seleccionar como máximo una opción',
            400,
            'INVALID_PAYLOAD'
          );
        }
      }
      return { optionIds: optionIds || [] };
    }

    if (questionType === QuestionType.TRUE_FALSE) {
      if ((numericValue !== undefined && numericValue !== null) || (textValue !== undefined && textValue !== null)) {
        throw new AuthError(
          'Tipos de datos incompatibles para la pregunta TRUE_FALSE',
          400,
          'QUESTION_TYPE_MISMATCH'
        );
      }
      if (optionIds !== undefined) {
        if (!Array.isArray(optionIds)) {
          throw new AuthError('El campo optionIds debe ser un arreglo de identificadores', 400, 'INVALID_PAYLOAD');
        }
        if (optionIds.length > 1) {
          throw new AuthError(
            'La pregunta TRUE_FALSE sólo permite seleccionar como máximo una opción',
            400,
            'INVALID_PAYLOAD'
          );
        }
      }
      return { optionIds: optionIds || [] };
    }

    if (questionType === QuestionType.MULTIPLE_SELECT) {
      if ((numericValue !== undefined && numericValue !== null) || (textValue !== undefined && textValue !== null)) {
        throw new AuthError(
          'Tipos de datos incompatibles para la pregunta MULTIPLE_SELECT',
          400,
          'QUESTION_TYPE_MISMATCH'
        );
      }
      if (optionIds !== undefined) {
        if (!Array.isArray(optionIds)) {
          throw new AuthError('El campo optionIds debe ser un arreglo de identificadores', 400, 'INVALID_PAYLOAD');
        }
      }
      return { optionIds: optionIds || [] };
    }

    if (questionType === QuestionType.NUMERIC) {
      if ((optionIds !== undefined && Array.isArray(optionIds) && optionIds.length > 0) || (textValue !== undefined && textValue !== null)) {
        throw new AuthError(
          'Tipos de datos incompatibles para la pregunta NUMERIC',
          400,
          'QUESTION_TYPE_MISMATCH'
        );
      }
      if (numericValue !== undefined && numericValue !== null) {
        if (typeof numericValue !== 'number' || isNaN(numericValue) || !isFinite(numericValue)) {
          throw new AuthError('El valor numérico proporcionado no es válido', 400, 'INVALID_PAYLOAD');
        }
      }
      return { numericValue: numericValue ?? null };
    }

    if (questionType === QuestionType.OPEN_TEXT) {
      if ((optionIds !== undefined && Array.isArray(optionIds) && optionIds.length > 0) || (numericValue !== undefined && numericValue !== null)) {
        throw new AuthError(
          'Tipos de datos incompatibles para la pregunta OPEN_TEXT',
          400,
          'QUESTION_TYPE_MISMATCH'
        );
      }
      let parsedText: string | null = textValue ?? null;
      if (parsedText === '') {
        parsedText = null;
      }
      if (parsedText !== null) {
        if (typeof parsedText !== 'string') {
          throw new AuthError('El texto proporcionado no es válido', 400, 'INVALID_PAYLOAD');
        }
        if (parsedText.length > 50000) {
          throw new AuthError('El texto excede el límite máximo de 50,000 caracteres', 400, 'INVALID_PAYLOAD');
        }
      }
      return { textValue: parsedText };
    }

    throw new AuthError('Tipo de pregunta no soportado', 400, 'INVALID_PAYLOAD');
  }

  /**
   * Ejecuta el motor de autocalificación atómica para un Attempt.
   * Evalúa objetivas (MC, MS, TF, NUMERIC) y omisiones. Omite OPEN_TEXT (manual).
   */
  /**
   * Submits an IN_PROGRESS Attempt by a Student, enforces time limit (+30s grace period),
   * sets submittedAt, and invokes autoGrade.
   */
  public static async submitAttempt(
    attemptId: string,
    userId: string,
    userRole: Role
  ): Promise<AttemptDTO> {
    if (userRole !== Role.STUDENT) {
      throw new AuthError('Solo los estudiantes pueden enviar sus evaluaciones', 403, 'ONLY_STUDENTS_CAN_SUBMIT');
    }

    const [key1, key2] = this.getAttemptAdvisoryLockKeys(attemptId);
    let isExpired = false;

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Transactional advisory lock for this attemptId
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;

        // 2. Fetch Attempt with Assessment
        const attempt = await tx.attempt.findUnique({
          where: { id: attemptId },
          include: {
            assessment: true,
          },
        });

        if (!attempt) {
          throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
        }

        // 3. Authorization check
        if (attempt.studentId !== userId) {
          throw new AuthError('Acceso denegado: este intento no te pertenece', 403, 'ATTEMPT_ACCESS_DENIED');
        }

        // 4. Idempotency: If already GRADED or SUBMITTED, return mapped DTO
        if (attempt.status === AttemptStatus.GRADED || attempt.status === AttemptStatus.SUBMITTED) {
          const fullAttempt = await tx.attempt.findUnique({
            where: { id: attemptId },
            include: {
              assessment: { include: { course: true } },
              answers: { include: { answerOptions: true } },
            },
          });
          return this.mapToDTO(fullAttempt);
        }

        if (attempt.status !== AttemptStatus.IN_PROGRESS) {
          throw new AuthError('El intento no se encuentra en progreso y no se puede enviar', 400, 'ATTEMPT_NOT_IN_PROGRESS');
        }

        const now = new Date();
        const assessment = attempt.assessment;

        // 5. Time Limit Enforcement (+30s Grace Period)
        if (assessment.timeLimitMinutes !== null && assessment.timeLimitMinutes !== undefined) {
          const startedAtTime = new Date(attempt.startedAt).getTime();
          const hardExpirationTime = startedAtTime + assessment.timeLimitMinutes * 60 * 1000;
          const submitDeadlineTime = hardExpirationTime + 30 * 1000; // +30 seconds grace period

          if (now.getTime() > submitDeadlineTime) {
            // Attempt is expired beyond +30s grace period.
            // Set submittedAt = now and auto-grade the expired attempt inside this transaction:
            await tx.attempt.update({
              where: { id: attemptId },
              data: {
                submittedAt: now,
                updatedAt: now,
              },
            });
            await this.executeAutoGradeInTx(tx, attemptId, userId, userRole, now);
            isExpired = true;
            return null;
          }
        }

        // 6. Set submittedAt = server now
        await tx.attempt.update({
          where: { id: attemptId },
          data: {
            submittedAt: now,
            updatedAt: now,
          },
        });

        // 7. Execute autoGrade within the same transaction
        return await this.executeAutoGradeInTx(tx, attemptId, userId, userRole, now);
      },
      { timeout: 20000, maxWait: 10000 }
    );

    if (isExpired) {
      throw new AuthError('El tiempo límite para responder esta evaluación ha expirado', 400, 'ATTEMPT_EXPIRED');
    }

    return result!;

  }

  /**
   * Submits an expired Attempt programmatically (system auto-submit).
   */
  public static async submitExpiredAttempt(attemptId: string): Promise<AttemptDTO> {
    const [key1, key2] = this.getAttemptAdvisoryLockKeys(attemptId);

    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;

        const attempt = await tx.attempt.findUnique({
          where: { id: attemptId },
          include: { assessment: true },
        });

        if (!attempt) {
          throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
        }

        if (attempt.status === AttemptStatus.GRADED || attempt.status === AttemptStatus.SUBMITTED) {
          const fullAttempt = await tx.attempt.findUnique({
            where: { id: attemptId },
            include: {
              assessment: { include: { course: true } },
              answers: { include: { answerOptions: true } },
            },
          });
          return this.mapToDTO(fullAttempt);
        }

        const now = new Date();

        await tx.attempt.update({
          where: { id: attemptId },
          data: {
            submittedAt: now,
            updatedAt: now,
          },
        });

        return await this.executeAutoGradeInTx(tx, attemptId, attempt.studentId, Role.STUDENT, now);
      },
      { timeout: 20000, maxWait: 10000 }
    );
  }

  /**
   * Executes auto-grading on an Attempt within a database transaction.
   */
  public static async autoGradeAttempt(
    attemptId: string,
    userId: string,
    userRole: Role
  ): Promise<AttemptDTO> {
    const [key1, key2] = this.getAttemptAdvisoryLockKeys(attemptId);

    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;
        return await this.executeAutoGradeInTx(tx, attemptId, userId, userRole);
      },
      { timeout: 20000, maxWait: 10000 }
    );
  }

  /**
   * Core internal auto-grading logic executed inside a Prisma transaction.
   */
  private static async executeAutoGradeInTx(
    tx: Prisma.TransactionClient,
    attemptId: string,
    userId: string,
    userRole: Role,
    executionTime?: Date
  ): Promise<AttemptDTO> {
    const attempt = await tx.attempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            course: true,
            assessmentQuestions: {
              include: {
                question: {
                  include: {
                    options: {
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Authorization check
    if (userRole === Role.STUDENT && attempt.studentId !== userId) {
      throw new AuthError('Acceso denegado: este intento no te pertenece', 403, 'ATTEMPT_ACCESS_DENIED');
    }

    // Idempotency: If already GRADED or SUBMITTED, return mapped DTO
    if (attempt.status === AttemptStatus.GRADED || attempt.status === AttemptStatus.SUBMITTED) {
      return this.mapToDTO(attempt);
    }

    if ((attempt.status as string) === 'ABANDONED') {
      throw new AuthError('El intento fue abandonado y no se puede calificar', 400, 'ATTEMPT_NOT_GRADEABLE');
    }

    const now = executionTime || new Date();
    const assessment = attempt.assessment;
    const assessmentQuestions = assessment.assessmentQuestions;

    let totalMaxPoints = new Prisma.Decimal(0);
    let totalEarnedPoints = new Prisma.Decimal(0);
    let hasOpenTextQuestions = false;

    const existingAnswersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    for (const aq of assessmentQuestions) {
      const q = aq.question;
      const aqPoints = new Prisma.Decimal(aq.points);
      totalMaxPoints = totalMaxPoints.add(aqPoints);

      const existingAns = existingAnswersMap.get(q.id);

      if (q.type === QuestionType.OPEN_TEXT) {
        hasOpenTextQuestions = true;

        if (existingAns) {
          await tx.answer.update({
            where: { id: existingAns.id },
            data: {
              pointsEarned: null,
              isCorrect: null,
              gradedAt: null,
            },
          });
        } else {
          await tx.answer.create({
            data: {
              attemptId: attempt.id,
              questionId: q.id,
              numericValue: null,
              textValue: null,
              pointsEarned: null,
              isCorrect: null,
              gradedAt: null,
            },
          });
        }
        continue;
      }

      let isCorrect = false;

      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        const correctOptions = q.options.filter((o) => o.isCorrect);
        if (correctOptions.length !== 1) {
          throw new AuthError(
            `Configuración inválida en la pregunta MULTIPLE_CHOICE '${q.statement}': debe tener exactamente una opción correcta`,
            400,
            'QUESTION_INVALID_CONFIGURATION'
          );
        }
        const correctOptId = correctOptions[0].id;
        if (existingAns && existingAns.answerOptions && existingAns.answerOptions.length === 1) {
          if (existingAns.answerOptions[0].optionId === correctOptId) {
            isCorrect = true;
          }
        }
      } else if (q.type === QuestionType.TRUE_FALSE) {
        if (q.options.length !== 2) {
          throw new AuthError(
            `Configuración inválida en la pregunta TRUE_FALSE '${q.statement}': debe tener exactamente 2 opciones`,
            400,
            'QUESTION_INVALID_CONFIGURATION'
          );
        }
        const correctOptions = q.options.filter((o) => o.isCorrect);
        if (correctOptions.length !== 1) {
          throw new AuthError(
            `Configuración inválida en la pregunta TRUE_FALSE '${q.statement}': debe tener exactamente una opción correcta`,
            400,
            'QUESTION_INVALID_CONFIGURATION'
          );
        }
        const correctOptId = correctOptions[0].id;
        if (existingAns && existingAns.answerOptions && existingAns.answerOptions.length === 1) {
          if (existingAns.answerOptions[0].optionId === correctOptId) {
            isCorrect = true;
          }
        }
      } else if (q.type === QuestionType.MULTIPLE_SELECT) {
        const correctOptions = q.options.filter((o) => o.isCorrect);
        if (correctOptions.length === 0) {
          throw new AuthError(
            `Configuración inválida en la pregunta MULTIPLE_SELECT '${q.statement}': debe tener al menos una opción correcta`,
            400,
            'QUESTION_INVALID_CONFIGURATION'
          );
        }
        const correctSet = new Set(correctOptions.map((o) => o.id));
        const studentSet = new Set(existingAns ? existingAns.answerOptions.map((ao) => ao.optionId) : []);

        if (correctSet.size === studentSet.size && [...correctSet].every((id) => studentSet.has(id))) {
          isCorrect = true;
        }
      } else if (q.type === QuestionType.NUMERIC) {
        if (q.correctNumericValue === null || q.correctNumericValue === undefined) {
          throw new AuthError(
            `Configuración inválida en la pregunta NUMERIC '${q.statement}': carece de valor numérico correcto`,
            400,
            'QUESTION_INVALID_CONFIGURATION'
          );
        }

        if (existingAns && existingAns.numericValue !== null && existingAns.numericValue !== undefined) {
          const studentVal = new Prisma.Decimal(existingAns.numericValue);
          const targetVal = new Prisma.Decimal(q.correctNumericValue);
          const tolVal = new Prisma.Decimal(q.numericTolerance ?? 0.0001);

          const diff = studentVal.sub(targetVal).abs();
          if (diff.lte(tolVal)) {
            isCorrect = true;
          }
        }
      }

      const pointsEarned = isCorrect ? aqPoints : new Prisma.Decimal(0);
      totalEarnedPoints = totalEarnedPoints.add(pointsEarned);

      if (existingAns) {
        await tx.answer.update({
          where: { id: existingAns.id },
          data: {
            pointsEarned,
            isCorrect,
            gradedAt: now,
          },
        });
      } else {
        await tx.answer.create({
          data: {
            attemptId: attempt.id,
            questionId: q.id,
            numericValue: null,
            textValue: null,
            pointsEarned,
            isCorrect,
            gradedAt: now,
          },
        });
      }
    }

    let finalStatus: AttemptStatus;
    let finalScore: number | null = null;

    if (hasOpenTextQuestions) {
      finalStatus = AttemptStatus.SUBMITTED;
      finalScore = null;
    } else {
      finalStatus = AttemptStatus.GRADED;
      if (totalMaxPoints.gt(0)) {
        const rawScore = totalEarnedPoints.div(totalMaxPoints).mul(100);
        finalScore = Math.round(rawScore.toNumber() * 100) / 100;
      } else {
        finalScore = 0.0;
      }
    }

    const updatedAttempt = await tx.attempt.update({
      where: { id: attemptId },
      data: {
        status: finalStatus,
        score: finalScore !== null ? new Prisma.Decimal(finalScore) : null,
        updatedAt: now,
      },
      include: {
        assessment: {
          include: { course: true },
        },
        answers: {
          include: { answerOptions: true },
        },
      },
    });

    return this.mapToDTO(updatedAttempt);
  }

  /**
   * Maps an Attempt model to a sanitized AttemptDTO.
   */
  public static mapToDTO(attempt: any, userRole?: Role): AttemptDTO {
    const rawScore = attempt.score;
    const scoreNum = attempt.status === 'IN_PROGRESS' || rawScore === null || rawScore === undefined
      ? null
      : (typeof rawScore === 'object' && rawScore !== null && 'toNumber' in rawScore ? rawScore.toNumber() : Number(rawScore));

    const passingScoreRaw = attempt.assessment?.passingScore;
    const passingScoreNum = passingScoreRaw !== null && passingScoreRaw !== undefined
      ? (typeof passingScoreRaw === 'object' && 'toNumber' in passingScoreRaw ? passingScoreRaw.toNumber() : Number(passingScoreRaw))
      : null;

    const isPassed = scoreNum !== null && passingScoreNum !== null ? scoreNum >= passingScoreNum : null;

    const answersMapped: AttemptAnswerDTO[] | undefined = attempt.answers ? attempt.answers.map((ans: any) => {
      const peRaw = ans.pointsEarned;
      const peNum = peRaw !== null && peRaw !== undefined
        ? (typeof peRaw === 'object' && 'toNumber' in peRaw ? peRaw.toNumber() : Number(peRaw))
        : null;

      const includeGradingDetails = attempt.status === AttemptStatus.GRADED || ans.pointsEarned !== null;

      return {
        id: ans.id,
        attemptId: ans.attemptId,
        questionId: ans.questionId,
        optionIds: ans.answerOptions ? ans.answerOptions.map((ao: any) => ao.optionId) : [],
        numericValue: ans.numericValue !== null && ans.numericValue !== undefined
          ? (typeof ans.numericValue === 'object' && 'toNumber' in ans.numericValue ? ans.numericValue.toNumber() : Number(ans.numericValue))
          : null,
        textValue: ans.textValue || null,
        pointsEarned: includeGradingDetails ? peNum : null,
        isCorrect: includeGradingDetails ? (ans.isCorrect ?? null) : null,
        feedback: includeGradingDetails ? (ans.feedback || null) : null,
        gradedAt: includeGradingDetails ? (ans.gradedAt || null) : null,
        updatedAt: ans.gradedAt || attempt.updatedAt || attempt.startedAt,
      };
    }) : undefined;

    let mappedAssessment = undefined;
    if (attempt.assessment) {
      if (userRole === Role.STUDENT || !userRole) {
        mappedAssessment = AssessmentService.mapToStudentDTO(attempt.assessment);
      } else {
        mappedAssessment = AssessmentService.mapToDTO(attempt.assessment);
      }
    }

    return {
      id: attempt.id,
      studentId: attempt.studentId,
      assessmentId: attempt.assessmentId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt || null,
      score: scoreNum,
      isPassed,
      answers: answersMapped,
      assessment: mappedAssessment,
    };
  }

  /**
   * Lists Attempts for an Assessment with review metrics for ADMIN or TEACHER.
   */
  public static async getAssessmentAttemptsForReview(
    assessmentId: string,
    userId: string,
    userRole: Role,
    statusFilter?: string
  ): Promise<AssessmentAttemptItemDTO[]> {
    if (userRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden revisar intentos globales', 403, 'ONLY_TEACHERS_OR_ADMINS_CAN_REVIEW');
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        course: {
          include: {
            courseTeachers: true,
          },
        },
        assessmentQuestions: {
          include: { question: true },
        },
      },
    });

    if (!assessment) {
      throw new AuthError('Evaluación no encontrada', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (userRole === Role.TEACHER) {
      const isAssigned = assessment.course.courseTeachers.some((ct) => ct.teacherId === userId);
      if (!isAssigned) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'COURSE_ACCESS_DENIED');
      }
    }

    const whereClause: any = { assessmentId };
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }

    const attempts = await prisma.attempt.findMany({
      where: whereClause,
      include: {
        student: {
          include: { studentProfile: true },
        },
        answers: true,
      },
      orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
    });

    const openTextQuestions = assessment.assessmentQuestions.filter((aq) => aq.question.type === QuestionType.OPEN_TEXT);
    const totalOpenTextCount = openTextQuestions.length;
    const openTextQuestionIds = new Set(openTextQuestions.map((aq) => aq.questionId));

    const passingScoreRaw = assessment.passingScore;
    const passingScoreNum = passingScoreRaw !== null && passingScoreRaw !== undefined
      ? (typeof passingScoreRaw === 'object' && 'toNumber' in passingScoreRaw ? passingScoreRaw.toNumber() : Number(passingScoreRaw))
      : null;

    return attempts.map((att) => {
      const scoreNum = att.status === 'IN_PROGRESS' || att.score === null || att.score === undefined
        ? null
        : (typeof att.score === 'object' && att.score !== null && 'toNumber' in att.score ? att.score.toNumber() : Number(att.score));

      const isPassed = scoreNum !== null && passingScoreNum !== null ? scoreNum >= passingScoreNum : null;

      const openTextAnswers = att.answers.filter((ans) => openTextQuestionIds.has(ans.questionId));
      const gradedOpenTextCount = openTextAnswers.filter((ans) => ans.gradedAt !== null && ans.pointsEarned !== null).length;
      const pendingOpenTextCount = totalOpenTextCount - gradedOpenTextCount;

      return {
        id: att.id,
        studentId: att.studentId,
        studentName: att.student.name,
        studentNumber: att.student.studentProfile?.studentNumber || '',
        attemptNumber: att.attemptNumber,
        status: att.status,
        startedAt: att.startedAt,
        submittedAt: att.submittedAt || null,
        score: scoreNum,
        isPassed,
        totalOpenTextCount,
        pendingOpenTextCount,
        gradedOpenTextCount,
      };
    });
  }

  /**
   * Retrieves detailed review view of an Attempt for TEACHER / ADMIN.
   */
  public static async getAttemptReviewForTeacher(
    attemptId: string,
    userId: string,
    userRole: Role,
    txClient?: Prisma.TransactionClient
  ): Promise<TeacherAttemptDTO> {
    if (userRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden utilizar este endpoint de revisión', 403, 'ONLY_TEACHERS_OR_ADMINS_CAN_REVIEW');
    }

    const db = txClient || prisma;

    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          include: { studentProfile: true },
        },
        assessment: {
          include: {
            course: { include: { courseTeachers: true } },
            assessmentQuestions: {
              include: {
                question: {
                  include: { options: { orderBy: { order: 'asc' } } },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: {
          include: {
            answerOptions: {
              include: { option: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (userRole === Role.TEACHER) {
      const isAssigned = attempt.assessment.course.courseTeachers.some((ct) => ct.teacherId === userId);
      if (!isAssigned) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'ATTEMPT_ACCESS_DENIED');
      }
    }

    const scoreNum = attempt.status === 'IN_PROGRESS' || attempt.score === null || attempt.score === undefined
      ? null
      : (typeof attempt.score === 'object' && attempt.score !== null && 'toNumber' in attempt.score ? attempt.score.toNumber() : Number(attempt.score));

    const passingScoreRaw = attempt.assessment.passingScore;
    const passingScoreNum = passingScoreRaw !== null && passingScoreRaw !== undefined
      ? (typeof passingScoreRaw === 'object' && 'toNumber' in passingScoreRaw ? passingScoreRaw.toNumber() : Number(passingScoreRaw))
      : null;

    const isPassed = scoreNum !== null && passingScoreNum !== null ? scoreNum >= passingScoreNum : null;

    const existingAnswersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const assessmentQuestions = attempt.assessment.assessmentQuestions;

    let totalOpenTextCount = 0;
    let pendingOpenTextCount = 0;

    const answersMapped: TeacherAttemptAnswerDTO[] = assessmentQuestions.map((aq) => {
      const q = aq.question;
      const aqPoints = (typeof aq.points === 'object' && 'toNumber' in aq.points) ? aq.points.toNumber() : Number(aq.points);
      const ans = existingAnswersMap.get(q.id);

      let isPendingGrading = false;
      if (q.type === QuestionType.OPEN_TEXT) {
        totalOpenTextCount++;
        if (!ans || ans.gradedAt === null || ans.pointsEarned === null) {
          isPendingGrading = true;
          pendingOpenTextCount++;
        }
      }

      const peRaw = ans?.pointsEarned;
      const peNum = peRaw !== null && peRaw !== undefined
        ? (typeof peRaw === 'object' && 'toNumber' in peRaw ? peRaw.toNumber() : Number(peRaw))
        : null;

      const selectedOpts = ans?.answerOptions ? ans.answerOptions.map((ao) => ({
        id: ao.optionId,
        text: ao.option.text,
      })) : [];

      return {
        id: ans?.id || '',
        questionId: q.id,
        statement: q.statement,
        type: q.type,
        maxPoints: aqPoints,
        numericValue: ans?.numericValue !== null && ans?.numericValue !== undefined
          ? (typeof ans.numericValue === 'object' && 'toNumber' in ans.numericValue ? ans.numericValue.toNumber() : Number(ans.numericValue))
          : null,
        textValue: ans?.textValue || null,
        optionIds: ans?.answerOptions ? ans.answerOptions.map((ao) => ao.optionId) : [],
        selectedOptions: selectedOpts,
        pointsEarned: peNum,
        isCorrect: ans?.isCorrect ?? null,
        feedback: ans?.feedback || null,
        gradedAt: ans?.gradedAt || null,
        isPendingGrading,
      };
    });

    return {
      id: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.student.name,
      studentNumber: attempt.student.studentProfile?.studentNumber || '',
      assessmentId: attempt.assessmentId,
      assessmentTitle: attempt.assessment.title,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt || null,
      score: scoreNum,
      isPassed,
      totalOpenTextCount,
      pendingOpenTextCount,
      answers: answersMapped,
    };
  }

  /**
   * Manually grades an OPEN_TEXT answer and recalculates Attempt score and status atomically.
   */
  public static async gradeAnswer(
    attemptId: string,
    questionId: string,
    userId: string,
    userRole: Role,
    input: GradeAnswerInput,
    rawBodyKeys: string[]
  ): Promise<TeacherAttemptDTO> {
    if (userRole === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden evaluar respuestas', 403, 'ONLY_TEACHERS_OR_ADMINS_CAN_GRADE');
    }

    const forbiddenFields = ['isCorrect', 'gradedAt', 'score', 'status', 'maxPoints', 'correctNumericValue', 'numericTolerance', 'submittedAt', 'startedAt'];
    for (const key of rawBodyKeys) {
      if (forbiddenFields.includes(key)) {
        throw new AuthError(`El campo '${key}' está protegido y no se puede enviar desde el cliente`, 400, 'INVALID_PAYLOAD');
      }
    }

    const [key1, key2] = this.getAttemptAdvisoryLockKeys(attemptId);

    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}, ${key2})`;

        const attempt = await tx.attempt.findUnique({
          where: { id: attemptId },
          include: {
            student: { include: { studentProfile: true } },
            assessment: {
              include: {
                course: { include: { courseTeachers: true } },
                assessmentQuestions: {
                  include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
                  orderBy: { order: 'asc' },
                },
              },
            },
            answers: {
              include: {
                answerOptions: { include: { option: true } },
              },
            },
          },
        });

        if (!attempt) {
          throw new AuthError('Intento no encontrado', 404, 'ATTEMPT_NOT_FOUND');
        }

        if (userRole === Role.TEACHER) {
          const isAssigned = attempt.assessment.course.courseTeachers.some((ct) => ct.teacherId === userId);
          if (!isAssigned) {
            throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'ATTEMPT_ACCESS_DENIED');
          }
        }

        if (attempt.status === AttemptStatus.IN_PROGRESS) {
          throw new AuthError('El intento se encuentra en progreso y no se puede calificar manualmente', 400, 'ATTEMPT_NOT_GRADEABLE');
        }

        if ((attempt.status as string) === 'ABANDONED') {
          throw new AuthError('El intento fue abandonado y no se puede calificar', 400, 'ATTEMPT_NOT_GRADEABLE');
        }

        if (attempt.assessment.course.status === CourseStatus.ARCHIVED) {
          throw new AuthError('El curso se encuentra archivado y no permite modificaciones', 400, 'COURSE_ARCHIVED');
        }

        const aq = attempt.assessment.assessmentQuestions.find((item) => item.questionId === questionId);
        if (!aq) {
          throw new AuthError('La pregunta no pertenece a esta evaluación', 400, 'QUESTION_NOT_IN_ASSESSMENT');
        }

        if (aq.question.type !== QuestionType.OPEN_TEXT) {
          throw new AuthError('Solo las preguntas de tipo OPEN_TEXT admiten calificación manual', 400, 'QUESTION_NOT_MANUALLY_GRADEABLE');
        }

        if (input.pointsEarned === undefined || input.pointsEarned === null || typeof input.pointsEarned !== 'number' || isNaN(input.pointsEarned) || !isFinite(input.pointsEarned)) {
          throw new AuthError('El campo pointsEarned debe ser un número válido', 400, 'INVALID_PAYLOAD');
        }

        const pointsVal = new Prisma.Decimal(input.pointsEarned);
        const maxPointsVal = new Prisma.Decimal(aq.points);

        if (pointsVal.lt(0) || pointsVal.gt(maxPointsVal)) {
          throw new AuthError(`El puntaje otorgado debe estar entre 0.00 y ${maxPointsVal.toString()}`, 400, 'INVALID_PAYLOAD');
        }

        let feedbackText: string | null = null;
        if (input.feedback !== undefined && input.feedback !== null) {
          if (typeof input.feedback !== 'string') {
            throw new AuthError('El campo feedback debe ser una cadena de texto', 400, 'INVALID_PAYLOAD');
          }
          feedbackText = input.feedback.trim();
          if (feedbackText === '') {
            feedbackText = null;
          }
          if (feedbackText !== null && feedbackText.length > 10000) {
            throw new AuthError('El feedback excede la longitud máxima de 10,000 caracteres', 400, 'INVALID_PAYLOAD');
          }
        }

        const isCorrect = pointsVal.equals(maxPointsVal);
        const now = new Date();

        const existingAns = attempt.answers.find((a) => a.questionId === questionId);
        if (existingAns) {
          await tx.answer.update({
            where: { id: existingAns.id },
            data: {
              pointsEarned: pointsVal,
              isCorrect,
              feedback: feedbackText,
              gradedAt: now,
            },
          });
        } else {
          await tx.answer.create({
            data: {
              attemptId: attempt.id,
              questionId: questionId,
              numericValue: null,
              textValue: null,
              pointsEarned: pointsVal,
              isCorrect,
              feedback: feedbackText,
              gradedAt: now,
            },
          });
        }

        const updatedAnswers = await tx.answer.findMany({
          where: { attemptId: attempt.id },
          include: { answerOptions: { include: { option: true } } },
        });

        const answersMap = new Map(updatedAnswers.map((a) => [a.questionId, a]));
        let totalMaxPoints = new Prisma.Decimal(0);
        let totalEarnedPoints = new Prisma.Decimal(0);
        let hasPendingOpenText = false;

        for (const item of attempt.assessment.assessmentQuestions) {
          const q = item.question;
          const aqP = new Prisma.Decimal(item.points);
          totalMaxPoints = totalMaxPoints.add(aqP);

          const ans = answersMap.get(q.id);

          if (q.type === QuestionType.OPEN_TEXT) {
            if (!ans || ans.gradedAt === null || ans.pointsEarned === null) {
              hasPendingOpenText = true;
            } else {
              totalEarnedPoints = totalEarnedPoints.add(ans.pointsEarned);
            }
          } else {
            if (ans && ans.pointsEarned) {
              totalEarnedPoints = totalEarnedPoints.add(ans.pointsEarned);
            }
          }
        }

        let finalStatus: AttemptStatus;
        let finalScore: number | null = null;

        if (hasPendingOpenText) {
          finalStatus = AttemptStatus.SUBMITTED;
          finalScore = null;
        } else {
          finalStatus = AttemptStatus.GRADED;
          if (totalMaxPoints.gt(0)) {
            const rawScore = totalEarnedPoints.div(totalMaxPoints).mul(100);
            finalScore = Math.round(rawScore.toNumber() * 100) / 100;
          } else {
            finalScore = 0.0;
          }
        }

        await tx.attempt.update({
          where: { id: attemptId },
          data: {
            status: finalStatus,
            score: finalScore !== null ? new Prisma.Decimal(finalScore) : null,
            updatedAt: now,
          },
        });

        if (attempt.assessment.course.status === CourseStatus.FINISHED) {
          await GradebookService.recalculateAndPersistCourseFinalGrades(attempt.assessment.courseId, tx);
        }

        return await this.getAttemptReviewForTeacher(attemptId, userId, userRole, tx);
      },
      { timeout: 60000, maxWait: 10000 }
    );
  }
}

