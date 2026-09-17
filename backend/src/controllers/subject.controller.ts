import { Request, Response } from 'express';
import { SubjectService } from '../services/subject.service';
import { AuthError } from '../types/auth.types';

export class SubjectController {
  /**
   * GET /api/subjects
   */
  public static async getAllSubjects(_req: Request, res: Response): Promise<void> {
    try {
      const subjects = await SubjectService.getAllSubjects();
      res.status(200).json({ data: subjects });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/subjects/:subjectId
   */
  public static async getSubjectById(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId } = req.params;
      const subject = await SubjectService.getSubjectById(subjectId);
      res.status(200).json({ data: subject });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/subjects
   */
  public static async createSubject(req: Request, res: Response): Promise<void> {
    try {
      const { code, name, description } = req.body || {};
      const subject = await SubjectService.createSubject({ code, name, description });
      res.status(201).json({ data: subject });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/subjects/:subjectId
   */
  public static async updateSubject(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId } = req.params;
      const { code, name, description, isActive } = req.body || {};
      const subject = await SubjectService.updateSubject(subjectId, { code, name, description, isActive });
      res.status(200).json({ data: subject });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }
}
