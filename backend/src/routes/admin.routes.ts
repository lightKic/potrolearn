import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';

const router = Router();

// POST /api/admin/teachers
router.post(
  '/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.createTeacher
);

// GET /api/admin/teachers
router.get(
  '/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.getTeachers
);

// POST /api/admin/users
router.post(
  '/users',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.createUser
);

// GET /api/admin/users
router.get(
  '/users',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.getUsers
);

// GET /api/admin/users/:userId
router.get(
  '/users/:userId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.getUserById
);

// PUT /api/admin/users/:userId
router.put(
  '/users/:userId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.updateUser
);

// POST /api/admin/users/:userId/reset-access
router.post(
  '/users/:userId/reset-access',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  AdminController.resetUserAccess
);

export default router;
