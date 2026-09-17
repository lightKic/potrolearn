import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const requireCourseTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      },
    });
    return;
  }

  const courseId = req.params.courseId;
  if (!courseId) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Identificador de curso (courseId) requerido en la ruta',
      },
    });
    return;
  }

  // ADMIN tiene permiso de bypass automático sobre cualquier curso
  if (req.user.role === Role.ADMIN) {
    next();
    return;
  }

  if (req.user.role === Role.TEACHER) {
    const courseTeacherAssignment = await prisma.courseTeacher.findUnique({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId: req.user.id,
        },
      },
    });

    if (!courseTeacherAssignment) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Acceso denegado: no estás asignado como profesor de este curso',
        },
      });
      return;
    }

    next();
    return;
  }

  res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Acceso denegado: rol insuficiente',
    },
  });
};
