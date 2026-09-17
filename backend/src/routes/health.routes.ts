import { Router } from 'express';
import { getHealth, getDbHealth } from '../controllers/health.controller';

const router: Router = Router();

router.get('/health', getHealth);
router.get('/health/db', getDbHealth);

export default router;
