import { Router } from 'express';
import { Role } from '@prisma/client';
import { AssessmentController } from '../controllers/assessment.controller';
import { AttemptController } from '../controllers/attempt.controller';
import { AttemptGrantController } from '../controllers/attempt-grant.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';

const router = Router();

// GET /api/assessments/:assessmentId/my-attempt-summary (STUDENT)
router.get(
  '/:assessmentId/my-attempt-summary',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  AttemptGrantController.getMyAttemptSummary
);

// POST /api/assessments/:assessmentId/students/:studentId/attempt-grants (ADMIN, TEACHER)
router.post(
  '/:assessmentId/students/:studentId/attempt-grants',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptGrantController.createGrant
);

// GET /api/assessments/:assessmentId/students-attempt-summary (ADMIN, TEACHER)
router.get(
  '/:assessmentId/students-attempt-summary',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptGrantController.getAssessmentStudentsAttemptSummary
);

// GET /api/assessments/:assessmentId/students/:studentId/attempt-grants (ADMIN, TEACHER)
router.get(
  '/:assessmentId/students/:studentId/attempt-grants',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptGrantController.getStudentGrantHistory
);

// GET /api/assessments/:assessmentId (ADMIN, TEACHER, STUDENT)
router.get(
  '/:assessmentId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  AssessmentController.getAssessmentDetail
);

// PUT /api/assessments/:assessmentId (ADMIN, TEACHER)
router.put(
  '/:assessmentId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.updateAssessment
);

// DELETE /api/assessments/:assessmentId (ADMIN, TEACHER)
router.delete(
  '/:assessmentId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.deleteAssessment
);

// PATCH /api/assessments/:assessmentId/publication (ADMIN, TEACHER)
router.patch(
  '/:assessmentId/publication',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.togglePublication
);

// POST /api/assessments/:assessmentId/questions (ADMIN, TEACHER)
router.post(
  '/:assessmentId/questions',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.addQuestion
);

// DELETE /api/assessments/:assessmentId/questions/:questionId (ADMIN, TEACHER)
router.delete(
  '/:assessmentId/questions/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.removeQuestion
);

// PUT /api/assessments/:assessmentId/questions/:questionId (ADMIN, TEACHER)
router.put(
  '/:assessmentId/questions/:questionId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.updateQuestionPoints
);

// PATCH /api/assessments/:assessmentId/questions/reorder (ADMIN, TEACHER)
router.patch(
  '/:assessmentId/questions/reorder',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.reorderQuestions
);

// POST /api/assessments/:assessmentId/attempts (STUDENT only)
router.post(
  '/:assessmentId/attempts',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  AttemptController.startAttempt
);

// GET /api/assessments/:assessmentId/attempts (ADMIN, TEACHER review)
router.get(
  '/:assessmentId/attempts',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AttemptController.getAssessmentAttempts
);

// POST /api/assessments/:assessmentId/generate-crossword-preview (ADMIN, TEACHER)
router.post(
  '/:assessmentId/generate-crossword-preview',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  AssessmentController.generateCrosswordPreview
);

export default router;
