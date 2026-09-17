import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No autorizado',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Acceso denegado: rol insuficiente',
        },
      });
      return;
    }

    next();
  };
};
