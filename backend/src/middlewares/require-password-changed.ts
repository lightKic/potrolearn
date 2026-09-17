import { Request, Response, NextFunction } from 'express';

export const requirePasswordChanged = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
    return;
  }

  if (req.user.mustChangePassword) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN_MUST_CHANGE_PASSWORD',
        message: 'Debe cambiar su contraseña antes de continuar',
      },
    });
    return;
  }

  next();
};
