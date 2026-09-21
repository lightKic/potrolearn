import { Request, Response } from 'express';
import { AttemptGrantService } from '../services/attempt-grant.service';
import { AuthError } from '../types/auth.types';

export class AttemptGrantController {
  /**
   * Endpoint HTTP: POST /api/assessments/:assessmentId/students/:studentId/attempt-grants
   * Concede intentos adicionales a un alumno (ADMIN o TEACHER asignado).
   */
  public static async createGrant(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId, studentId } = req.params;
      const grantedById = req.user!.id;
      const grantedByRole = req.user!.role;

      const result = await AttemptGrantService.createGrant(
        assessmentId,
        studentId,
        grantedById,
        grantedByRole,
        req.body
      );

      res.status(201).json({
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
   * Endpoint HTTP: GET /api/assessments/:assessmentId/my-attempt-summary
   * Obtiene el resumen de intentos propios del estudiante autenticado.
   */
  public static async getMyAttemptSummary(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const studentId = req.user!.id;
      const role = req.user!.role;

      const result = await AttemptGrantService.getStudentAttemptSummary(
        assessmentId,
        studentId,
        studentId,
        role
      );

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
   * Endpoint HTTP: GET /api/assessments/:assessmentId/students-attempt-summary
   * Lista el resumen de intentos de todos los alumnos de la evaluación (ADMIN o TEACHER).
   */
  public static async getAssessmentStudentsAttemptSummary(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const requesterId = req.user!.id;
      const requesterRole = req.user!.role;

      const result = await AttemptGrantService.getAssessmentStudentsAttemptSummary(
        assessmentId,
        requesterId,
        requesterRole
      );

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
   * Endpoint HTTP: GET /api/assessments/:assessmentId/students/:studentId/attempt-grants
   * Obtiene el historial de grants otorgados a un estudiante (ADMIN o TEACHER).
   */
  public static async getStudentGrantHistory(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId, studentId } = req.params;
      const requesterId = req.user!.id;
      const requesterRole = req.user!.role;

      const result = await AttemptGrantService.getStudentGrantHistory(
        assessmentId,
        studentId,
        requesterId,
        requesterRole
      );

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
}
