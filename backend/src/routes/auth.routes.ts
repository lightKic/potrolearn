import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireActiveUser } from '../middlewares/require-active-user';
import { env } from '../config/env';

const router = Router();

const isTestEnv = (): boolean => env.nodeEnv === 'test';

/**
 * Rate limiter específico para inicio de sesión:
 * 5 intentos permitidos por ventana de 15 minutos por dirección IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Demasiados intentos de inicio de sesión. Intente más tarde.',
      },
    });
  },
});

/**
 * Rate limiter para rutas de activación de cuenta y restablecimiento de contraseña:
 * 10 intentos permitidos por ventana de 15 minutos por dirección IP.
 */
export const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_ACTIVATION_ATTEMPTS',
        message: 'Demasiadas solicitudes de activación o restablecimiento. Intente más tarde.',
      },
    });
  },
});

// POST /api/auth/login
router.post('/login', loginLimiter, AuthController.login);

// POST /api/auth/validate-activation-token
router.post('/validate-activation-token', activationLimiter, AuthController.validateActivationToken);

// POST /api/auth/activate
router.post('/activate', activationLimiter, AuthController.activate);

// POST /api/auth/validate-reset-token
router.post('/validate-reset-token', activationLimiter, AuthController.validateResetToken);

// POST /api/auth/reset-password
router.post('/reset-password', activationLimiter, AuthController.resetPassword);

// POST /api/auth/refresh
router.post('/refresh', AuthController.refresh);

// POST /api/auth/logout
router.post('/logout', AuthController.logout);

// GET /api/auth/me
router.get('/me', authenticate, requireActiveUser, AuthController.getMe);

// PUT /api/auth/me
router.put('/me', authenticate, requireActiveUser, AuthController.updateProfile);

// POST /api/auth/change-password
router.post('/change-password', authenticate, requireActiveUser, AuthController.changePassword);

export default router;
