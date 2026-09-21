import { Router } from 'express';
import { Role } from '@prisma/client';
import { SubjectController } from '../controllers/subject.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';

const router = Router();

// GET /api/subjects (ADMIN, TEACHER)
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  SubjectController.getAllSubjects
);

// POST /api/subjects (ADMIN)
router.post(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  SubjectController.createSubject
);

// GET /api/subjects/:subjectId (ADMIN, TEACHER)
router.get(
  '/:subjectId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  SubjectController.getSubjectById
);

// PUT /api/subjects/:subjectId (ADMIN)
router.put(
  '/:subjectId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  SubjectController.updateSubject
);

// GET /api/subjects/:subjectId/teachers (ADMIN, TEACHER)
router.get(
  '/:subjectId/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  SubjectController.getSubjectTeachers
);

// POST /api/subjects/:subjectId/teachers (ADMIN únicamente)
router.post(
  '/:subjectId/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  SubjectController.assignTeacher
);

// DELETE /api/subjects/:subjectId/teachers/:teacherId (ADMIN únicamente)
router.delete(
  '/:subjectId/teachers/:teacherId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  SubjectController.removeTeacher
);

export default router;
