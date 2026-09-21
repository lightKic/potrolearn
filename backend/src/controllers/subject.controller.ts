import { Request, Response } from 'express';
import { SubjectService } from '../services/subject.service';
import { AuthError } from '../types/auth.types';

export class SubjectController {
  /**
   * GET /api/subjects
   */
  public static async getAllSubjects(req: Request, res: Response): Promise<void> {
    try {
      const subjects = await SubjectService.getAllSubjects(req.user);
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

  /**
   * GET /api/subjects/:subjectId/teachers
   */
  public static async getSubjectTeachers(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId } = req.params;
      const teachers = await SubjectService.getSubjectTeachers(subjectId);
      res.status(200).json({ data: teachers });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/subjects/:subjectId/teachers (ADMIN únicamente)
   */
  public static async assignTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId } = req.params;
      const { teacherId } = req.body || {};
      const assignment = await SubjectService.assignTeacherToSubject(subjectId, teacherId);
      res.status(201).json({ data: assignment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * DELETE /api/subjects/:subjectId/teachers/:teacherId (ADMIN únicamente)
   */
  public static async removeTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId, teacherId } = req.params;
      const result = await SubjectService.removeTeacherFromSubject(subjectId, teacherId);
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
