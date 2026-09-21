import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';

const router = Router();

// GET /api/notifications
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  NotificationController.getUserNotifications
);

// GET /api/notifications/unread-count
router.get(
  '/unread-count',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  NotificationController.getUnreadCount
);

// PATCH /api/notifications/read-all
router.patch(
  '/read-all',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  NotificationController.markAllAsRead
);

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  NotificationController.markAsRead
);

export default router;
