import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { prisma } from '../lib/prisma';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
    return;
  }

  try {
    const { sub: userId } = JwtService.verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        activatedAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No autorizado',
        },
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Cuenta suspendida',
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
  }
};

