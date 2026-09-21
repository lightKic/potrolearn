import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export class NotificationService {
  /**
   * Obtiene las notificaciones del usuario autenticado ordenadas por createdAt DESC.
   */
  public static async getUserNotifications(userId: string, limit: number = 30) {
    if (!userId) {
      throw new AuthError('Usuario no especificado', 400, 'USER_ID_REQUIRED');
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return notifications;
  }

  /**
   * Obtiene la cantidad de notificaciones no leídas del usuario.
   */
  public static async getUnreadCount(userId: string): Promise<number> {
    if (!userId) {
      throw new AuthError('Usuario no especificado', 400, 'USER_ID_REQUIRED');
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    return count;
  }

  /**
   * Marca una notificación específica del usuario como leída.
   */
  public static async markAsRead(userId: string, notificationId: string) {
    if (!userId) {
      throw new AuthError('Usuario no especificado', 400, 'USER_ID_REQUIRED');
    }

    if (!notificationId) {
      throw new AuthError('Identificador de notificación no válido', 400, 'INVALID_NOTIFICATION_ID');
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AuthError('Notificación no encontrada', 404, 'NOTIFICATION_NOT_FOUND');
    }

    if (notification.userId !== userId) {
      throw new AuthError('No tienes permiso para acceder a esta notificación', 403, 'NOTIFICATION_FORBIDDEN');
    }

    if (notification.readAt) {
      return notification;
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Marca todas las notificaciones no leídas del usuario como leídas.
   */
  public static async markAllAsRead(userId: string) {
    if (!userId) {
      throw new AuthError('Usuario no especificado', 400, 'USER_ID_REQUIRED');
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Crea una nueva notificación en la BD.
   * Evita duplicados recientes (mismo userId, type, title, message dentro de los últimos 5 minutos).
   */
  public static async createNotification(input: CreateNotificationInput) {
    const { userId, type, title, message, link } = input;

    if (!userId || !type || !title || !message) {
      return null;
    }

    // Verificar duplicados en los últimos 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingDuplicate = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        title,
        message,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (existingDuplicate) {
      return existingDuplicate;
    }

    return prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    });
  }
}
