import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';
import { UserProvisioningService } from '../services/user-provisioning.service';
import { AuthError } from '../types/auth.types';
import { CourseStatus } from '@prisma/client';

export class CourseController {
  /**
   * GET /api/courses
   */
  public static async getCourses(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const courses = await CourseService.getCoursesForUser(req.user);
      res.status(200).json({ data: courses });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId
   */
  public static async getCourseDetail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const course = await CourseService.getCourseDetail(courseId, req.user);
      res.status(200).json({ data: course });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses
   */
  public static async createCourse(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { subjectId, name, description, startDate, endDate } = req.body || {};
      const course = await CourseService.createCourse(
        { subjectId, name, description, startDate, endDate },
        req.user,
      );
      res.status(201).json({ data: course });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PUT /api/courses/:courseId
   */
  public static async updateCourse(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const { subjectId, name, description, startDate, endDate } = req.body || {};
      const course = await CourseService.updateCourse(
        courseId,
        { subjectId, name, description, startDate, endDate },
        req.user,
      );
      res.status(200).json({ data: course });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * PATCH /api/courses/:courseId/status
   */
  public static async changeCourseStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const { status } = req.body || {};

      if (!status || !Object.values(CourseStatus).includes(status)) {
        res.status(400).json({
          error: {
            code: 'INVALID_COURSE_STATUS',
            message: 'El estado del curso proporcionado no es válido',
          },
        });
        return;
      }

      const course = await CourseService.changeCourseStatus(courseId, status as CourseStatus, req.user);
      res.status(200).json({ data: course });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId/teachers
   */
  public static async getCourseTeachers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
        return;
      }
      const { courseId } = req.params;
      const course = await CourseService.getCourseDetail(courseId, req.user);
      res.status(200).json({ data: course.courseTeachers });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/teachers
   */
  public static async assignTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const { teacherId } = req.body || {};
      const assignment = await CourseService.assignTeacher(courseId, teacherId);
      res.status(201).json({ data: assignment });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * DELETE /api/courses/:courseId/teachers/:teacherId
   */
  public static async removeTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, teacherId } = req.params;
      const result = await CourseService.removeTeacher(courseId, teacherId);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * Endpoint HTTP: POST /api/courses/:courseId/students
   * Alta manual e inscripción de estudiante a un curso (por parte de TEACHER asignado o ADMIN).
   */
  public static async enrollStudent(req: Request, res: Response): Promise<void> {
    try {
      const courseId = req.params.courseId;
      const { name, email, studentNumber } = req.body || {};

      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No autorizado',
          },
        });
        return;
      }

      const result = await UserProvisioningService.enrollStudent({
        courseId,
        name,
        email,
        studentNumber,
        executorUser: req.user,
      });

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
   * GET /api/courses/:courseId/students
   */
  public static async getCourseStudents(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const students = await UserProvisioningService.getCourseStudents(courseId);
      res.status(200).json({ data: students });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/students/import/preview
   */
  public static async previewStudentImport(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: {
            code: 'INVALID_IMPORT_FILE',
            message: 'No se recibió ningún archivo para la previsualización.',
          },
        });
        return;
      }

      const previewResult = await UserProvisioningService.previewExcelImport(courseId, file.buffer);
      res.status(200).json({ data: previewResult });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * POST /api/courses/:courseId/students/import/confirm
   */
  public static async confirmStudentImport(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const { rows } = req.body || {};

      const confirmResult = await UserProvisioningService.confirmBulkEnrollment(courseId, rows);
      res.status(200).json({ data: confirmResult });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }

  /**
   * GET /api/courses/:courseId/search-students
   */
  public static async searchStudents(req: Request, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const query = (req.query.query || req.query.q || '') as string;
      const results = await UserProvisioningService.searchStudentsForCourse(courseId, query);
      res.status(200).json({ data: results });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }
}
