import crypto from 'node:crypto';
import { RefreshSession, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AuthError } from '../types/auth.types';

export class RefreshSessionService {
  /**
   * Genera un token aleatorio seguro de alta entropía (32 bytes / 64 caracteres hex = 256 bits).
   */
  public static generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera el hash determinista SHA-256 de un token de actualización en texto plano.
   */
  public static hashToken(rawToken: string): string {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('rawToken inválido para generación de hash SHA-256');
    }
    return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  /**
   * Crea un registro de sesión de refresh persistente en PostgreSQL.
   */
  public static async createSession(
    userId: string,
    ttlDays = env.refreshTokenTtlDays
  ): Promise<{ rawToken: string; session: RefreshSession }> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId requerido para crear RefreshSession');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const session = await prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { rawToken, session };
  }

  /**
   * Ejecuta la rotación atómica e idéntica de un Refresh Token.
   * Invalida la sesión actual en una transacción (revokedAt = now) y genera una nueva sesión.
   * Protege contra concurrencia utilizando consumo condicional (count === 1).
   */
  public static async rotateSession(
    rawToken: unknown
  ): Promise<{ newRawToken: string; newSession: RefreshSession; user: User }> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new AuthError('El token de actualización no es válido o ha expirado', 401, 'INVALID_REFRESH_TOKEN');
    }

    const tokenHash = this.hashToken(rawToken.trim());

    const existingSession = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingSession) {
      throw new AuthError('El token de actualización no es válido o ha expirado', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (existingSession.revokedAt !== null || existingSession.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('El token de actualización no es válido o ha expirado', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = existingSession.user;

    // Verificar si el usuario está deshabilitado
    if (!user.isActive) {
      // Revocar sesión actual
      await prisma.refreshSession.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() },
      });
      throw new AuthError('Tu cuenta se encuentra deshabilitada', 403, 'ACCOUNT_SUSPENDED');
    }

    const newRawToken = this.generateRawToken();
    const newTokenHash = this.hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Consumo atómico condicional para evitar condiciones de carrera (Double Refresh)
        const updateResult = await tx.refreshSession.updateMany({
          where: {
            id: existingSession.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            revokedAt: new Date(),
            lastUsedAt: new Date(),
          },
        });

        if (updateResult.count !== 1) {
          throw new AuthError('El token de actualización no es válido o ha expirado', 401, 'INVALID_REFRESH_TOKEN');
        }

        const newSession = await tx.refreshSession.create({
          data: {
            userId: user.id,
            tokenHash: newTokenHash,
            expiresAt: newExpiresAt,
          },
        });

        return { newSession };
      });

      return {
        newRawToken,
        newSession: result.newSession,
        user,
      };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('El token de actualización no es válido o ha expirado', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Revoca una sesión de refresh específica dado su token plano (RAW).
   * Operación idéntica e idempotente.
   */
  public static async revokeSession(rawToken: unknown): Promise<void> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      return;
    }

    const tokenHash = this.hashToken(rawToken.trim());

    await prisma.refreshSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoca TODAS las sesiones de refresh activas asociadas a un usuario.
   * Utilizado en cambio de contraseña, restablecimiento de acceso y activación.
   */
  public static async revokeAllUserSessions(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') return;

    await prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
