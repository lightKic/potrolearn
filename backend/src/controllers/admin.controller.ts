import { Request, Response } from 'express';
import { UserProvisioningService } from '../services/user-provisioning.service';
import { AuthError } from '../types/auth.types';
export class AdminController {
  /**
   * Endpoint HTTP Administrativo: POST /api/admin/teachers
   * Alta de un profesor por parte de un ADMIN.
   */
  public static async createTeacher(req: Request, res: Response): Promise<void> {
    try {
      const { name, email } = req.body || {};
      const result = await UserProvisioningService.createTeacher({ name, email });
      
      res.status(201).json({
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
   * Endpoint HTTP Administrativo: POST /api/admin/users
   * Creación administrativa de usuarios TEACHER o STUDENT.
   */
  public static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { role, name, email, studentNumber } = req.body || {};
      const result = await UserProvisioningService.createUserAdmin({
        role,
        name,
        email,
        studentNumber,
      });
      res.status(201).json({ data: result });
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
   * Endpoint HTTP Administrativo: GET /api/admin/teachers
   * Listado de profesores para asignación administrativa.
   */
  public static async getTeachers(_req: Request, res: Response): Promise<void> {
    try {
      const teachers = await UserProvisioningService.listTeachers();
      
      res.status(200).json({
        data: {
          teachers,
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
   * Endpoint HTTP Administrativo: GET /api/admin/users
   * Listado de todos los usuarios registrados.
   */
  public static async getUsers(_req: Request, res: Response): Promise<void> {
    try {
      const users = await UserProvisioningService.listUsers();
      res.status(200).json({
        data: {
          users,
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
   * Endpoint HTTP Administrativo: GET /api/admin/users/:userId
   * Consulta del detalle de un usuario.
   */
  public static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await UserProvisioningService.getUserById(userId);
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
   * Endpoint HTTP Administrativo: PUT /api/admin/users/:userId
   * Edición de datos de identidad del usuario por parte de un ADMIN.
   */
  public static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await UserProvisioningService.updateUserAdmin(userId, req.body);
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
   * Endpoint HTTP Administrativo: POST /api/admin/users/:userId/reset-access
   * Restablece el acceso de un usuario mediante UserProvisioningService.resetUserAccessAdmin.
   */
  public static async resetUserAccess(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const result = await UserProvisioningService.resetUserAccessAdmin(userId);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' } });
    }
  }
}
