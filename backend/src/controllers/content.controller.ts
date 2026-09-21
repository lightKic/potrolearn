import { Request, Response } from 'express';
import { ContentService } from '../services/content.service';
import { AuthError } from '../types/auth.types';

export class ContentController {
  /**
   * GET /api/courses/:courseId/content
   */
  public static async getCourseContent(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const content = await ContentService.getCourseContent(courseId, req.user);
      res.status(200).json({ data: content });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId/modules
   */
  public static async getCourseModules(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const modules = await ContentService.getCourseModules(courseId, req.user);
      res.status(200).json({ data: modules });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/modules
   */
  public static async createModule(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const { title, description, isPublished, scheduledPublishAt } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const moduleObj = await ContentService.createModule(courseId, { title, description, isPublished, scheduledPublishAt }, req.user);
      res.status(201).json({ data: moduleObj });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/courses/:courseId/modules/:moduleId
   */
  public static async updateModule(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      const { title, description, isPublished, scheduledPublishAt } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const updatedModule = await ContentService.updateModule(courseId, moduleId, { title, description, isPublished, scheduledPublishAt }, req.user);
      res.status(200).json({ data: updatedModule });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PATCH /api/courses/:courseId/modules/reorder
   */
  public static async reorderModules(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const { moduleIds } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const modules = await ContentService.reorderModules(courseId, moduleIds, req.user);
      res.status(200).json({ data: modules });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId/modules/:moduleId/lessons
   */
  public static async getModuleLessons(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const lessons = await ContentService.getModuleLessons(courseId, moduleId, req.user);
      res.status(200).json({ data: lessons });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/modules/:moduleId/lessons
   */
  public static async createLesson(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      const { title, description, content, isPublished, scheduledPublishAt } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const lesson = await ContentService.createLesson(courseId, moduleId, { title, description, content, isPublished, scheduledPublishAt }, req.user);
      res.status(201).json({ data: lesson });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId
   */
  public static async updateLesson(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId, lessonId } = req.params;
      const { title, description, content, isPublished, scheduledPublishAt } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const updatedLesson = await ContentService.updateLesson(courseId, moduleId, lessonId, { title, description, content, isPublished, scheduledPublishAt }, req.user);
      res.status(200).json({ data: updatedLesson });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PATCH /api/courses/:courseId/modules/:moduleId/lessons/reorder
   */
  public static async reorderLessons(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      const { lessonIds } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const lessons = await ContentService.reorderLessons(courseId, moduleId, lessonIds, req.user);
      res.status(200).json({ data: lessons });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId/modules/:moduleId/lessons/:lessonId
   */
  public static async getLessonDetail(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId, lessonId } = req.params;
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const lesson = await ContentService.getLessonDetail(courseId, moduleId, lessonId, req.user);
      res.status(200).json({ data: lesson });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/progress
   */
  public static async toggleLessonProgress(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId, lessonId } = req.params;
      const { completed } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const result = await ContentService.toggleLessonProgress(courseId, moduleId, lessonId, !!completed, req.user);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/courses/:courseId/modules/:moduleId/schedule
   */
  public static async scheduleModuleBatch(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      const { moduleScheduledPublishAt, contents } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const result = await ContentService.scheduleModuleBatch(courseId, moduleId, { moduleScheduledPublishAt, contents }, req.user);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/modules/:moduleId/publish-now
   */
  public static async publishModuleNow(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, moduleId } = req.params;
      const { publishModuleOnly, publishContentIds } = req.body || {};
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const result = await ContentService.publishModuleNow(courseId, moduleId, { publishModuleOnly, publishContentIds }, req.user);
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
