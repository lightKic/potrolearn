import { Router } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import { AuthController } from '../controllers/auth.controller';
import { CourseController } from '../controllers/course.controller';
import { ContentController } from '../controllers/content.controller';
import { AssessmentController } from '../controllers/assessment.controller';
import { GradebookController } from '../controllers/gradebook.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { requirePasswordChanged } from '../middlewares/require-password-changed';
import { requireRole } from '../middlewares/require-role';
import { requireCourseTeacher } from '../middlewares/require-course-teacher';

const router = Router();

// GET /api/courses (ADMIN, TEACHER, STUDENT)
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  CourseController.getCourses
);

// POST /api/courses (ADMIN, TEACHER)
router.post(
  '/',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  CourseController.createCourse
);

// GET /api/courses/:courseId (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  CourseController.getCourseDetail
);

// PUT /api/courses/:courseId (ADMIN, TEACHER asignado)
router.put(
  '/:courseId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  CourseController.updateCourse
);

// PATCH /api/courses/:courseId/status (ADMIN, TEACHER asignado)
router.patch(
  '/:courseId/status',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  CourseController.changeCourseStatus
);

// GET /api/courses/:courseId/teachers (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  CourseController.getCourseTeachers
);

// POST /api/courses/:courseId/teachers (ADMIN únicamente)
router.post(
  '/:courseId/teachers',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  CourseController.assignTeacher
);

// DELETE /api/courses/:courseId/teachers/:teacherId (ADMIN únicamente)
router.delete(
  '/:courseId/teachers/:teacherId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN),
  CourseController.removeTeacher
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/courses/:courseId/students (ADMIN, TEACHER asignado)
router.get(
  '/:courseId/students',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  CourseController.getCourseStudents
);

// POST /api/courses/:courseId/students
router.post(
  '/:courseId/students',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  CourseController.enrollStudent
);

// POST /api/courses/:courseId/students/import/preview
router.post(
  '/:courseId/students/import/preview',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  upload.single('file'),
  CourseController.previewStudentImport
);

// POST /api/courses/:courseId/students/import/confirm
router.post(
  '/:courseId/students/import/confirm',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  CourseController.confirmStudentImport
);

// POST /api/courses/:courseId/students/:studentId/resend-invitation
router.post(
  '/:courseId/students/:studentId/resend-invitation',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  AuthController.resendInvitation
);

// POST /api/courses/:courseId/students/:studentId/reset-access
router.post(
  '/:courseId/students/:studentId/reset-access',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  AuthController.resetAccess
);

// GET /api/courses/:courseId/content (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/content',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  ContentController.getCourseContent
);

// GET /api/courses/:courseId/modules (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/modules',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  ContentController.getCourseModules
);

// POST /api/courses/:courseId/modules (ADMIN, TEACHER asignado)
router.post(
  '/:courseId/modules',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.createModule
);

// PATCH /api/courses/:courseId/modules/reorder (ADMIN, TEACHER asignado)
router.patch(
  '/:courseId/modules/reorder',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.reorderModules
);

// PUT /api/courses/:courseId/modules/:moduleId (ADMIN, TEACHER asignado)
router.put(
  '/:courseId/modules/:moduleId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.updateModule
);

// GET /api/courses/:courseId/modules/:moduleId/lessons (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/modules/:moduleId/lessons',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  ContentController.getModuleLessons
);

// POST /api/courses/:courseId/modules/:moduleId/lessons (ADMIN, TEACHER asignado)
router.post(
  '/:courseId/modules/:moduleId/lessons',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.createLesson
);

// PATCH /api/courses/:courseId/modules/:moduleId/lessons/reorder (ADMIN, TEACHER asignado)
router.patch(
  '/:courseId/modules/:moduleId/lessons/reorder',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.reorderLessons
);

// GET /api/courses/:courseId/modules/:moduleId/lessons/:lessonId (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/modules/:moduleId/lessons/:lessonId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  ContentController.getLessonDetail
);

// PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId (ADMIN, TEACHER asignado)
router.put(
  '/:courseId/modules/:moduleId/lessons/:lessonId',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  ContentController.updateLesson
);

// PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/progress (STUDENT)
router.put(
  '/:courseId/modules/:moduleId/lessons/:lessonId/progress',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  ContentController.toggleLessonProgress
);

// GET /api/courses/:courseId/assessments (ADMIN, TEACHER, STUDENT)
router.get(
  '/:courseId/assessments',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  AssessmentController.getCourseAssessments
);

// POST /api/courses/:courseId/assessments (ADMIN, TEACHER asignado)
router.post(
  '/:courseId/assessments',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  AssessmentController.createAssessment
);

// GET /api/courses/:courseId/gradebook (ADMIN, TEACHER asignado)
router.get(
  '/:courseId/gradebook',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.ADMIN, Role.TEACHER),
  requireCourseTeacher,
  GradebookController.getTeacherGradebook
);

// GET /api/courses/:courseId/my-grades (STUDENT únicamente)
router.get(
  '/:courseId/my-grades',
  authenticate,
  requireActiveUser,
  requirePasswordChanged,
  requireRole(Role.STUDENT),
  GradebookController.getStudentGrades
);

export default router;

