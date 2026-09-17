import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthError } from '../types';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/auth-cookie';

export class AuthController {
  /**
   * Endpoint HTTP: POST /api/auth/login
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body || {});

      if (result.rawRefreshToken) {
        setRefreshCookie(res, result.rawRefreshToken);
      }

      res.status(200).json({
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: GET /api/auth/me
   */
  public static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No autorizado',
          },
        });
        return;
      }

      // Consultar estado fresco en BD para reflejar cualquier cambio en tiempo real
      const user = await AuthService.getCurrentUser(req.user.id);
      res.status(200).json({
        data: {
          user,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: PUT /api/auth/me
   * Actualiza los datos del perfil propio del usuario autenticado (nombre).
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No autorizado',
          },
        });
        return;
      }

      const user = await AuthService.updateProfile(req.user.id, req.body);
      res.status(200).json({
        data: {
          user,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/change-password
   */
  public static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No autorizado',
          },
        });
        return;
      }

      const result = await AuthService.changePassword({
        userId: req.user.id,
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword,
      });

      if (result.rawRefreshToken) {
        setRefreshCookie(res, result.rawRefreshToken);
      }

      res.status(200).json({
        data: {
          message: result.message,
          token: result.token,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/validate-activation-token
   */
  public static async validateActivationToken(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.validateActivationToken(req.body?.token);
      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/activate
   */
  public static async activate(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.activateAccount({
        token: req.body?.token,
        email: req.body?.email,
        temporaryPassword: req.body?.temporaryPassword,
        newPassword: req.body?.newPassword,
      });

      if (result.rawRefreshToken) {
        setRefreshCookie(res, result.rawRefreshToken);
      }

      res.status(200).json({
        data: {
          message: result.message,
          user: result.user,
          token: result.token,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/validate-reset-token
   */
  public static async validateResetToken(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.validateResetToken(req.body?.token);
      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/reset-password
   */
  public static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.resetPassword({
        token: req.body?.token,
        email: req.body?.email,
        temporaryPassword: req.body?.temporaryPassword,
        newPassword: req.body?.newPassword,
      });

      if (result.rawRefreshToken) {
        setRefreshCookie(res, result.rawRefreshToken);
      }

      res.status(200).json({
        data: {
          message: result.message,
          user: result.user,
          token: result.token,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/refresh
   * Emite un nuevo Access JWT y rota la cookie HttpOnly de Refresh Token.
   */
  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await AuthService.refresh(rawRefreshToken);

      setRefreshCookie(res, result.rawRefreshToken);

      res.status(200).json({
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error: unknown) {
      clearRefreshCookie(res);
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP: POST /api/auth/logout
   * Cierra la sesión revocando el Refresh Token y limpiando la cookie HttpOnly.
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await AuthService.logout(rawRefreshToken);
      clearRefreshCookie(res);

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      clearRefreshCookie(res);
      res.status(200).json({
        data: {
          message: 'Sesión cerrada correctamente',
        },
      });
    }
  }

  /**
   * Endpoint HTTP Administrativo: POST /api/courses/:courseId/students/:studentId/resend-invitation
   */
  public static async resendInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, studentId } = req.params;
      const result = await AuthService.resendInvitation({ courseId, studentId });

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }

  /**
   * Endpoint HTTP Administrativo: POST /api/courses/:courseId/students/:studentId/reset-access
   */
  public static async resetAccess(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, studentId } = req.params;
      const result = await AuthService.resetAccess({ courseId, studentId });

      res.status(200).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      });
    }
  }
}
