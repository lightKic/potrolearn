import { TokenType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { AuthTokenService } from './auth-token.service';
import { RefreshSessionService } from './refresh-session.service';
import { emailService } from './email/email.service';
import {
  AuthError,
  LoginResponseData,
  UserResponseDTO,
  ActivateAccountResponseData,
  ChangePasswordResponseData,
} from '../types/auth.types';

/**
 * Hash bcrypt dummy válido utilizado para ecualizar los tiempos de respuesta (timing attacks)
 * cuando se intenta iniciar sesión con un correo electrónico que no existe en la BD.
 * Este hash NO es un secreto y NUNCA se debe utilizar para autenticación real.
 */
const DUMMY_BCRYPT_HASH = '$2b$12$e8p2cR8pZ1H7QJ/V1k2N0.0000000000000000000000000000000';

export interface LoginParams {
  email?: unknown;
  password?: unknown;
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword?: unknown;
  newPassword?: unknown;
}

export interface ActivateAccountParams {
  token?: unknown;
  email?: unknown;
  temporaryPassword?: unknown;
  newPassword?: unknown;
}

export interface ResetPasswordParams {
  token?: unknown;
  email?: unknown;
  temporaryPassword?: unknown;
  newPassword?: unknown;
}

export interface AdminStudentActionParams {
  courseId: string;
  studentId: string;
}

export class AuthService {
  /**
   * Procesa el inicio de sesión de un usuario con email y contraseña.
   */
  public static async login(params: LoginParams): Promise<LoginResponseData> {
    const { email, password } = params;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new AuthError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      throw new AuthError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Buscar usuario en BD por email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Ecualizar tiempo ejecutando comparación dummy
      await PasswordService.verifyPassword(password, DUMMY_BCRYPT_HASH);
      throw new AuthError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar contraseña en texto plano contra el hash del usuario
    const isPasswordValid = await PasswordService.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Si la contraseña es válida pero el usuario está suspendido/inactivo
    if (!user.isActive) {
      throw new AuthError('Cuenta suspendida', 403, 'ACCOUNT_SUSPENDED');
    }

    // Actualizar fecha de último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generar Access JWT (15m TTL)
    const token = JwtService.signAccessToken(user.id);

    // Crear sesión de refresh persistente en BD
    const refreshSessionResult = await RefreshSessionService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        activatedAt: user.activatedAt,
      },
      token,
      rawRefreshToken: refreshSessionResult.rawToken,
    };
  }

  /**
   * Consulta los datos actualizados del usuario autenticado actual.
   */
  public static async getCurrentUser(userId: string): Promise<UserResponseDTO> {
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
        lastLoginAt: true,
        createdAt: true,
        studentProfile: {
          select: {
            studentNumber: true,
          },
        },
      },
    });

    if (!user) {
      throw new AuthError('Usuario no encontrado', 401, 'UNAUTHORIZED');
    }

    if (!user.isActive) {
      throw new AuthError('Cuenta suspendida', 403, 'ACCOUNT_SUSPENDED');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      activatedAt: user.activatedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      studentProfile: user.studentProfile ? { studentNumber: user.studentProfile.studentNumber } : null,
    };
  }

  /**
   * Rechaza la modificación de datos de identidad por auto-servicio.
   * La administración de identidad académica está reservada exclusivamente para el rol ADMIN.
   */
  public static async updateProfile(_userId: string, _body: unknown): Promise<UserResponseDTO> {
    void _userId;
    void _body;
    throw new AuthError(
      'La modificación de datos de identidad por auto-servicio no está permitida. Los cambios de identidad deben ser administrados centralmente por un Administrador.',
      403,
      'FORBIDDEN'
    );
  }

  /**
   * Cambia la contraseña de un usuario autenticado.
   */
  public static async changePassword(params: ChangePasswordParams): Promise<ChangePasswordResponseData> {
    const { userId, currentPassword, newPassword } = params;

    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
      throw new AuthError('La contraseña actual es requerida', 400, 'INVALID_CURRENT_PASSWORD');
    }

    if (!newPassword || typeof newPassword !== 'string') {
      throw new AuthError('La nueva contraseña es requerida', 400, 'INVALID_NEW_PASSWORD');
    }

    // Validar contraseña actual en BD (select exclusivo de passwordHash y activatedAt)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        activatedAt: true,
      },
    });

    if (!user) {
      throw new AuthError('Usuario no encontrado', 401, 'UNAUTHORIZED');
    }

    const isCurrentPasswordValid = await PasswordService.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new AuthError('La contraseña actual es incorrecta', 400, 'INVALID_CURRENT_PASSWORD');
    }

    // Validar política de la nueva contraseña
    const passwordValidation = PasswordService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new AuthError(passwordValidation.error || 'Nueva contraseña inválida', 400, 'INVALID_NEW_PASSWORD');
    }

    // Validar que la nueva contraseña difiera de la actual
    if (currentPassword === newPassword) {
      throw new AuthError('La nueva contraseña debe ser diferente a la actual', 400, 'NEW_PASSWORD_MUST_DIFFER');
    }

    // Generar nuevo hash bcrypt
    const newHash = await PasswordService.hashPassword(newPassword);

    // Actualización atómica de contraseña, flag de cambio y estado de activación
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        activatedAt: user.activatedAt ?? new Date(),
      },
    });

    // Revocar sesiones de refresh anteriores y generar nueva sesión persistente
    await RefreshSessionService.revokeAllUserSessions(userId);
    const refreshSessionResult = await RefreshSessionService.createSession(userId);
    const token = JwtService.signAccessToken(userId);

    return {
      message: 'Contraseña actualizada correctamente',
      token,
      rawRefreshToken: refreshSessionResult.rawToken,
    };
  }

  /**
   * Valida la vigencia y estado de un token de activación de cuenta sin consumirlo.
   */
  public static async validateActivationToken(rawToken?: unknown): Promise<{ valid: boolean }> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const result = await AuthTokenService.validateToken({
      rawToken,
      type: TokenType.ACCOUNT_ACTIVATION,
    });

    if (!result.valid) {
      throw new AuthError(result.message || 'El enlace de activación no es válido o ha expirado', 400, result.code || 'INVALID_OR_EXPIRED_TOKEN');
    }

    return { valid: true };
  }

  /**
   * Ejecuta el flujo atómico de activación de cuenta de usuario.
   */
  public static async activateAccount(params: ActivateAccountParams): Promise<ActivateAccountResponseData> {
    const { token: rawToken, email, temporaryPassword, newPassword } = params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    if (!email || typeof email !== 'string' || !temporaryPassword || typeof temporaryPassword !== 'string' || !newPassword || typeof newPassword !== 'string') {
      throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    // Validar política de la nueva contraseña
    const passwordValidation = PasswordService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new AuthError(passwordValidation.error || 'La nueva contraseña no cumple con las políticas requeridas', 400, 'INVALID_NEW_PASSWORD');
    }

    const tokenHash = AuthTokenService.hashToken(rawToken);

    // Transacción atómica en PostgreSQL con protección de concurrencia y single-use
    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Intento de consumo atómico del token para evitar condiciones de carrera (single-use)
      const updateResult = await tx.authToken.updateMany({
        where: {
          tokenHash,
          type: TokenType.ACCOUNT_ACTIVATION,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 2. Obtener los datos del token y el usuario asociado
      const authToken = await tx.authToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!authToken || !authToken.user) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      const user = authToken.user;

      // 3. Validar email (anti-enumeración)
      if (user.email.toLowerCase() !== normalizedEmail) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 4. Validar que la cuenta esté pendiente de activación (mustChangePassword == true y activatedAt == null)
      if (user.activatedAt !== null || !user.mustChangePassword) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 5. Validar que la cuenta no esté suspendida
      if (!user.isActive) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 6. Verificar contraseña temporal (anti-enumeración)
      const isTempPasswordValid = await PasswordService.verifyPassword(temporaryPassword, user.passwordHash);
      if (!isTempPasswordValid) {
        throw new AuthError('El enlace de activación no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 7. Verificar que la nueva contraseña no coincida con la temporal o la existente
      const isSamePassword = await PasswordService.verifyPassword(newPassword, user.passwordHash);
      if (isSamePassword || temporaryPassword === newPassword) {
        throw new AuthError('La nueva contraseña debe ser diferente a la contraseña temporal', 400, 'NEW_PASSWORD_MUST_DIFFER');
      }

      // 8. Revocar otros tokens de activación pendientes para este usuario
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          type: TokenType.ACCOUNT_ACTIVATION,
          usedAt: null,
          id: { not: authToken.id },
        },
        data: {
          revokedAt: now,
        },
      });

      // 9. Asignar nuevo hash de contraseña y actualizar estado del usuario
      const newPasswordHash = await PasswordService.hashPassword(newPassword);

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          isActive: true,
          activatedAt: now,
        },
      });

      // 10. Revocar sesiones anteriores y generar nueva sesión de refresh persistente
      await tx.refreshSession.updateMany({
        where: { userId: updatedUser.id, revokedAt: null },
        data: { revokedAt: now },
      });

      const rawRefreshToken = RefreshSessionService.generateRawToken();
      const tokenHashRef = RefreshSessionService.hashToken(rawRefreshToken);
      const expiresAtRef = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await tx.refreshSession.create({
        data: {
          userId: updatedUser.id,
          tokenHash: tokenHashRef,
          expiresAt: expiresAtRef,
        },
      });

      // 11. Generar token JWT de acceso
      const accessToken = JwtService.signAccessToken(updatedUser.id);

      return {
        message: 'Cuenta activada correctamente',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          mustChangePassword: updatedUser.mustChangePassword,
          activatedAt: updatedUser.activatedAt,
        },
        token: accessToken,
        rawRefreshToken,
      };
    });
  }

  /**
   * Valida la vigencia y estado de un token de restablecimiento de contraseña (PASSWORD_RESET) sin consumirlo.
   */
  public static async validateResetToken(rawToken?: unknown): Promise<{ valid: boolean }> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const result = await AuthTokenService.validateToken({
      rawToken,
      type: TokenType.PASSWORD_RESET,
    });

    if (!result.valid) {
      throw new AuthError(result.message || 'El enlace de restablecimiento no es válido o ha expirado', 400, result.code || 'INVALID_OR_EXPIRED_TOKEN');
    }

    return { valid: true };
  }

  /**
   * Ejecuta el flujo atómico de restablecimiento de contraseña mediante token PASSWORD_RESET.
   */
  public static async resetPassword(params: ResetPasswordParams): Promise<ActivateAccountResponseData> {
    const { token: rawToken, email, temporaryPassword, newPassword } = params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    if (!email || typeof email !== 'string' || !temporaryPassword || typeof temporaryPassword !== 'string' || !newPassword || typeof newPassword !== 'string') {
      throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
    }

    // Validar política de la nueva contraseña
    const passwordValidation = PasswordService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new AuthError(passwordValidation.error || 'La nueva contraseña no cumple con las políticas requeridas', 400, 'INVALID_NEW_PASSWORD');
    }

    const tokenHash = AuthTokenService.hashToken(rawToken);

    // Transacción atómica en PostgreSQL con protección de concurrencia y single-use
    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Consumo atómico del token PASSWORD_RESET
      const updateResult = await tx.authToken.updateMany({
        where: {
          tokenHash,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 2. Obtener datos del token y usuario
      const authToken = await tx.authToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!authToken || !authToken.user) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      const user = authToken.user;

      // 3. Validar email (anti-enumeración)
      if (user.email.toLowerCase() !== normalizedEmail) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 4. Validar que la cuenta SÍ estuviera activada previamente
      if (user.activatedAt === null) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 5. Validar que la cuenta no esté suspendida
      if (!user.isActive) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 6. Verificar contraseña temporal (anti-enumeración)
      const isTempPasswordValid = await PasswordService.verifyPassword(temporaryPassword, user.passwordHash);
      if (!isTempPasswordValid) {
        throw new AuthError('El enlace de restablecimiento no es válido o ha expirado', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      // 7. Verificar que la nueva contraseña no coincida con la temporal
      const isSamePassword = await PasswordService.verifyPassword(newPassword, user.passwordHash);
      if (isSamePassword || temporaryPassword === newPassword) {
        throw new AuthError('La nueva contraseña debe ser diferente a la contraseña temporal', 400, 'NEW_PASSWORD_MUST_DIFFER');
      }

      // 8. Revocar otros tokens PASSWORD_RESET pendientes para este usuario
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
          id: { not: authToken.id },
        },
        data: {
          revokedAt: now,
        },
      });

      // 9. Asignar nuevo hash de contraseña y restablecer mustChangePassword = false (activatedAt se PRESERVA)
      const newPasswordHash = await PasswordService.hashPassword(newPassword);

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
        },
      });

      // 10. Revocar sesiones anteriores y generar nueva sesión de refresh persistente
      await tx.refreshSession.updateMany({
        where: { userId: updatedUser.id, revokedAt: null },
        data: { revokedAt: now },
      });

      const rawRefreshToken = RefreshSessionService.generateRawToken();
      const tokenHashRef = RefreshSessionService.hashToken(rawRefreshToken);
      const expiresAtRef = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await tx.refreshSession.create({
        data: {
          userId: updatedUser.id,
          tokenHash: tokenHashRef,
          expiresAt: expiresAtRef,
        },
      });

      // 11. Generar token JWT de acceso
      const accessToken = JwtService.signAccessToken(updatedUser.id);

      return {
        message: 'Contraseña restablecida correctamente',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          mustChangePassword: updatedUser.mustChangePassword,
          activatedAt: updatedUser.activatedAt,
        },
        token: accessToken,
        rawRefreshToken,
      };
    });
  }

  /**
   * Reenvía la invitación de activación de cuenta para un estudiante no activado.
   */
  public static async resendInvitation(params: AdminStudentActionParams): Promise<{ message: string; emailSent: boolean }> {
    const { courseId, studentId } = params;

    // Verificar inscripción del estudiante en el curso
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
      include: {
        student: true,
        course: true,
      },
    });

    if (!enrollment) {
      throw new AuthError('El estudiante no está inscrito en el curso especificado', 400, 'STUDENT_NOT_ENROLLED');
    }

    const student = enrollment.student;

    // Verificar que la cuenta esté pendiente de activación
    if (student.activatedAt !== null) {
      throw new AuthError('El estudiante ya ha activado su cuenta previamente', 400, 'STUDENT_ALREADY_ACTIVATED');
    }

    // Transacción atómica en BD
    const { rawToken, tempPassword } = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Revocar tokens de activación anteriores
      await tx.authToken.updateMany({
        where: {
          userId: student.id,
          type: TokenType.ACCOUNT_ACTIVATION,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Generar nueva contraseña temporal
      const tempPassword = PasswordService.generateTemporaryPassword(12);
      const tempPasswordHash = await PasswordService.hashPassword(tempPassword);

      // Actualizar hash y flag de cambio obligatorio (activatedAt se mantiene null)
      await tx.user.update({
        where: { id: student.id },
        data: {
          passwordHash: tempPasswordHash,
          mustChangePassword: true,
        },
      });

      // Crear nuevo AuthToken de activación
      const rawToken = AuthTokenService.generateRawToken();
      const tokenHash = AuthTokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await tx.authToken.create({
        data: {
          userId: student.id,
          type: TokenType.ACCOUNT_ACTIVATION,
          tokenHash,
          expiresAt,
        },
      });

      return { rawToken, tempPassword };
    });

    // Envío de correo electrónico DESPUÉS del COMMIT de la transacción
    let emailSent = false;
    try {
      emailSent = await emailService.sendAccountInvitation({
        recipientEmail: student.email,
        recipientName: student.name,
        courseName: enrollment.course.name,
        rawToken,
        temporaryPassword: tempPassword,
      });
    } catch {
      emailSent = false;
    }

    return {
      message: emailSent
        ? 'Invitación reenviada exitosamente por correo electrónico'
        : 'Invitación generada exitosamente. El servicio de correo no pudo entregar el mensaje (INVITATION_CREATED_EMAIL_FAILED).',
      emailSent,
    };
  }

  /**
   * Restablece el acceso de un estudiante cuya cuenta ya ha sido activada previamente.
   */
  public static async resetAccess(params: AdminStudentActionParams): Promise<{ message: string; emailSent: boolean }> {
    const { courseId, studentId } = params;

    // Verificar inscripción del estudiante en el curso
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
      include: {
        student: true,
        course: true,
      },
    });

    if (!enrollment) {
      throw new AuthError('El estudiante no está inscrito en el curso especificado', 400, 'STUDENT_NOT_ENROLLED');
    }

    const student = enrollment.student;

    // Verificar que la cuenta SÍ esté activada previamente
    if (student.activatedAt === null) {
      throw new AuthError('El estudiante no ha activado su cuenta previamente', 400, 'STUDENT_NOT_ACTIVATED');
    }

    // Transacción atómica en BD
    const { rawToken, tempPassword } = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Revocar tokens de reset anteriores
      await tx.authToken.updateMany({
        where: {
          userId: student.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Revocar TODAS las sesiones de refresh de este estudiante
      await tx.refreshSession.updateMany({
        where: {
          userId: student.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Generar nueva contraseña temporal
      const tempPassword = PasswordService.generateTemporaryPassword(12);
      const tempPasswordHash = await PasswordService.hashPassword(tempPassword);

      // Actualizar hash y forzar cambio obligatorio en el siguiente request (activatedAt se PRESERVA)
      await tx.user.update({
        where: { id: student.id },
        data: {
          passwordHash: tempPasswordHash,
          mustChangePassword: true,
        },
      });

      // Crear nuevo AuthToken de restablecimiento de contraseña
      const rawToken = AuthTokenService.generateRawToken();
      const tokenHash = AuthTokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await tx.authToken.create({
        data: {
          userId: student.id,
          type: TokenType.PASSWORD_RESET,
          tokenHash,
          expiresAt,
        },
      });

      return { rawToken, tempPassword };
    });

    // Envío de correo electrónico DESPUÉS del COMMIT de la transacción
    let emailSent = false;
    try {
      emailSent = await emailService.sendPasswordReset({
        recipientEmail: student.email,
        recipientName: student.name,
        rawToken,
        temporaryPassword: tempPassword,
      });
    } catch {
      emailSent = false;
    }

    return {
      message: emailSent
        ? 'Instrucciones de restablecimiento enviadas por correo electrónico'
        : 'Restablecimiento de acceso generado exitosamente. El servicio de correo no pudo entregar el mensaje (RESET_CREATED_EMAIL_FAILED).',
      emailSent,
    };
  }

  /**
   * Ejecuta la rotación de Refresh Token, revocando la sesión anterior y emitiendo una nueva credencial.
   */
  public static async refresh(rawRefreshToken?: unknown): Promise<{ token: string; user: UserResponseDTO; rawRefreshToken: string }> {
    const rotation = await RefreshSessionService.rotateSession(rawRefreshToken);
    const token = JwtService.signAccessToken(rotation.user.id);

    return {
      token,
      user: {
        id: rotation.user.id,
        email: rotation.user.email,
        name: rotation.user.name,
        role: rotation.user.role,
        mustChangePassword: rotation.user.mustChangePassword,
        activatedAt: rotation.user.activatedAt,
      },
      rawRefreshToken: rotation.newRawToken,
    };
  }

  /**
   * Cierra la sesión revocando la credencial de Refresh Token en la base de datos.
   * Operación limpia e idéntica/idempotente.
   */
  public static async logout(rawRefreshToken?: unknown): Promise<{ message: string }> {
    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      await RefreshSessionService.revokeSession(rawRefreshToken);
    }
    return {
      message: 'Sesión cerrada correctamente',
    };
  }
}
