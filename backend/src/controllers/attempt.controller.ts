import { Request, Response } from 'express';
import { AttemptService } from '../services/attempt.service';
import { AuthError } from '../types/auth.types';

export class AttemptController {
  /**
   * Endpoint HTTP: POST /api/assessments/:assessmentId/attempts
   * Inicia un nuevo intento o reanuda un intento IN_PROGRESS para un estudiante autenticado.
   */
  public static async startAttempt(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const studentId = req.user!.id;

      const result = await AttemptService.startOrResumeAttempt(assessmentId, studentId);
      
      res.status(201).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: GET /api/attempts/:attemptId
   * Obtiene la información detallada y sanitizada de un intento por su ID.
   */
  public static async getAttempt(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.getAttemptById(attemptId, userId, userRole);

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: PUT /api/attempts/:attemptId/answers/:questionId
   * Guarda o actualiza incrementalmente la respuesta de un estudiante.
   */
  public static async saveAnswer(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId, questionId } = req.params;
      const studentId = req.user!.id;
      const rawBodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];

      const result = await AttemptService.saveAnswer(attemptId, questionId, studentId, req.body, rawBodyKeys);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/attempts/:attemptId/submit
   * Envía un intento por parte de un estudiante y ejecuta el autocalificado.
   */
  public static async submitAttempt(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const studentId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.submitAttempt(attemptId, studentId, userRole);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/attempts/:attemptId/crossword/check
   * Valida en tiempo real y sanitizadamente el estado de las palabras de un crucigrama.
   */
  public static async checkCrosswordValidation(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const studentId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.checkCrosswordValidation(
        attemptId,
        studentId,
        userRole,
        req.body?.answers
      );

      res.status(200).json({
        success: true,
        data: {
          validationMap: result.validationMap,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/attempts/:attemptId/abandon
   * Abandona explícitamente un intento IN_PROGRESS por parte de un estudiante.
   */
  public static async abandonAttempt(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const studentId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.abandonAttempt(attemptId, studentId, userRole);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP (Dev/Testing): POST /api/attempts/:attemptId/grade
   * Ejecuta el autocalificado del intento.
   */
  public static async autoGrade(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.autoGradeAttempt(attemptId, userId, userRole);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: GET /api/assessments/:assessmentId/attempts
   * Lista los intentos de una evaluación para revisión de docentes/admin.
   */
  public static async getAssessmentAttempts(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const statusFilter = req.query.status as string | undefined;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.getAssessmentAttemptsForReview(assessmentId, userId, userRole, statusFilter);

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: GET /api/attempts/:attemptId/review
   * Obtiene la vista detallada de revisión de un intento para docentes/admin.
   */
  public static async getAttemptReview(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await AttemptService.getAttemptReviewForTeacher(attemptId, userId, userRole);

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: PUT /api/attempts/:attemptId/answers/:questionId/grade
   * Califica manualmente una respuesta OPEN_TEXT de un intento.
   */
  public static async gradeAnswer(req: Request, res: Response): Promise<void> {
    try {
      const { attemptId, questionId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const rawBodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];

      const result = await AttemptService.gradeAnswer(attemptId, questionId, userId, userRole, req.body, rawBodyKeys);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }
}
