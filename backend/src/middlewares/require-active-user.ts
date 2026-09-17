import { Request, Response, NextFunction } from 'express';

export const requireActiveUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
    return;
  }

  if (!req.user.isActive) {
    res.status(403).json({
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Cuenta suspendida',
      },
    });
    return;
  }

  next();
};
