import { Request, Response } from 'express';
import { AssessmentService } from '../services/assessment.service';
import { AuthError } from '../types/auth.types';

export class AssessmentController {
  public static async createAssessment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const assessment = await AssessmentService.createAssessment(courseId, req.user.id, req.user.role, req.body);
      res.status(201).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async getCourseAssessments(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const assessments = await AssessmentService.getCourseAssessments(courseId, req.user.id, req.user.role);
      res.status(200).json({ data: assessments });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async getAssessmentDetail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const assessment = await AssessmentService.getAssessmentDetail(assessmentId, req.user.id, req.user.role);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async updateAssessment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const assessment = await AssessmentService.updateAssessment(assessmentId, req.user.id, req.user.role, req.body);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async deleteAssessment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      await AssessmentService.deleteAssessment(assessmentId, req.user.id, req.user.role);
      res.status(200).json({ data: { message: 'Assessment eliminado exitosamente' } });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async togglePublication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const { isPublished } = req.body;
      if (typeof isPublished !== 'boolean') {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'isPublished debe ser un valor booleano' } });
        return;
      }
      const assessment = await AssessmentService.togglePublication(assessmentId, req.user.id, req.user.role, isPublished);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async addQuestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const assessment = await AssessmentService.addQuestionToAssessment(assessmentId, req.user.id, req.user.role, req.body);
      res.status(201).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async removeQuestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId, questionId } = req.params;
      const assessment = await AssessmentService.removeQuestionFromAssessment(assessmentId, questionId, req.user.id, req.user.role);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async updateQuestionPoints(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId, questionId } = req.params;
      const { points } = req.body;
      const assessment = await AssessmentService.updateAssessmentQuestionPoints(assessmentId, questionId, req.user.id, req.user.role, points);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async reorderQuestions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const assessment = await AssessmentService.reorderAssessmentQuestions(assessmentId, req.user.id, req.user.role, req.body);
      res.status(200).json({ data: assessment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async generateCrosswordPreview(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { assessmentId } = req.params;
      const { seed } = req.body;
      const result = await AssessmentService.generateCrosswordPreview(assessmentId, req.user.id, req.user.role, seed);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }
}
