import { Request, Response } from 'express';
import { QuestionService } from '../services/question.service';
import { AuthError } from '../types/auth.types';

export class QuestionController {
  public static async createQuestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const question = await QuestionService.createQuestion(req.user.id, req.user.role, req.body);
      res.status(201).json({ data: question });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async getQuestions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
      const questions = await QuestionService.getQuestions(req.user.id, req.user.role, subjectId);
      res.status(200).json({ data: questions });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async getQuestionDetail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId } = req.params;
      const question = await QuestionService.getQuestionDetail(questionId, req.user.id, req.user.role);
      res.status(200).json({ data: question });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async updateQuestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId } = req.params;
      const question = await QuestionService.updateQuestion(questionId, req.user.id, req.user.role, req.body);
      res.status(200).json({ data: question });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async deleteQuestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId } = req.params;
      await QuestionService.deleteQuestion(questionId, req.user.id, req.user.role);
      res.status(200).json({ data: { message: 'Pregunta eliminada exitosamente' } });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async createOption(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId } = req.params;
      const option = await QuestionService.createOption(questionId, req.user.id, req.user.role, req.body);
      res.status(201).json({ data: option });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async updateOption(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId, optionId } = req.params;
      const option = await QuestionService.updateOption(questionId, optionId, req.user.id, req.user.role, req.body);
      res.status(200).json({ data: option });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  public static async deleteOption(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { questionId, optionId } = req.params;
      await QuestionService.deleteOption(questionId, optionId, req.user.id, req.user.role);
      res.status(200).json({ data: { message: 'Opción eliminada exitosamente' } });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }
}
