import { Router } from 'express';
import { Role } from '@prisma/client';
import { AttemptController } from '../controllers/attempt.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';

const router = Router();

// GET /api/attempts/:attemptId (STUDENT, TEACHER, ADMIN)
router.get(
  '/:attemptId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  AttemptController.getAttempt
);

// PUT /api/attempts/:attemptId/answers/:questionId (STUDENT only)
router.put(
  '/:attemptId/answers/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  AttemptController.saveAnswer
);

// POST /api/attempts/:attemptId/submit (STUDENT only)
router.post(
  '/:attemptId/submit',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  AttemptController.submitAttempt
);

// POST /api/attempts/:attemptId/grade (ADMIN, TEACHER dev/testing)
router.post(
  '/:attemptId/grade',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptController.autoGrade
);

// GET /api/attempts/:attemptId/review (ADMIN, TEACHER only)
router.get(
  '/:attemptId/review',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptController.getAttemptReview
);

// PUT /api/attempts/:attemptId/answers/:questionId/grade (ADMIN, TEACHER only)
router.put(
  '/:attemptId/answers/:questionId/grade',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptController.gradeAnswer
);

export default router;
