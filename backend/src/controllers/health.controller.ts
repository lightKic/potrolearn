import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'potrolearn-backend',
  });
};

export const getDbHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
};
