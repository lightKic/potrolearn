import { Router } from 'express';
import { Role } from '@prisma/client';
import { QuestionController } from '../controllers/question.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';

const router = Router();

// GET /api/questions (ADMIN, TEACHER)
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.getQuestions
);

// POST /api/questions (ADMIN, TEACHER)
router.post(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.createQuestion
);

// GET /api/questions/:questionId (ADMIN, TEACHER)
router.get(
  '/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.getQuestionDetail
);

// PUT /api/questions/:questionId (ADMIN, TEACHER)
router.put(
  '/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.updateQuestion
);

// DELETE /api/questions/:questionId (ADMIN, TEACHER)
router.delete(
  '/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.deleteQuestion
);

// POST /api/questions/:questionId/options (ADMIN, TEACHER)
router.post(
  '/:questionId/options',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.createOption
);

// PUT /api/questions/:questionId/options/:optionId (ADMIN, TEACHER)
router.put(
  '/:questionId/options/:optionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.updateOption
);

// DELETE /api/questions/:questionId/options/:optionId (ADMIN, TEACHER)
router.delete(
  '/:questionId/options/:optionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  QuestionController.deleteOption
);

export default router;
