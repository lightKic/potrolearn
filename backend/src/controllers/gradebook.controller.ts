import { Request, Response } from 'express';
import { GradebookService } from '../services/gradebook.service';
import { AuthError } from '../types/auth.types';

export class GradebookController {
  /**
   * Endpoint HTTP: GET /api/courses/:courseId/gradebook
   * Obtiene la matriz/sábana de calificaciones para docentes asignados y administradores.
   */
  public static async getTeacherGradebook(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const statusFilter = (req.query.statusFilter || req.query.status) as string | undefined;
      const search = req.query.search as string | undefined;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await GradebookService.getTeacherGradebook(courseId, userId, userRole, statusFilter, search);

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
   * Endpoint HTTP: GET /api/courses/:courseId/my-grades
   * Obtiene la boleta individual del estudiante autenticado (Protección anti-IDOR).
   */
  public static async getStudentGrades(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const studentId = req.user!.id; // Exclusivamente req.user.id

      const result = await GradebookService.getStudentGrades(courseId, studentId);

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
