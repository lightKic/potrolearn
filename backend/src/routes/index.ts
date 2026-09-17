import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import courseRoutes from './course.routes';
import subjectRoutes from './subject.routes';
import adminRoutes from './admin.routes';
import assessmentRoutes from './assessment.routes';
import questionRoutes from './question.routes';
import attemptRoutes from './attempt.routes';

const router: Router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/subjects', subjectRoutes);
router.use('/courses', courseRoutes);
router.use('/admin', adminRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/questions', questionRoutes);
router.use('/attempts', attemptRoutes);

export default router;
