import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { AuthError } from '../types/auth.types';

export class NotificationController {
  /**
   * GET /api/notifications
   */
  public static async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const notifications = await NotificationService.getUserNotifications(userId, limit);

      res.status(200).json({ data: notifications });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/notifications/unread-count
   */
  public static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
        return;
      }

      const count = await NotificationService.getUnreadCount(userId);
      res.status(200).json({ data: { count } });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  public static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
        return;
      }

      const { id } = req.params;
      const updated = await NotificationService.markAsRead(userId, id);
      res.status(200).json({ data: updated });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   */
  public static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
        return;
      }

      const result = await NotificationService.markAllAsRead(userId);
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
