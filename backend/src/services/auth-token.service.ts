import crypto from 'node:crypto';
import { TokenType, AuthToken, User } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateTokenParams {
  userId: string;
  type: TokenType;
  ttlHours?: number;
}

export interface ValidateTokenParams {
  rawToken?: unknown;
  type: TokenType;
}

export interface TokenValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
  authToken?: AuthToken & { user: User };
  user?: User;
}

export const ACCOUNT_ACTIVATION_TOKEN_TTL_HOURS = 2;

export class AuthTokenService {
  /**
   * Genera un token aleatorio seguro de alta entropía (32 bytes / 64 caracteres hex) usando un CSPRNG nativo.
   */
  public static generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera el hash determinista SHA-256 de un token en texto plano (RAW) codificado en hex.
   */
  public static hashToken(rawToken: string): string {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('rawToken inválido para generación de hash SHA-256');
    }
    return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  /**
   * Crea un registro AuthToken en PostgreSQL guardando únicamente el hash SHA-256 del token plano.
   * Retorna el token plano (RAW) únicamente en este momento para ser entregado.
   */
  public static async createToken(params: CreateTokenParams): Promise<{ rawToken: string; authToken: AuthToken }> {
    const { userId, type, ttlHours = ACCOUNT_ACTIVATION_TOKEN_TTL_HOURS } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId requerido para crear AuthToken');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const authToken = await prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash,
        expiresAt,
      },
    });

    return { rawToken, authToken };
  }

  /**
   * Valida un token en texto plano (RAW) contra los registros de la base de datos.
   * Verifica existencia del hash SHA-256, coincidencia de tipo, estado de uso, estado de revocación y expiración.
   */
  public static async validateToken(params: ValidateTokenParams): Promise<TokenValidationResult> {
    const { rawToken, type } = params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    const tokenHash = this.hashToken(rawToken.trim());

    const authToken = await prisma.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!authToken) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    if (authToken.type !== type) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    if (authToken.usedAt !== null) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    if (authToken.revokedAt !== null) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    if (authToken.expiresAt.getTime() <= Date.now()) {
      return {
        valid: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'El enlace de activación no es válido o ha expirado',
      };
    }

    return {
      valid: true,
      authToken,
      user: authToken.user,
    };
  }
}
